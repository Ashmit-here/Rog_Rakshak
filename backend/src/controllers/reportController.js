const prisma = require('../config/prisma')

const MAX_DISEASES_PER_REPORT = 100
const MAX_NOTES_LENGTH = 2000
const MAX_PAGE = 1_000_000
const MAX_PAGE_SIZE = 100

const reportSelect = {
  id: true,
  status: true,
  reportedAt: true,
  createdAt: true,
  area: {
    select: {
      id: true,
      name: true,
      district: { select: { id: true, name: true } },
    },
  },
  hospital: { select: { id: true, name: true } },
  lines: {
    select: {
      id: true,
      caseCount: true,
      notes: true,
      disease: { select: { id: true, name: true } },
    },
  },
}

const reviewedReportSelect = {
  ...reportSelect,
  reviewedAt: true,
  reviewNotes: true,
}

const reviewHistorySelect = {
  id: true,
  status: true,
  reportedAt: true,
  reviewedAt: true,
  reviewNotes: true,
  area: {
    select: {
      id: true,
      name: true,
      district: { select: { id: true, name: true } },
    },
  },
  hospital: { select: { id: true, name: true } },
  lines: {
    select: {
      id: true,
      caseCount: true,
      disease: { select: { id: true, name: true } },
    },
  },
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseReportedAt(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)
  ) {
    return null
  }

  const datePart = value.slice(0, 10)
  const date = new Date(value)
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(`${datePart}T00:00:00.000Z`).toISOString().slice(0, 10) !== datePart
  ) {
    return null
  }

  return date
}

function parsePagination(query) {
  function parseValue(value, fallback, maximum) {
    if (value === undefined) return fallback
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null

    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null
  }

  const page = parseValue(query.page, 1, MAX_PAGE)
  const limit = parseValue(query.limit, 20, MAX_PAGE_SIZE)
  if (page === null || limit === null) return null

  return { page, limit, skip: (page - 1) * limit }
}

function paginationResponse(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}

function parseOptionalFilter(query, name) {
  const value = query[name]
  if (value === undefined) return { valid: true, value: undefined }
  if (typeof value !== 'string' || !value.trim() || value.length > 191) {
    return { valid: false }
  }
  return { valid: true, value: value.trim() }
}

function parseReviewHistoryStatus(value) {
  if (value === undefined || value === 'ALL') return { valid: true }
  if (value === 'VERIFIED' || value === 'REJECTED') {
    return { valid: true, value }
  }
  return { valid: false }
}

function validateSubmission(body) {
  if (!isObject(body)) return { error: 'A report object is required' }
  if (Object.hasOwn(body, 'status')) return { error: 'Report status is assigned by the server' }

  const areaId = typeof body.areaId === 'string' ? body.areaId.trim() : ''
  if (!areaId || areaId.length > 191) return { error: 'A valid areaId is required' }

  if (
    Object.hasOwn(body, 'hospitalId') &&
    (typeof body.hospitalId !== 'string' || !body.hospitalId.trim() || body.hospitalId.length > 191)
  ) {
    return { error: 'A valid hospitalId is required' }
  }

  const reportedAt = parseReportedAt(body.reportedAt)
  if (!reportedAt) return { error: 'reportedAt must be a valid ISO date or timestamp' }

  if (
    !Array.isArray(body.diseases) ||
    body.diseases.length === 0 ||
    body.diseases.length > MAX_DISEASES_PER_REPORT
  ) {
    return { error: `diseases must contain between 1 and ${MAX_DISEASES_PER_REPORT} entries` }
  }

  const diseases = []
  const diseaseIds = new Set()
  for (const entry of body.diseases) {
    if (!isObject(entry)) return { error: 'Each disease entry must be an object' }

    const diseaseId = typeof entry.diseaseId === 'string' ? entry.diseaseId.trim() : ''
    if (!diseaseId || diseaseId.length > 191) {
      return { error: 'Each disease entry requires a valid diseaseId' }
    }
    if (diseaseIds.has(diseaseId)) {
      return { error: 'Duplicate diseases are not allowed in one report' }
    }
    diseaseIds.add(diseaseId)

    if (
      !Number.isSafeInteger(entry.caseCount) ||
      entry.caseCount <= 0 ||
      entry.caseCount > 2_147_483_647
    ) {
      return { error: 'Each caseCount must be a positive integer' }
    }

    if (
      entry.notes !== undefined &&
      (typeof entry.notes !== 'string' || entry.notes.length > MAX_NOTES_LENGTH)
    ) {
      return { error: `Disease notes must be text no longer than ${MAX_NOTES_LENGTH} characters` }
    }

    diseases.push({
      diseaseId,
      caseCount: entry.caseCount,
      notes: entry.notes?.trim() || null,
    })
  }

  const hospitalId = Object.hasOwn(body, 'hospitalId') ? body.hospitalId.trim() : undefined
  return { value: { areaId, reportedAt, diseases, hospitalId } }
}

async function submitReport(req, res, next) {
  const validation = validateSubmission(req.body)
  if (validation.error) return res.status(400).json({ error: validation.error })

  const { areaId, reportedAt, diseases, hospitalId } = validation.value

  try {
    const result = await prisma.$transaction(async (tx) => {
      const memberships = await tx.hospitalUser.findMany({
        where: { userId: req.user.id },
        select: {
          hospitalId: true,
          hospital: { select: { id: true, districtId: true } },
        },
      })
      if (memberships.length === 0) {
        return { status: 403, error: 'You do not belong to a hospital' }
      }

      const area = await tx.area.findUnique({
        where: { id: areaId },
        select: { id: true, districtId: true },
      })
      if (!area) return { status: 404, error: 'Area not found' }

      let eligibleMemberships = memberships
      if (hospitalId) {
        eligibleMemberships = memberships.filter(({ hospitalId: memberHospitalId }) => (
          memberHospitalId === hospitalId
        ))
        if (eligibleMemberships.length === 0) {
          return { status: 403, error: 'You do not belong to the specified hospital' }
        }
      } else {
        eligibleMemberships = memberships.filter(({ hospital }) => (
          hospital.districtId === area.districtId
        ))
        if (eligibleMemberships.length === 0) {
          if (memberships.every(({ hospital }) => !hospital.districtId)) {
            return { status: 400, error: 'Your hospital must have a valid district' }
          }
          return { status: 400, error: 'The selected area must belong to your hospital district' }
        }
        if (eligibleMemberships.length > 1) {
          return { status: 400, error: 'hospitalId is required when multiple memberships match the area' }
        }
      }

      const membership = eligibleMemberships[0]
      if (!membership.hospital.districtId) {
        return { status: 400, error: 'Your hospital must have a valid district' }
      }
      if (membership.hospital.districtId !== area.districtId) {
        return { status: 400, error: 'The selected area must belong to your hospital district' }
      }

      const activeDiseases = await tx.disease.findMany({
        where: { id: { in: diseases.map(({ diseaseId }) => diseaseId) }, isActive: true },
        select: { id: true },
      })
      if (activeDiseases.length !== diseases.length) {
        return { status: 400, error: 'One or more diseases are missing or inactive' }
      }

      const report = await tx.diseaseReport.create({
        data: {
          submittedByUserId: req.user.id,
          hospitalId: membership.hospitalId,
          areaId,
          reportedAt,
          status: 'PENDING',
          lines: {
            create: diseases.map(({ diseaseId, caseCount, notes }) => ({
              diseaseId,
              caseCount,
              notes,
            })),
          },
        },
        select: reportSelect,
      })
      return { report }
    })

    if (result.error) return res.status(result.status).json({ error: result.error })
    return res.status(201).json({ report: result.report })
  } catch (error) {
    return next(error)
  }
}

async function getMine(req, res, next) {
  const pagination = parsePagination(req.query)
  if (!pagination) return res.status(400).json({ error: 'Invalid page or limit' })

  try {
    const memberships = await prisma.hospitalUser.findMany({
      where: { userId: req.user.id },
      select: {
        hospitalId: true,
        hospital: { select: { id: true, name: true } },
      },
    })
    const hospitalIds = memberships.map(({ hospitalId }) => hospitalId)

    if (req.query.hospitalId !== undefined) {
      const hospitalId = parseOptionalFilter(req.query, 'hospitalId')
      if (!hospitalId.valid) return res.status(400).json({ error: 'Invalid hospitalId' })
      if (!hospitalIds.includes(hospitalId.value)) {
        return res.status(403).json({ error: 'You do not belong to the specified hospital' })
      }
    }

    if (hospitalIds.length === 0) {
      return res.status(200).json({
        reports: [],
        pagination: paginationResponse(pagination.page, pagination.limit, 0),
      })
    }

    const where = {
      hospitalId: {
        in: req.query.hospitalId === undefined
          ? hospitalIds
          : [req.query.hospitalId.trim()],
      },
    }
    const [reports, total] = await Promise.all([
      prisma.diseaseReport.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ reportedAt: 'desc' }, { id: 'asc' }],
        select: reviewedReportSelect,
      }),
      prisma.diseaseReport.count({ where }),
    ])

    return res.status(200).json({
      reports,
      pagination: paginationResponse(pagination.page, pagination.limit, total),
    })
  } catch (error) {
    return next(error)
  }
}

async function getPending(req, res, next) {
  const pagination = parsePagination(req.query)
  if (!pagination) return res.status(400).json({ error: 'Invalid page or limit' })

  try {
    const office = await prisma.medicalOffice.findUnique({
      where: { userId: req.user.id },
      select: { id: true, areas: { select: { areaId: true } } },
    })
    if (!office) return res.status(403).json({ error: 'No medical office is assigned to this user' })

    const areaIds = office.areas.map(({ areaId }) => areaId)
    if (areaIds.length === 0) {
      return res.status(200).json({
        reports: [],
        pagination: paginationResponse(pagination.page, pagination.limit, 0),
      })
    }

    const where = { status: 'PENDING', areaId: { in: areaIds } }
    const [reports, total] = await Promise.all([
      prisma.diseaseReport.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ reportedAt: 'asc' }, { id: 'asc' }],
        select: reportSelect,
      }),
      prisma.diseaseReport.count({ where }),
    ])

    return res.status(200).json({
      reports,
      pagination: paginationResponse(pagination.page, pagination.limit, total),
    })
  } catch (error) {
    return next(error)
  }
}

async function getReviewHistory(req, res, next) {
  const pagination = parsePagination(req.query)
  if (!pagination) return res.status(400).json({ error: 'Invalid page or limit' })

  const statusFilter = parseReviewHistoryStatus(req.query.status)
  if (!statusFilter.valid) {
    return res.status(400).json({ error: 'status must be ALL, VERIFIED, or REJECTED' })
  }

  try {
    const office = await prisma.medicalOffice.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    })
    if (!office) return res.status(403).json({ error: 'No medical office is assigned to this user' })

    const where = {
      reviewedByMedicalOfficeId: office.id,
      status: statusFilter.value || { in: ['VERIFIED', 'REJECTED'] },
    }
    const [reports, total] = await Promise.all([
      prisma.diseaseReport.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ reviewedAt: 'desc' }, { id: 'asc' }],
        select: reviewHistorySelect,
      }),
      prisma.diseaseReport.count({ where }),
    ])

    return res.status(200).json({
      reports,
      pagination: paginationResponse(pagination.page, pagination.limit, total),
    })
  } catch (error) {
    return next(error)
  }
}

async function reviewReport(req, res, next) {
  const { status, reviewNotes } = req.body || {}
  if (!isObject(req.body) || !['VERIFIED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'status must be VERIFIED or REJECTED' })
  }
  if (
    reviewNotes !== undefined &&
    reviewNotes !== null &&
    (typeof reviewNotes !== 'string' || reviewNotes.length > MAX_NOTES_LENGTH)
  ) {
    return res.status(400).json({ error: `reviewNotes must be text no longer than ${MAX_NOTES_LENGTH} characters` })
  }

  const reportId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  if (!reportId || reportId.length > 191) return res.status(400).json({ error: 'A valid report ID is required' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const office = await tx.medicalOffice.findUnique({
        where: { userId: req.user.id },
        select: { id: true, areas: { select: { areaId: true } } },
      })
      if (!office) return { statusCode: 403, error: 'No medical office is assigned to this user' }

      const areaIds = office.areas.map(({ areaId }) => areaId)
      const update = await tx.diseaseReport.updateMany({
        where: {
          id: reportId,
          status: 'PENDING',
          areaId: { in: areaIds },
        },
        data: {
          status,
          reviewedByMedicalOfficeId: office.id,
          reviewedAt: new Date(),
          reviewNotes: typeof reviewNotes === 'string' ? reviewNotes.trim() || null : null,
        },
      })

      if (update.count === 0) {
        const existing = await tx.diseaseReport.findUnique({
          where: { id: reportId },
          select: { id: true, areaId: true, status: true },
        })
        if (!existing) return { statusCode: 404, error: 'Report not found' }
        if (!areaIds.includes(existing.areaId)) {
          return { statusCode: 403, error: 'This report is outside your assigned areas' }
        }
        return { statusCode: 409, error: 'Only pending reports can be reviewed' }
      }

      const report = await tx.diseaseReport.findUnique({
        where: { id: reportId },
        select: reviewedReportSelect,
      })
      return { report }
    })

    if (result.error) return res.status(result.statusCode).json({ error: result.error })
    return res.status(200).json({ report: result.report })
  } catch (error) {
    return next(error)
  }
}

async function getReferenceData(req, res, next) {
  try {
    const [diseases, areas] = await Promise.all([
      prisma.disease.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
      prisma.area.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          district: { select: { name: true } },
        },
      }),
    ])

    return res.status(200).json({ diseases, areas })
  } catch (error) {
    return next(error)
  }
}

async function getPublicStatistics(req, res, next) {
  const areaFilter = parseOptionalFilter(req.query, 'areaId')
  const diseaseFilter = parseOptionalFilter(req.query, 'diseaseId')
  if (!areaFilter.valid || !diseaseFilter.valid) {
    return res.status(400).json({ error: 'Invalid areaId or diseaseId' })
  }

  try {
    const [area, disease] = await Promise.all([
      areaFilter.value
        ? prisma.area.findUnique({ where: { id: areaFilter.value }, select: { id: true } })
        : null,
      diseaseFilter.value
        ? prisma.disease.findUnique({ where: { id: diseaseFilter.value }, select: { id: true } })
        : null,
    ])
    if (areaFilter.value && !area) return res.status(404).json({ error: 'Area not found' })
    if (diseaseFilter.value && !disease) return res.status(404).json({ error: 'Disease not found' })

    const lineGroups = await prisma.diseaseReportLine.groupBy({
      by: ['diseaseId', 'diseaseReportId'],
      where: {
        diseaseReport: {
          is: {
            status: 'VERIFIED',
            ...(areaFilter.value ? { areaId: areaFilter.value } : {}),
          },
        },
        ...(diseaseFilter.value ? { diseaseId: diseaseFilter.value } : {}),
      },
      _sum: { caseCount: true },
    })

    if (lineGroups.length === 0) return res.status(200).json({ statistics: [] })

    const diseaseIds = [...new Set(lineGroups.map(({ diseaseId }) => diseaseId))]
    const reportIds = [...new Set(lineGroups.map(({ diseaseReportId }) => diseaseReportId))]
    const [diseases, reports] = await Promise.all([
      prisma.disease.findMany({
        where: { id: { in: diseaseIds } },
        select: { id: true, name: true },
      }),
      prisma.diseaseReport.findMany({
        where: { id: { in: reportIds }, status: 'VERIFIED' },
        select: { id: true, area: { select: { id: true, name: true } } },
      }),
    ])

    const diseaseById = new Map(diseases.map((item) => [item.id, item]))
    const areaByReportId = new Map(reports.map((report) => [report.id, report.area]))
    const totals = new Map()
    for (const group of lineGroups) {
      const diseaseInfo = diseaseById.get(group.diseaseId)
      const reportArea = areaByReportId.get(group.diseaseReportId)
      if (!diseaseInfo || !reportArea) continue

      const key = `${group.diseaseId}\u0000${reportArea.id}`
      const aggregate = totals.get(key) || {
        disease: { id: diseaseInfo.id, name: diseaseInfo.name },
        area: reportArea,
        totalCaseCount: 0,
      }
      aggregate.totalCaseCount += group._sum.caseCount || 0
      totals.set(key, aggregate)
    }

    return res.status(200).json({
      statistics: [...totals.values()].sort((left, right) => (
        left.disease.name.localeCompare(right.disease.name) ||
        left.area.name.localeCompare(right.area.name)
      )),
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getMine,
  getPending,
  getPublicStatistics,
  getReferenceData,
  getReviewHistory,
  reviewReport,
  submitReport,
}