const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  buildDemoPlan,
  getDemoMarker,
  getNewReports,
  seedDemoData,
} = require('../prisma/seedDemoData')

function createReferences() {
  const diseases = [
    { id: 'dengue-id', code: 'DENGUE', name: 'Dengue' },
    { id: 'malaria-id', code: 'MALARIA', name: 'Malaria' },
  ]
  const areas = [
    { id: 'area-one', name: 'Area One', districtId: 'district-one', district: { name: 'District One' } },
    { id: 'area-two', name: 'Area Two', districtId: 'district-one', district: { name: 'District One' } },
    { id: 'area-without-hospital', name: 'Area Three', districtId: 'district-two', district: { name: 'District Two' } },
  ]
  const hospitals = [{
    id: 'hospital-one',
    name: 'Existing Hospital',
    districtId: 'district-one',
    users: [{
      user: {
        id: 'submitter-id',
        email: 'hospital@example.test',
        role: { name: 'HOSPITAL' },
      },
    }],
  }]
  const medicalOffices = [{
    id: 'medical-office-id',
    user: {
      email: 'officer@example.test',
      firstName: 'Demo',
      lastName: 'Officer',
      role: { name: 'MEDICAL_OFFICER' },
    },
    areas: [{ areaId: 'area-one' }],
  }]
  return { diseases, areas, hospitals, medicalOffices }
}

function createExpandedReferences() {
  const diseases = [
    { id: 'dengue-id', code: 'DENGUE', name: 'Dengue' },
    { id: 'malaria-id', code: 'MALARIA', name: 'Malaria' },
    { id: 'typhoid-id', code: 'TYPHOID', name: 'Typhoid' },
  ]
  const areas = [
    { id: 'nashik-east', name: 'DEMO - Nashik East', districtId: 'nashik-district', district: { name: 'Nashik' } },
    { id: 'nashik-west', name: 'DEMO - Nashik West', districtId: 'nashik-district', district: { name: 'Nashik' } },
    { id: 'nashik-city', name: 'Nashik City', districtId: 'nashik-district', district: { name: 'Nashik' } },
    { id: 'haveli', name: 'Haveli', districtId: 'pune-district', district: { name: 'Pune' } },
    { id: 'pune-city', name: 'Pune City', districtId: 'pune-district', district: { name: 'Pune' } },
  ]
  const hospitals = [
    {
      id: 'pune-hospital',
      name: 'Existing Pune Hospital',
      districtId: 'pune-district',
      users: [{ user: { id: 'pune-submitter', email: 'pune@example.test', role: { name: 'HOSPITAL' } } }],
    },
    {
      id: 'nashik-demo-hospital',
      name: 'Rog Rakshak Synthetic Demo Hospital - Nashik',
      districtId: 'nashik-district',
      users: [{ user: { id: 'nashik-submitter', email: 'demo-hospital-nashik@rog-rakshak.test', role: { name: 'HOSPITAL' } } }],
    },
  ]
  const medicalOffices = [{
    id: 'medical-office-id',
    user: {
      email: 'officer@example.test',
      firstName: 'Demo',
      lastName: 'Officer',
      role: { name: 'MEDICAL_OFFICER' },
    },
    areas: [{ areaId: 'pune-city' }, { areaId: 'haveli' }],
  }]
  return { diseases, areas, hospitals, medicalOffices }
}

function createSeedDatabaseMock() {
  const diseases = [
    { id: 'dengue-id', code: 'DENGUE', name: 'Dengue' },
    { id: 'malaria-id', code: 'MALARIA', name: 'Malaria' },
    { id: 'typhoid-id', code: 'TYPHOID', name: 'Typhoid' },
  ]
  const districts = {
    'pune-district': { id: 'pune-district', name: 'Pune', state: { code: 'MH' } },
    'nashik-district': { id: 'nashik-district', name: 'Nashik', state: { code: 'MH' } },
  }
  const state = {
    areas: [
      { id: 'pune-city', name: 'Pune City', districtId: 'pune-district' },
      { id: 'haveli', name: 'Haveli', districtId: 'pune-district' },
      { id: 'nashik-city', name: 'Nashik City', districtId: 'nashik-district' },
    ],
    hospitals: [{
      id: 'pune-hospital',
      name: 'Existing Pune Hospital',
      registrationNumber: 'RR-PUNE-001',
      districtId: 'pune-district',
    }],
    users: [{
      id: 'pune-submitter',
      email: 'pune@example.test',
      firstName: 'Pune',
      lastName: 'Submitter',
      role: { name: 'HOSPITAL' },
      medicalOffice: null,
    }],
    memberships: [{ hospitalId: 'pune-hospital', userId: 'pune-submitter' }],
    medicalOffices: [
      {
        id: 'office-example',
        user: {
          email: 'rr-test-officer@example.test',
          firstName: 'Test',
          lastName: 'Officer',
          role: { name: 'MEDICAL_OFFICER' },
        },
        areas: [{ areaId: 'pune-city' }, { areaId: 'haveli' }],
      },
      {
        id: 'office-second',
        user: {
          email: 'rr-test-officer@rog-rakshak.test',
          firstName: 'Test',
          lastName: 'Officer',
          role: { name: 'MEDICAL_OFFICER' },
        },
        areas: [{ areaId: 'pune-city' }],
      },
    ],
    reports: [],
  }
  const originalReportCases = [
    [8, 19, 30],
    [15, 26, 12],
  ]
  for (const [areaIndex, areaId] of ['haveli', 'pune-city'].entries()) {
    diseases.forEach((disease, diseaseIndex) => {
      state.reports.push({
        id: `existing-${areaId}-${disease.code}`,
        areaId,
        hospitalId: 'pune-hospital',
        submittedByUserId: 'pune-submitter',
        status: areaId === 'pune-city' && disease.code === 'TYPHOID' ? 'VERIFIED' : 'PENDING',
        lines: [{
          diseaseId: disease.id,
          caseCount: originalReportCases[areaIndex][diseaseIndex],
          notes: getDemoMarker(areaId, disease.code),
        }],
      })
    })
  }

  const tx = {
    role: {
      findUnique: async ({ where }) => (
        where.name === 'HOSPITAL' ? { id: 'hospital-role' } : null
      ),
    },
    area: {
      findMany: async ({ where } = {}) => state.areas
        .filter((area) => !where?.name || area.name === where.name)
        .map((area) => ({
          ...area,
          district: districts[area.districtId],
        })),
      findUnique: async ({ where }) => {
        const area = state.areas.find(({ districtId, name }) => (
          districtId === where.districtId_name.districtId &&
          name === where.districtId_name.name
        ))
        return area || null
      },
      create: async ({ data }) => {
        const area = { id: `area-${state.areas.length}`, ...data }
        state.areas.push(area)
        return area
      },
    },
    hospital: {
      findUnique: async ({ where }) => state.hospitals.find(
        ({ registrationNumber }) => registrationNumber === where.registrationNumber,
      ) || null,
      findFirst: async ({ where }) => state.hospitals.find(
        ({ name, districtId }) => name === where.name && districtId === where.districtId,
      ) || null,
      create: async ({ data }) => {
        const hospital = { id: `hospital-${state.hospitals.length}`, ...data }
        state.hospitals.push(hospital)
        return hospital
      },
      findMany: async () => state.hospitals.map((hospital) => ({
        ...hospital,
        users: state.memberships
          .filter(({ hospitalId }) => hospitalId === hospital.id)
          .map(({ userId }) => ({ user: state.users.find(({ id }) => id === userId) })),
      })),
    },
    user: {
      findUnique: async ({ where }) => {
        const user = state.users.find(({ email }) => email === where.email)
        if (!user) return null
        return {
          ...user,
          hospitalMemberships: state.memberships.filter(({ userId }) => userId === user.id),
        }
      },
      create: async ({ data }) => {
        const user = {
          id: `user-${state.users.length}`,
          ...data,
          role: { name: 'HOSPITAL' },
          medicalOffice: null,
        }
        state.users.push(user)
        return { id: user.id }
      },
    },
    hospitalUser: {
      upsert: async ({ where, create }) => {
        const membership = state.memberships.find(({ hospitalId, userId }) => (
          hospitalId === where.hospitalId_userId.hospitalId &&
          userId === where.hospitalId_userId.userId
        ))
        if (membership) return membership
        state.memberships.push(create)
        return create
      },
    },
    disease: {
      findMany: async () => diseases,
    },
    medicalOffice: {
      findMany: async () => state.medicalOffices,
    },
    medicalOfficeArea: {
      createMany: async ({ data }) => {
        for (const assignment of data) {
          const office = state.medicalOffices.find(({ id }) => id === assignment.medicalOfficeId)
          if (!office.areas.some(({ areaId }) => areaId === assignment.areaId)) {
            office.areas.push({ areaId: assignment.areaId })
          }
        }
      },
    },
    diseaseReportLine: {
      findMany: async ({ where }) => state.reports.flatMap((report) => report.lines
        .filter(({ notes }) => where.notes.in.includes(notes))
        .map((line) => ({
          ...line,
          diseaseReport: {
            areaId: report.areaId,
            hospitalId: report.hospitalId,
            submittedByUserId: report.submittedByUserId,
          },
        }))),
    },
    diseaseReport: {
      create: async ({ data }) => {
        state.reports.push({
          id: `created-${state.reports.length}`,
          areaId: data.areaId,
          hospitalId: data.hospitalId,
          submittedByUserId: data.submittedByUserId,
          status: data.status,
          lines: [{ ...data.lines.create }],
        })
      },
    },
  }

  return {
    state,
    prisma: { $transaction: (callback) => callback(tx) },
  }
}

test('demo plan uses existing hospital-served areas and active diseases only', () => {
  const plan = buildDemoPlan(createReferences())

  assert.equal(plan.reports.length, 4)
  assert.deepEqual(plan.areas.map(({ id }) => id), ['area-one', 'area-two'])
  assert.deepEqual(plan.reports.map(({ disease }) => disease.code), [
    'DENGUE',
    'MALARIA',
    'DENGUE',
    'MALARIA',
  ])
  assert.ok(plan.reports.every(({ hospital }) => hospital.id === 'hospital-one'))
  assert.ok(plan.reports.every(({ caseCount }) => caseCount >= 8 && caseCount <= 32))
  assert.ok(plan.reports.every(({ notes }) => notes.startsWith('SYNTHETIC DEMO DATA:')))
  assert.deepEqual([...plan.areaIds], ['area-one', 'area-two'])
})

test('expanded demo plan covers five valid areas with their district hospitals', () => {
  const plan = buildDemoPlan(createExpandedReferences())

  assert.equal(plan.areas.length, 5)
  assert.equal(plan.diseases.length, 3)
  assert.equal(plan.reports.length, 15)
  assert.ok(plan.reports.every(({ area, hospital }) => area.districtId === hospital.districtId))
  assert.deepEqual(
    plan.areas.map(({ name }) => name).sort(),
    ['DEMO - Nashik East', 'DEMO - Nashik West', 'Haveli', 'Nashik City', 'Pune City'].sort(),
  )
})

test('demo plan fails when suitable existing reference records are unavailable', () => {
  assert.throws(() => buildDemoPlan({
    ...createReferences(),
    diseases: [{ id: 'only-disease', code: 'ONE', name: 'One' }],
  }), /At least two existing active diseases/)
  assert.throws(() => buildDemoPlan({
    ...createReferences(),
    hospitals: [],
  }), /At least two existing areas/)
})

test('demo markers make repeats skip existing reports without changing their status', () => {
  const plan = buildDemoPlan(createReferences())
  const report = plan.reports[0]
  const existingLines = [{
    notes: getDemoMarker(report.area.id, report.disease.code),
    diseaseId: report.disease.id,
    caseCount: report.caseCount,
    diseaseReport: {
      areaId: report.area.id,
      hospitalId: report.hospital.id,
      submittedByUserId: report.hospital.submitter.id,
      status: 'VERIFIED',
    },
  }]

  const missingReports = getNewReports(plan.reports, existingLines)

  assert.equal(missingReports.length, plan.reports.length - 1)
  assert.ok(!missingReports.some(({ notes }) => notes === existingLines[0].notes))
})

test('demo markers preserve existing report counts but reject mismatched references', () => {
  const report = buildDemoPlan(createReferences()).reports[0]
  const existingLine = {
    notes: report.notes,
    diseaseId: report.disease.id,
    caseCount: report.caseCount,
    diseaseReport: {
      areaId: report.area.id,
      hospitalId: report.hospital.id,
      submittedByUserId: report.hospital.submitter.id,
    },
  }

  assert.throws(() => getNewReports([report], [existingLine, existingLine]), /appears more than once/)
  const existingWithDifferentCount = {
    ...existingLine,
    caseCount: existingLine.caseCount + 1,
  }
  assert.deepEqual(getNewReports([report], [existingWithDifferentCount]), [])
  assert.throws(() => getNewReports([report], [{
    ...existingLine,
    diseaseReport: { ...existingLine.diseaseReport, areaId: 'different-area' },
  }]), /conflicts with a demo marker/)
})

test('demo seeding creates references and nine pending reports once, preserving existing reports', async () => {
  const { prisma, state } = createSeedDatabaseMock()
  const originalReports = state.reports.map((report) => ({
    id: report.id,
    status: report.status,
    areaId: report.areaId,
    hospitalId: report.hospitalId,
    submittedByUserId: report.submittedByUserId,
    lines: report.lines.map(({ diseaseId, caseCount, notes }) => ({ diseaseId, caseCount, notes })),
  }))
  const originalSecondOfficerAreas = state.medicalOffices[1].areas.map(({ areaId }) => areaId)

  const firstRun = await seedDemoData(prisma, new Date('2026-11-20T12:00:00.000Z'))

  assert.equal(firstRun.created, 9)
  assert.equal(firstRun.skipped, 6)
  assert.equal(state.reports.length, 15)
  assert.deepEqual(state.reports.slice(0, 6).map((report) => ({
    id: report.id,
    status: report.status,
    areaId: report.areaId,
    hospitalId: report.hospitalId,
    submittedByUserId: report.submittedByUserId,
    lines: report.lines.map(({ diseaseId, caseCount, notes }) => ({ diseaseId, caseCount, notes })),
  })), originalReports)
  assert.ok(state.reports.slice(6).every(({ status }) => status === 'PENDING'))
  assert.equal(state.hospitals.length, 2)
  assert.equal(state.hospitals[1].districtId, 'nashik-district')
  assert.match(state.hospitals[1].name, /Synthetic Demo/)
  assert.equal(state.users.length, 2)
  assert.equal(state.users[1].passwordHash, null)
  assert.equal(state.memberships.length, 2)
  assert.equal(state.medicalOffices[0].areas.length, 5)
  assert.deepEqual(state.medicalOffices[1].areas.map(({ areaId }) => areaId), originalSecondOfficerAreas)

  const secondRun = await seedDemoData(prisma, new Date('2026-11-20T12:00:00.000Z'))

  assert.equal(secondRun.created, 0)
  assert.equal(secondRun.skipped, 15)
  assert.equal(state.reports.length, 15)
  assert.equal(state.areas.length, 5)
  assert.equal(state.hospitals.length, 2)
  assert.equal(state.users.length, 2)
  assert.equal(state.memberships.length, 2)
})