const { createHash } = require('node:crypto')

const DEMO_NOTE_PREFIX = 'SYNTHETIC DEMO DATA: Rog Rakshak dashboard demo seed v1'
const MAX_DEMO_AREAS = 5
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const DEMO_NASHIK_HOSPITAL = {
  name: 'Rog Rakshak Synthetic Demo Hospital - Nashik',
  registrationNumber: 'RR-DEMO-NASHIK-001',
  address: 'Synthetic demo facility - not a real hospital',
}
const DEMO_NASHIK_SUBMITTER = {
  email: 'demo-hospital-nashik@rog-rakshak.test',
  firstName: 'Synthetic',
  lastName: 'Demo Hospital Submitter',
}
const DEMO_NASHIK_AREA_NAMES = ['DEMO - Nashik East', 'DEMO - Nashik West']

class DemoSeedError extends Error {}

function getDemoMarker(areaId, diseaseCode) {
  return `${DEMO_NOTE_PREFIX} [area=${areaId}; disease=${diseaseCode}]`
}

function getSyntheticValues(areaId, diseaseCode) {
  const digest = createHash('sha256').update(`${areaId}:${diseaseCode}`).digest()
  return {
    caseCount: 8 + (digest.readUInt32BE(0) % 25),
    daysAgo: 1 + (digest.readUInt32BE(4) % 14),
  }
}

async function ensureNashikDemoReferences(tx) {
  const nashikAreas = await tx.area.findMany({
    where: { name: 'Nashik City' },
    select: {
      districtId: true,
      district: { select: { name: true, state: { select: { code: true } } } },
    },
  })
  const nashikCity = nashikAreas.filter(({ district }) => (
    district.name === 'Nashik' && district.state.code === 'MH'
  ))
  if (nashikCity.length !== 1) {
    throw new DemoSeedError('Exactly one existing Nashik City area in Maharashtra is required.')
  }
  const districtId = nashikCity[0].districtId

  const hospitalRole = await tx.role.findUnique({
    where: { name: 'HOSPITAL' },
    select: { id: true },
  })
  if (!hospitalRole) {
    throw new DemoSeedError('The existing HOSPITAL role is required.')
  }

  const areas = []
  for (const name of DEMO_NASHIK_AREA_NAMES) {
    const existingArea = await tx.area.findUnique({
      where: { districtId_name: { districtId, name } },
      select: { id: true, name: true, districtId: true },
    })
    areas.push(existingArea || await tx.area.create({
      data: { districtId, name },
      select: { id: true, name: true, districtId: true },
    }))
  }

  const hospitalByRegistration = await tx.hospital.findUnique({
    where: { registrationNumber: DEMO_NASHIK_HOSPITAL.registrationNumber },
    select: { id: true, name: true, districtId: true, registrationNumber: true },
  })
  const hospitalByName = await tx.hospital.findFirst({
    where: { name: DEMO_NASHIK_HOSPITAL.name, districtId },
    select: { id: true, name: true, districtId: true, registrationNumber: true },
  })
  if (
    (hospitalByRegistration && (
      hospitalByRegistration.name !== DEMO_NASHIK_HOSPITAL.name ||
      hospitalByRegistration.districtId !== districtId
    )) ||
    (hospitalByName && hospitalByName.registrationNumber !== DEMO_NASHIK_HOSPITAL.registrationNumber) ||
    (hospitalByRegistration && hospitalByName && hospitalByRegistration.id !== hospitalByName.id)
  ) {
    throw new DemoSeedError('A reserved synthetic Nashik hospital identifier conflicts with existing data.')
  }
  const hospital = hospitalByRegistration || hospitalByName || await tx.hospital.create({
    data: {
      ...DEMO_NASHIK_HOSPITAL,
      districtId,
    },
    select: { id: true, name: true, districtId: true, registrationNumber: true },
  })

  const existingSubmitter = await tx.user.findUnique({
    where: { email: DEMO_NASHIK_SUBMITTER.email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: { select: { name: true } },
      medicalOffice: { select: { id: true } },
      hospitalMemberships: { select: { hospitalId: true } },
    },
  })
  if (existingSubmitter && (
    existingSubmitter.firstName !== DEMO_NASHIK_SUBMITTER.firstName ||
    existingSubmitter.lastName !== DEMO_NASHIK_SUBMITTER.lastName ||
    existingSubmitter.role.name !== 'HOSPITAL' ||
    existingSubmitter.medicalOffice ||
    existingSubmitter.hospitalMemberships.some(({ hospitalId: existingHospitalId }) => (
      existingHospitalId !== hospital.id
    ))
  )) {
    throw new DemoSeedError('The reserved synthetic Nashik submitter email conflicts with an existing account.')
  }
  const submitter = existingSubmitter || await tx.user.create({
    data: {
      ...DEMO_NASHIK_SUBMITTER,
      passwordHash: null,
      roleId: hospitalRole.id,
    },
    select: { id: true },
  })

  await tx.hospitalUser.upsert({
    where: { hospitalId_userId: { hospitalId: hospital.id, userId: submitter.id } },
    update: {},
    create: {
      hospitalId: hospital.id,
      userId: submitter.id,
      jobTitle: 'Synthetic demo report submitter',
    },
  })

  return { districtId, hospital, submitter, areas }
}

function buildDemoPlan({ diseases, areas, hospitals, medicalOffices }) {
  const activeDiseases = [...diseases]
    .filter((disease) => disease.code && disease.name)
    .sort((left, right) => left.code.localeCompare(right.code))
  if (activeDiseases.length < 2) {
    throw new DemoSeedError('At least two existing active diseases are required.')
  }

  const hospitalsByDistrict = new Map()
  for (const hospital of hospitals) {
    if (!hospital.districtId) continue
    const submitter = hospital.users
      .filter(({ user }) => user.role.name === 'HOSPITAL')
      .map(({ user }) => user)
      .sort((left, right) => left.email.localeCompare(right.email))[0]
    if (!submitter) continue

    const districtHospitals = hospitalsByDistrict.get(hospital.districtId) || []
    districtHospitals.push({ ...hospital, submitter })
    hospitalsByDistrict.set(hospital.districtId, districtHospitals)
  }

  const eligibleAreas = areas
    .filter((area) => hospitalsByDistrict.has(area.districtId))
    .sort((left, right) => (
      left.district.name.localeCompare(right.district.name) ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    ))
    .slice(0, MAX_DEMO_AREAS)
  if (eligibleAreas.length < 2) {
    throw new DemoSeedError('At least two existing areas with a hospital submitter in the same district are required.')
  }

  const areaIds = new Set(eligibleAreas.map(({ id }) => id))
  const officers = medicalOffices
    .filter(({ user }) => user.role.name === 'MEDICAL_OFFICER')
    .map((office) => ({
      ...office,
      assignedAreaIds: new Set(office.areas.map(({ areaId }) => areaId)),
    }))
    .sort((left, right) => {
      const leftCoverage = eligibleAreas.filter(({ id }) => left.assignedAreaIds.has(id)).length
      const rightCoverage = eligibleAreas.filter(({ id }) => right.assignedAreaIds.has(id)).length
      return rightCoverage - leftCoverage ||
        left.user.email.localeCompare(right.user.email) ||
        left.id.localeCompare(right.id)
    })
  const medicalOffice = officers[0]
  if (!medicalOffice) {
    throw new DemoSeedError('An existing Medical Officer account and Medical Office are required.')
  }

  const reports = []
  for (const area of eligibleAreas) {
    const hospital = hospitalsByDistrict.get(area.districtId)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))[0]
    for (const disease of activeDiseases) {
      const { caseCount, daysAgo } = getSyntheticValues(area.id, disease.code)
      reports.push({
        area,
        hospital,
        disease,
        caseCount,
        daysAgo,
        notes: getDemoMarker(area.id, disease.code),
      })
    }
  }

  return {
    areas: eligibleAreas,
    diseases: activeDiseases,
    medicalOffice,
    reports,
    areaIds,
  }
}

function getNewReports(reports, existingLines) {
  const existingByMarker = new Map()
  for (const line of existingLines) {
    const matches = existingByMarker.get(line.notes) || []
    matches.push(line)
    existingByMarker.set(line.notes, matches)
  }

  const newReports = []
  for (const report of reports) {
    const matches = existingByMarker.get(report.notes) || []
    if (matches.length > 1) {
      throw new DemoSeedError('A demo marker appears more than once; no reports were changed.')
    }
    if (matches.length === 0) {
      newReports.push(report)
      continue
    }

    const [existing] = matches
    if (
      existing.diseaseId !== report.disease.id ||
      existing.diseaseReport.areaId !== report.area.id ||
      existing.diseaseReport.hospitalId !== report.hospital.id ||
      existing.diseaseReport.submittedByUserId !== report.hospital.submitter.id
    ) {
      throw new DemoSeedError('An existing report conflicts with a demo marker; no reports were changed.')
    }
  }

  return newReports
}

async function seedDemoData(prisma, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const demoReferences = await ensureNashikDemoReferences(tx)
    const [diseases, areas, hospitals, medicalOffices] = await Promise.all([
      tx.disease.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      tx.area.findMany({
        orderBy: [{ district: { name: 'asc' } }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          districtId: true,
          district: { select: { name: true } },
        },
      }),
      tx.hospital.findMany({
        where: { districtId: { not: null } },
        select: {
          id: true,
          name: true,
          districtId: true,
          users: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  role: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      tx.medicalOffice.findMany({
        select: {
          id: true,
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              role: { select: { name: true } },
            },
          },
          areas: { select: { areaId: true } },
        },
      }),
    ])

    const plan = buildDemoPlan({ diseases, areas, hospitals, medicalOffices })
    const existingLines = await tx.diseaseReportLine.findMany({
      where: { notes: { in: plan.reports.map(({ notes }) => notes) } },
      select: {
        notes: true,
        diseaseId: true,
        caseCount: true,
        diseaseReport: {
          select: {
            areaId: true,
            hospitalId: true,
            submittedByUserId: true,
          },
        },
      },
    })
    const newReports = getNewReports(plan.reports, existingLines)

    const missingAreaAssignments = [...plan.areaIds]
      .filter((areaId) => !plan.medicalOffice.areas.some((area) => area.areaId === areaId))
      .map((areaId) => ({ medicalOfficeId: plan.medicalOffice.id, areaId }))
    if (missingAreaAssignments.length > 0) {
      await tx.medicalOfficeArea.createMany({
        data: missingAreaAssignments,
        skipDuplicates: true,
      })
    }

    for (const report of newReports) {
      await tx.diseaseReport.create({
        data: {
          submittedByUserId: report.hospital.submitter.id,
          hospitalId: report.hospital.id,
          areaId: report.area.id,
          status: 'PENDING',
          reportedAt: new Date(now.getTime() - report.daysAgo * MILLISECONDS_PER_DAY),
          lines: {
            create: {
              diseaseId: report.disease.id,
              caseCount: report.caseCount,
              notes: report.notes,
            },
          },
        },
        select: { id: true },
      })
    }

    return {
      created: newReports.length,
      skipped: plan.reports.length - newReports.length,
      areas: plan.areas,
      diseases: plan.diseases,
      medicalOfficer: plan.medicalOffice.user,
      demoHospital: demoReferences.hospital,
      demoSubmitter: DEMO_NASHIK_SUBMITTER,
    }
  })
}

async function runDemoSeed() {
  let prisma
  try {
    prisma = require('../src/config/prisma')
    const result = await seedDemoData(prisma)
    console.log(
      `Demo seed complete: created ${result.created} pending synthetic reports; ` +
      `skipped ${result.skipped} existing demo reports. ` +
      `Areas: ${result.areas.map(({ name, district }) => `${name} (${district.name})`).join(', ')}. ` +
      `Diseases: ${result.diseases.map(({ name }) => name).join(', ')}. ` +
      `Synthetic hospital: ${result.demoHospital.name}; ` +
      `synthetic submitter: ${result.demoSubmitter.email}. ` +
      `Reviewing Medical Officer: ${result.medicalOfficer.firstName} ${result.medicalOfficer.lastName} ` +
      `(${result.medicalOfficer.email}).`,
    )
  } catch (error) {
    const message = error instanceof DemoSeedError
      ? error.message
      : 'An unexpected database or seed error occurred. Verify connectivity and reference data; no credentials or secrets were printed.'
    console.error(`Demo data seed failed: ${message}`)
    process.exitCode = 1
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect()
      } catch {
        console.error('Demo data seed failed to disconnect from the database cleanly.')
        process.exitCode = 1
      }
    }
  }
}

if (require.main === module) {
  runDemoSeed()
}

module.exports = {
  buildDemoPlan,
  ensureNashikDemoReferences,
  getDemoMarker,
  getNewReports,
  seedDemoData,
}
