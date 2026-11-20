const { after, before, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-bytes'
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'

const app = require('../src/app')
const prisma = require('../src/config/prisma')

const ids = {
  hospitalUser: 'hospital-user',
  otherHospitalUser: 'other-hospital-user',
  noMembershipUser: 'hospital-no-membership',
  officer: 'officer-user',
  secondOfficer: 'second-officer-user',
  publicUser: 'public-user',
  hospital: 'hospital-a',
  otherHospital: 'hospital-b',
  area: 'area-a',
  otherArea: 'area-b',
  district: 'district-a',
  otherDistrict: 'district-b',
  dengue: 'disease-dengue',
  malaria: 'disease-malaria',
}

let state
let originals
let server
let baseUrl

function resetState() {
  state = {
    transactionCount: 0,
    users: {
      [ids.hospitalUser]: 'HOSPITAL',
      [ids.otherHospitalUser]: 'HOSPITAL',
      [ids.noMembershipUser]: 'HOSPITAL',
      [ids.officer]: 'MEDICAL_OFFICER',
      [ids.secondOfficer]: 'MEDICAL_OFFICER',
      [ids.publicUser]: 'PUBLIC',
    },
    districts: {
      [ids.district]: { id: ids.district, name: 'North District' },
      [ids.otherDistrict]: { id: ids.otherDistrict, name: 'South District' },
    },
    hospitals: {
      [ids.hospital]: { id: ids.hospital, name: 'Hospital A', districtId: ids.district },
      [ids.otherHospital]: { id: ids.otherHospital, name: 'Hospital B', districtId: ids.otherDistrict },
    },
    memberships: [
      { userId: ids.hospitalUser, hospitalId: ids.hospital },
      { userId: ids.otherHospitalUser, hospitalId: ids.otherHospital },
    ],
    areas: {
      [ids.area]: { id: ids.area, name: 'North Area', districtId: ids.district },
      [ids.otherArea]: { id: ids.otherArea, name: 'South Area', districtId: ids.otherDistrict },
    },
    diseases: {
      [ids.dengue]: { id: ids.dengue, name: 'Dengue', code: 'DEN', isActive: true },
      [ids.malaria]: { id: ids.malaria, name: 'Malaria', code: 'MAL', isActive: true },
      'inactive-disease': {
        id: 'inactive-disease',
        name: 'Inactive Disease',
        code: 'INACTIVE',
        isActive: false,
      },
    },
    offices: {
      [ids.officer]: { id: 'office-a', areas: [{ areaId: ids.area }] },
      [ids.secondOfficer]: { id: 'office-b', areas: [{ areaId: ids.area }] },
    },
    reports: [],
  }

  state.reports.push(
    makeReport({
      id: 'pending-review',
      status: 'PENDING',
      areaId: ids.area,
      hospitalId: ids.hospital,
      lines: [{
        diseaseId: ids.dengue,
        caseCount: 2,
        notes: 'Synthetic surveillance context',
      }],
    }),
    makeReport({
      id: 'pending-outside',
      status: 'PENDING',
      areaId: ids.otherArea,
      hospitalId: ids.otherHospital,
      lines: [{ diseaseId: ids.malaria, caseCount: 6 }],
    }),
    makeReport({
      id: 'verified-a',
      status: 'VERIFIED',
      areaId: ids.area,
      hospitalId: ids.hospital,
      lines: [
        { diseaseId: ids.dengue, caseCount: 3 },
        { diseaseId: ids.malaria, caseCount: 2 },
      ],
    }),
    makeReport({
      id: 'verified-b',
      status: 'VERIFIED',
      areaId: ids.area,
      hospitalId: ids.hospital,
      lines: [{ diseaseId: ids.dengue, caseCount: 4 }],
    }),
    makeReport({
      id: 'verified-other-area',
      status: 'VERIFIED',
      areaId: ids.otherArea,
      hospitalId: ids.otherHospital,
      lines: [{ diseaseId: ids.dengue, caseCount: 5 }],
    }),
    makeReport({
      id: 'rejected-a',
      status: 'REJECTED',
      areaId: ids.area,
      hospitalId: ids.hospital,
      lines: [{ diseaseId: ids.dengue, caseCount: 200 }],
    }),
  )
}

function makeReport({ id, status, areaId, hospitalId, lines, reviewedByMedicalOfficeId }) {
  const date = new Date('2026-03-01T00:00:00.000Z')
  return {
    id,
    submittedByUserId: ids.hospitalUser,
    hospitalId,
    areaId,
    status,
    reportedAt: date,
    createdAt: date,
    reviewedAt: status === 'PENDING' ? null : date,
    reviewedByMedicalOfficeId: status === 'PENDING'
      ? null
      : reviewedByMedicalOfficeId || 'office-a',
    reviewNotes: status === 'PENDING' ? null : 'Reviewed',
    lines: lines.map((line, index) => ({
      id: `${id}-line-${index}`,
      ...line,
      notes: line.notes ?? null,
    })),
  }
}

function areaRecord(id) {
  const area = state.areas[id]
  return area && {
    id: area.id,
    name: area.name,
    district: state.districts[area.districtId],
  }
}

function safeReport(report, includeReview = false, includeLineNotes = false) {
  const result = {
    id: report.id,
    status: report.status,
    reportedAt: report.reportedAt,
    createdAt: report.createdAt,
    area: areaRecord(report.areaId),
    hospital: report.hospitalId ? {
      id: state.hospitals[report.hospitalId].id,
      name: state.hospitals[report.hospitalId].name,
    } : null,
    lines: report.lines.map((line) => ({
      id: line.id,
      caseCount: line.caseCount,
      ...(includeLineNotes ? { notes: line.notes } : {}),
      disease: {
        id: line.diseaseId,
        name: state.diseases[line.diseaseId]?.name,
      },
    })),
  }
  if (includeReview) {
    result.reviewedAt = report.reviewedAt
    result.reviewNotes = report.reviewNotes
  }
  return result
}

function matchesWhere(report, where) {
  if (typeof where.status === 'string' && report.status !== where.status) return false
  if (where.status?.in && !where.status.in.includes(report.status)) return false
  if (
    where.reviewedByMedicalOfficeId &&
    report.reviewedByMedicalOfficeId !== where.reviewedByMedicalOfficeId
  ) return false
  if (where.areaId?.in && !where.areaId.in.includes(report.areaId)) return false
  if (where.hospitalId?.in && !where.hospitalId.in.includes(report.hospitalId)) return false
  if (where.id?.in && !where.id.in.includes(report.id)) return false
  if (where.id && !Array.isArray(where.id) && typeof where.id === 'string' && report.id !== where.id) {
    return false
  }
  return true
}

function installPrismaMocks() {
  originals = {
    transaction: prisma.$transaction,
    userFindUnique: prisma.user.findUnique,
    hospitalUserFindMany: prisma.hospitalUser.findMany,
    areaFindUnique: prisma.area.findUnique,
    areaFindMany: prisma.area.findMany,
    diseaseFindUnique: prisma.disease.findUnique,
    diseaseFindMany: prisma.disease.findMany,
    medicalOfficeFindUnique: prisma.medicalOffice.findUnique,
    reportCreate: prisma.diseaseReport.create,
    reportFindMany: prisma.diseaseReport.findMany,
    reportFindUnique: prisma.diseaseReport.findUnique,
    reportCount: prisma.diseaseReport.count,
    reportUpdateMany: prisma.diseaseReport.updateMany,
    lineGroupBy: prisma.diseaseReportLine.groupBy,
  }

  prisma.$transaction = async (callback) => {
    state.transactionCount += 1
    return callback(prisma)
  }
  prisma.user.findUnique = async ({ where }) => {
    const role = state.users[where.id]
    return role ? { role: { name: role } } : null
  }
  prisma.hospitalUser.findMany = async ({ where }) => state.memberships
    .filter(({ userId }) => userId === where.userId)
    .map(({ hospitalId, userId }) => ({
      hospitalId,
      userId,
      hospital: state.hospitals[hospitalId],
    }))
  prisma.area.findUnique = async ({ where }) => {
    const area = state.areas[where.id]
    return area ? { id: area.id, districtId: area.districtId } : null
  }
  prisma.disease.findUnique = async ({ where }) => {
    const disease = state.diseases[where.id]
    return disease ? { id: disease.id } : null
  }
  prisma.disease.findMany = async ({ where, select }) => {
    const diseases = Object.values(state.diseases).filter((disease) => (
      (!where.id || where.id.in.includes(disease.id)) &&
      (!where.isActive || disease.isActive)
    ))
    return diseases.map(({ id, name, code }) => (
      select.code ? { id, name, code } : { id, name }
    ))
  }
  prisma.area.findMany = async () => Object.values(state.areas).map((area) => ({
    id: area.id,
    name: area.name,
    district: { name: state.districts[area.districtId].name },
  }))
  prisma.medicalOffice.findUnique = async ({ where }) => state.offices[where.userId] || null
  prisma.diseaseReport.create = async ({ data }) => {
    const report = makeReport({
      id: `created-${state.reports.length + 1}`,
      status: data.status,
      areaId: data.areaId,
      hospitalId: data.hospitalId,
      lines: data.lines.create,
    })

    report.submittedByUserId = data.submittedByUserId
    report.reportedAt = data.reportedAt
    report.createdAt = new Date('2026-03-02T00:00:00.000Z')
    state.reports.push(report)
    return safeReport(report, false, true)
  }
  prisma.diseaseReport.findMany = async ({ where, skip = 0, take = 20, select }) => {
    if (where.id?.in) {
      return state.reports
        .filter((report) => where.id.in.includes(report.id) && report.status === where.status)
        .map((report) => ({ id: report.id, area: areaRecord(report.areaId) }))
    }

    return state.reports
      .filter((report) => matchesWhere(report, where))
      .slice(skip, skip + take)
      .map((report) => safeReport(
        report,
        Boolean(select?.reviewNotes),
        Boolean(select?.lines?.select?.notes),
      ))
  }
  prisma.diseaseReport.findUnique = async ({ where, select }) => {
    const report = state.reports.find(({ id }) => id === where.id)
    if (!report) return null
    if (select && !select.lines && !select.reviewNotes) {
      return { id: report.id, areaId: report.areaId, status: report.status }
    }
    return safeReport(
      report,
      Boolean(select?.reviewNotes),
      Boolean(select?.lines?.select?.notes),
    )
  }
  prisma.diseaseReport.count = async ({ where }) => (
    state.reports.filter((report) => matchesWhere(report, where)).length
  )
  prisma.diseaseReport.updateMany = async ({ where, data }) => {
    const report = state.reports.find(({ id }) => id === where.id)
    if (
      !report ||
      report.status !== where.status ||
      !where.areaId.in.includes(report.areaId)
    ) {
      return { count: 0 }
    }
    Object.assign(report, data)
    return { count: 1 }
  }
  prisma.diseaseReportLine.groupBy = async ({ where }) => {
    const groups = new Map()
    for (const report of state.reports) {
      if (
        report.status !== where.diseaseReport.is.status ||
        (where.diseaseReport.is.areaId && report.areaId !== where.diseaseReport.is.areaId)
      ) {
        continue
      }
      for (const line of report.lines) {
        if (where.diseaseId && line.diseaseId !== where.diseaseId) continue
        const key = `${line.diseaseId}\u0000${report.id}`
        const current = groups.get(key) || {
          diseaseId: line.diseaseId,
          diseaseReportId: report.id,
          _sum: { caseCount: 0 },
        }
        current._sum.caseCount += line.caseCount
        groups.set(key, current)
      }
    }
    return [...groups.values()]
  }
}

function restorePrismaMocks() {
  prisma.$transaction = originals.transaction
  prisma.user.findUnique = originals.userFindUnique
  prisma.hospitalUser.findMany = originals.hospitalUserFindMany
  prisma.area.findUnique = originals.areaFindUnique
  prisma.area.findMany = originals.areaFindMany
  prisma.disease.findUnique = originals.diseaseFindUnique
  prisma.disease.findMany = originals.diseaseFindMany
  prisma.medicalOffice.findUnique = originals.medicalOfficeFindUnique
  prisma.diseaseReport.create = originals.reportCreate
  prisma.diseaseReport.findMany = originals.reportFindMany
  prisma.diseaseReport.findUnique = originals.reportFindUnique
  prisma.diseaseReport.count = originals.reportCount
  prisma.diseaseReport.updateMany = originals.reportUpdateMany
  prisma.diseaseReportLine.groupBy = originals.lineGroupBy
}

function token(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, { subject: userId, expiresIn: '1h' })
}

async function request(path, { userId, method = 'GET', body } = {}) {
  const headers = {}
  if (userId) headers.authorization = `Bearer ${token(userId)}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function validSubmission(overrides = {}) {
  return {
    areaId: ids.area,
    reportedAt: '2026-03-02',
    diseases: [{ diseaseId: ids.dengue, caseCount: 7, notes: 'Weekly total' }],
    ...overrides,
  }
}

function listen(appToListen) {
  const instance = appToListen.listen(0, '127.0.0.1')
  return new Promise((resolve, reject) => {
    instance.once('error', reject)
    instance.once('listening', () => {
      instance.removeListener('error', reject)
      resolve({ server: instance, url: `http://127.0.0.1:${instance.address().port}` })
    })
  })
}

before(() => {
  installPrismaMocks()
})

beforeEach(() => {
  resetState()
})

before(async () => {
  const listening = await listen(app)
  server = listening.server
  baseUrl = listening.url
})

after(async () => {
  restorePrismaMocks()
  await new Promise((resolve) => server.close(resolve))
})

test('hospital submits a pending report using their authenticated identity and membership', async () => {
  const response = await request('/api/reports', {
    userId: ids.hospitalUser,
    method: 'POST',
    body: {
      ...validSubmission(),
      submittedByUserId: ids.otherHospitalUser,
    },
  })
  const { report } = await response.json()

  assert.equal(response.status, 201)
  assert.equal(report.status, 'PENDING')
  assert.equal(report.hospital.id, ids.hospital)
  assert.equal(report.lines[0].disease.name, 'Dengue')
  assert.equal(state.transactionCount, 1)
  assert.equal(state.reports.at(-1).submittedByUserId, ids.hospitalUser)
  assert.equal(Object.hasOwn(report, 'submittedByUserId'), false)
})

test('report submission requires authentication', async () => {
  const response = await request('/api/reports', {
    method: 'POST',
    body: validSubmission(),
  })

  assert.equal(response.status, 401)
})

test('non-hospital roles cannot submit reports', async () => {
  const response = await request('/api/reports', {
    userId: ids.publicUser,
    method: 'POST',
    body: validSubmission(),
  })

  assert.equal(response.status, 403)
})

test('hospital users without a membership cannot submit reports', async () => {
  const response = await request('/api/reports', {
    userId: ids.noMembershipUser,
    method: 'POST',
    body: validSubmission(),
  })

  assert.equal(response.status, 403)
})

test('submission rejects nonexistent areas, cross-district areas, and inactive diseases', async () => {
  const unknownArea = await request('/api/reports', {
    userId: ids.hospitalUser,
    method: 'POST',
    body: validSubmission({ areaId: 'missing-area' }),
  })
  assert.equal(unknownArea.status, 404)

  const wrongDistrict = await request('/api/reports', {
    userId: ids.hospitalUser,
    method: 'POST',
    body: validSubmission({ areaId: ids.otherArea }),
  })
  assert.equal(wrongDistrict.status, 400)

  const inactiveDisease = await request('/api/reports', {
    userId: ids.hospitalUser,
    method: 'POST',
    body: validSubmission({
      diseases: [{ diseaseId: 'inactive-disease', caseCount: 1 }],
    }),
  })
  assert.equal(inactiveDisease.status, 400)
})

test('submission rejects invalid and duplicate disease entries and client status', async () => {
  const invalidCases = [0, -1, 1.5, '2']
  for (const caseCount of invalidCases) {
    const response = await request('/api/reports', {
      userId: ids.hospitalUser,
      method: 'POST',
      body: validSubmission({
        diseases: [{ diseaseId: ids.dengue, caseCount }],
      }),
    })
    assert.equal(response.status, 400)
  }

  const duplicate = await request('/api/reports', {
    userId: ids.hospitalUser,
    method: 'POST',
    body: validSubmission({
      diseases: [
        { diseaseId: ids.dengue, caseCount: 1 },
        { diseaseId: ids.dengue, caseCount: 2 },
      ],
    }),
  })
  assert.equal(duplicate.status, 400)

  const suppliedStatus = await request('/api/reports', {
    userId: ids.hospitalUser,
    method: 'POST',
    body: validSubmission({ status: 'VERIFIED' }),
  })
  assert.equal(suppliedStatus.status, 400)
})

test('submission rejects a hospital ID outside the authenticated user memberships', async () => {
  const response = await request('/api/reports', {
    userId: ids.hospitalUser,
    method: 'POST',
    body: validSubmission({ hospitalId: ids.otherHospital }),
  })

  assert.equal(response.status, 403)
})

test('hospital history is limited to the user memberships and supports pagination', async () => {
  state.reports.push(makeReport({
    id: 'other-hospital-report',
    status: 'PENDING',
    areaId: ids.otherArea,
    hospitalId: ids.otherHospital,
    lines: [{ diseaseId: ids.dengue, caseCount: 9 }],
  }))

  const response = await request('/api/reports/mine?limit=1&page=2', {
    userId: ids.hospitalUser,
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.pagination.total, 4)
  assert.equal(body.pagination.page, 2)
  assert.equal(body.reports.length, 1)
  assert.equal(body.reports[0].hospital.id, ids.hospital)
  assert.equal(body.reports[0].reviewNotes, 'Reviewed')
  assert.equal(Object.hasOwn(body.reports[0], 'submittedByUserId'), false)

  const otherHospital = await request(`/api/reports/mine?hospitalId=${ids.otherHospital}`, {
    userId: ids.hospitalUser,
  })
  assert.equal(otherHospital.status, 403)
})

test('public reference data exposes only active disease and area fields', async () => {
  const response = await request('/api/public/reference-data')
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body.diseases, [
    { id: ids.dengue, name: 'Dengue', code: 'DEN' },
    { id: ids.malaria, name: 'Malaria', code: 'MAL' },
  ])
  assert.deepEqual(body.areas[0], {
    id: ids.area,
    name: 'North Area',
    district: { name: 'North District' },
  })
  assert.deepEqual(Object.keys(body).sort(), ['areas', 'diseases'])
  assert.equal(JSON.stringify(body).includes('Inactive Disease'), false)
  assert.equal(JSON.stringify(body).includes('hospital'), false)
  assert.equal(JSON.stringify(body).includes('report'), false)
  assert.equal(JSON.stringify(body).includes('user'), false)
})

test('medical officers see only pending reports in assigned areas', async () => {
  const response = await request('/api/reports/pending', { userId: ids.officer })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body.reports.map(({ id }) => id), ['pending-review'])
  assert.equal(body.reports[0].hospital.name, 'Hospital A')
  assert.equal(body.reports[0].lines[0].notes, 'Synthetic surveillance context')
  assert.equal(Object.hasOwn(body.reports[0], 'submittedByUserId'), false)
})

test('review history is limited to the authenticated officer and paginated', async () => {
  state.reports.push(makeReport({
    id: 'reviewed-by-second-officer',
    status: 'VERIFIED',
    areaId: ids.area,
    hospitalId: ids.hospital,
    reviewedByMedicalOfficeId: 'office-b',
    lines: [{ diseaseId: ids.malaria, caseCount: 11 }],
  }))

  const firstPage = await request('/api/reports/history?status=ALL&page=1&limit=2', {
    userId: ids.officer,
  })
  const firstPageBody = await firstPage.json()

  assert.equal(firstPage.status, 200)
  assert.equal(firstPageBody.pagination.total, 4)
  assert.equal(firstPageBody.pagination.totalPages, 2)
  assert.equal(firstPageBody.reports.length, 2)
  assert.ok(firstPageBody.reports.every(({ status }) => ['VERIFIED', 'REJECTED'].includes(status)))
  assert.ok(firstPageBody.reports.every(({ reviewedAt, reviewNotes }) => reviewedAt && reviewNotes))
  assert.equal(firstPageBody.reports[0].lines[0].disease.name, 'Dengue')
  assert.equal(Object.hasOwn(firstPageBody.reports[0].lines[0], 'notes'), false)
  assert.equal(Object.hasOwn(firstPageBody.reports[0], 'submittedByUserId'), false)

  const secondOfficer = await request('/api/reports/history?status=ALL', {
    userId: ids.secondOfficer,
  })
  const secondOfficerBody = await secondOfficer.json()
  assert.equal(secondOfficer.status, 200)
  assert.deepEqual(secondOfficerBody.reports.map(({ id }) => id), ['reviewed-by-second-officer'])

  const rejectedOnly = await request('/api/reports/history?status=REJECTED', {
    userId: ids.officer,
  })
  const rejectedBody = await rejectedOnly.json()
  assert.equal(rejectedOnly.status, 200)
  assert.deepEqual(rejectedBody.reports.map(({ status }) => status), ['REJECTED'])

  const invalidFilter = await request('/api/reports/history?status=PENDING', {
    userId: ids.officer,
  })
  assert.equal(invalidFilter.status, 400)
})

test('review history requires a Medical Officer with an assigned office', async () => {
  const unauthenticated = await request('/api/reports/history')
  assert.equal(unauthenticated.status, 401)

  const wrongRole = await request('/api/reports/history', { userId: ids.publicUser })
  assert.equal(wrongRole.status, 403)

  delete state.offices[ids.officer]
  const noOffice = await request('/api/reports/history', { userId: ids.officer })
  assert.equal(noOffice.status, 403)
})

test('medical officers can verify pending reports and record the review', async () => {
  const response = await request('/api/reports/pending-review/review', {
    userId: ids.officer,
    method: 'PATCH',
    body: { status: 'VERIFIED', reviewNotes: 'Confirmed' },
  })
  const { report } = await response.json()

  assert.equal(response.status, 200)
  assert.equal(report.status, 'VERIFIED')
  assert.equal(report.reviewNotes, 'Confirmed')
  assert.ok(report.reviewedAt)
  assert.equal(state.reports.find(({ id }) => id === 'pending-review').reviewedByMedicalOfficeId, 'office-a')
  assert.equal(Object.hasOwn(report, 'reviewedByMedicalOfficeId'), false)
})

test('medical officers can reject pending reports', async () => {
  const response = await request('/api/reports/pending-review/review', {
    userId: ids.officer,
    method: 'PATCH',
    body: { status: 'REJECTED' },
  })
  const { report } = await response.json()

  assert.equal(response.status, 200)
  assert.equal(report.status, 'REJECTED')
})

test('reviewing an already reviewed report conflicts, including a second review attempt', async () => {
  const firstReview = await request('/api/reports/pending-review/review', {
    userId: ids.officer,
    method: 'PATCH',
    body: { status: 'VERIFIED' },
  })
  const secondReview = await request('/api/reports/pending-review/review', {
    userId: ids.officer,
    method: 'PATCH',
    body: { status: 'REJECTED' },
  })

  assert.equal(firstReview.status, 200)
  assert.equal(secondReview.status, 409)
})

test('concurrent officers cannot both review the same pending report', async () => {
  const [first, second] = await Promise.all([
    request('/api/reports/pending-review/review', {
      userId: ids.officer,
      method: 'PATCH',
      body: { status: 'VERIFIED' },
    }),
    request('/api/reports/pending-review/review', {
      userId: ids.secondOfficer,
      method: 'PATCH',
      body: { status: 'REJECTED' },
    }),
  ])
  const statuses = [first.status, second.status].sort()

  assert.deepEqual(statuses, [200, 409])
})

test('medical officers cannot review reports outside assigned areas', async () => {
  const response = await request('/api/reports/pending-outside/review', {
    userId: ids.officer,
    method: 'PATCH',
    body: { status: 'VERIFIED' },
  })

  assert.equal(response.status, 403)
})

test('public statistics include verified reports only and expose aggregates, not reports', async () => {
  const response = await request('/api/public/statistics')
  const body = await response.json()
  const dengueNorth = body.statistics.find((entry) => (
    entry.disease.id === ids.dengue && entry.area.id === ids.area
  ))

  assert.equal(response.status, 200)
  assert.equal(dengueNorth.totalCaseCount, 7)
  assert.deepEqual(Object.keys(dengueNorth).sort(), ['area', 'disease', 'totalCaseCount'])
  assert.equal(JSON.stringify(body).includes('submittedByUserId'), false)
  assert.equal(JSON.stringify(body).includes('reviewNotes'), false)
  assert.equal(JSON.stringify(body).includes('pending-review'), false)
  assert.equal(JSON.stringify(body).includes('rejected-a'), false)
})

test('public statistics apply area and disease filters', async () => {
  const areaResponse = await request(`/api/public/statistics?areaId=${ids.otherArea}`)
  const areaBody = await areaResponse.json()
  assert.equal(areaResponse.status, 200)
  assert.ok(areaBody.statistics.every(({ area }) => area.id === ids.otherArea))
  assert.equal(areaBody.statistics.find(({ disease }) => disease.id === ids.dengue).totalCaseCount, 5)

  const diseaseResponse = await request(`/api/public/statistics?diseaseId=${ids.malaria}`)
  const diseaseBody = await diseaseResponse.json()
  assert.equal(diseaseResponse.status, 200)
  assert.ok(diseaseBody.statistics.every(({ disease }) => disease.id === ids.malaria))
})

test('public statistics return an empty aggregate for filters with no verified reports', async () => {
  state.reports = state.reports.filter(({ status }) => status !== 'VERIFIED')
  const response = await request(`/api/public/statistics?areaId=${ids.area}`)

  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).statistics, [])
})
