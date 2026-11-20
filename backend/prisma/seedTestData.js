const bcrypt = require('bcryptjs')
const { createHash } = require('node:crypto')

const TEST_HOSPITAL_REGISTRATION = 'RR-TEST-PUNE-001'
const TEST_HOSPITAL_NAME = 'Rog Rakshak Test Hospital - Pune'
const TEST_MEDICAL_OFFICE_CODE_PREFIX = 'RR-TEST-MO-'
const TEST_HOSPITAL_USER_NAME = { firstName: 'Test', lastName: 'Hospital User' }
const TEST_OFFICER_USER_NAME = { firstName: 'Test', lastName: 'Medical Officer' }

class TestSeedError extends Error {}

function getTestMedicalOfficeCode(officerEmail) {
  const emailHash = createHash('sha256').update(officerEmail).digest('hex').slice(0, 32).toUpperCase()
  return `${TEST_MEDICAL_OFFICE_CODE_PREFIX}${emailHash}`
}

function assertSafeDatabaseUrl(connectionString) {
  let url
  try {
    url = new URL(connectionString)
  } catch {
    throw new TestSeedError('DATABASE_URL must be a PostgreSQL URL for the local Rog Rakshak database.')
  }

  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
  const hasHostOverride = [...url.searchParams.keys()].some((key) => (
    ['host', 'hostaddr', 'socket'].includes(key.toLowerCase())
  ))

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !allowedHosts.has(url.hostname.toLowerCase()) ||
    databaseName !== 'rog_rakshak' ||
    hasHostOverride
  ) {
    throw new TestSeedError('DATABASE_URL must target local PostgreSQL database "rog_rakshak" without host overrides.')
  }
}

function readConfiguration(environment) {
  const hospitalEmail = environment.TEST_HOSPITAL_EMAIL?.trim().toLowerCase()
  const hospitalPassword = environment.TEST_HOSPITAL_PASSWORD
  const officerEmail = environment.TEST_MEDICAL_OFFICER_EMAIL?.trim().toLowerCase()
  const officerPassword = environment.TEST_MEDICAL_OFFICER_PASSWORD
  const adminEmail = environment.SEED_ADMIN_EMAIL?.trim().toLowerCase()

  assertSafeDatabaseUrl(environment.DATABASE_URL)

  for (const [name, value] of [
    ['TEST_HOSPITAL_EMAIL', hospitalEmail],
    ['TEST_HOSPITAL_PASSWORD', hospitalPassword],
    ['TEST_MEDICAL_OFFICER_EMAIL', officerEmail],
    ['TEST_MEDICAL_OFFICER_PASSWORD', officerPassword],
  ]) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new TestSeedError(`${name} must be set.`)
    }
  }

  function validateTestEmail(email, roleName) {
    const [localPart, domain, ...extraParts] = email.split('@')
    if (
      extraParts.length > 0 ||
      !localPart ||
      !domain ||
      !/^[^\s@]+$/.test(localPart) ||
      !/^[^\s@]+\.[^\s@]+$/.test(domain) ||
      !localPart.includes('test') ||
      !localPart.includes(roleName)
    ) {
      throw new TestSeedError(`${roleName} test email must be valid and clearly identify a test ${roleName} account.`)
    }
  }

  validateTestEmail(hospitalEmail, 'hospital')
  validateTestEmail(officerEmail, 'officer')

  if (hospitalEmail === officerEmail) {
    throw new TestSeedError('Hospital and medical officer test emails must be different.')
  }
  if (adminEmail && [hospitalEmail, officerEmail].includes(adminEmail)) {
    throw new TestSeedError('Test account emails must not match SEED_ADMIN_EMAIL.')
  }
  if (hospitalPassword.trim().length < 12 || officerPassword.trim().length < 12) {
    throw new TestSeedError('Test account passwords must be at least 12 characters long.')
  }

  return { hospitalEmail, hospitalPassword, officerEmail, officerPassword }
}

function assertOfficeCodeAvailable(owner, expectedUserId) {
  if (owner && owner.userId !== expectedUserId) {
    throw new TestSeedError('Generated test medical office code is already owned by another user; refusing to modify it.')
  }
}

function assertOwnedTestUser(user, expectedRole, expectedName, hospitalId, medicalOfficeCode) {
  if (!user) return
  if (user.role.name === 'ADMIN') {
    throw new TestSeedError('A test email belongs to an ADMIN account; refusing to modify it.')
  }
  if (
    user.role.name !== expectedRole ||
    user.firstName !== expectedName.firstName ||
    user.lastName !== expectedName.lastName
  ) {
    throw new TestSeedError('A test email already belongs to a non-test or differently configured user; refusing to modify it.')
  }

  if (
    expectedRole === 'HOSPITAL' &&
    (
      user.medicalOffice ||
      user.hospitalMemberships.some(({ hospitalId: existingHospitalId }) => (
        existingHospitalId !== hospitalId
      ))
    )
  ) {
    throw new TestSeedError('The test hospital user is already linked to unrelated records; refusing to modify it.')
  }

  if (
    expectedRole === 'MEDICAL_OFFICER' &&
    user.hospitalMemberships.length > 0
  ) {
    throw new TestSeedError('The test medical officer is already linked to a hospital; refusing to modify it.')
  }

  if (
    expectedRole === 'MEDICAL_OFFICER' &&
    user.medicalOffice &&
    user.medicalOffice.officeCode !== medicalOfficeCode
  ) {
    throw new TestSeedError('The test medical officer already has an unrelated medical office; refusing to modify it.')
  }
}

async function seedTestData(prisma, configuration, passwordHashes) {
  const medicalOfficeCode = getTestMedicalOfficeCode(configuration.officerEmail)

  await prisma.$transaction(async (tx) => {
    const maharashtra = await tx.state.findUnique({
      where: { code: 'MH' },
      select: { id: true },
    })
    if (!maharashtra) {
      throw new TestSeedError('Existing Maharashtra state record (code MH) is required; no location records were created.')
    }

    const [puneDistrict, hospitalRole, officerRole] = await Promise.all([
      tx.district.findUnique({
        where: { stateId_name: { stateId: maharashtra.id, name: 'Pune' } },
        select: { id: true },
      }),
      tx.role.findUnique({ where: { name: 'HOSPITAL' }, select: { id: true } }),
      tx.role.findUnique({ where: { name: 'MEDICAL_OFFICER' }, select: { id: true } }),
    ])
    if (!puneDistrict) {
      throw new TestSeedError('Existing Pune district under Maharashtra is required; no location records were created.')
    }

    const [
      puneCity,
      existingHospital,
      existingHospitalUser,
      existingOfficer,
      officeCodeOwner,
    ] = await Promise.all([
      tx.area.findUnique({
        where: { districtId_name: { districtId: puneDistrict.id, name: 'Pune City' } },
        select: { id: true },
      }),
      tx.hospital.findUnique({
        where: { registrationNumber: TEST_HOSPITAL_REGISTRATION },
        select: { id: true, name: true },
      }),
      tx.user.findUnique({
        where: { email: configuration.hospitalEmail },
        select: {
          firstName: true,
          lastName: true,
          role: { select: { name: true } },
          hospitalMemberships: { select: { hospitalId: true } },
          medicalOffice: { select: { officeCode: true } },
        },
      }),
      tx.user.findUnique({
        where: { email: configuration.officerEmail },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: { select: { name: true } },
          hospitalMemberships: { select: { hospitalId: true } },
          medicalOffice: { select: { officeCode: true } },
        },
      }),
      tx.medicalOffice.findUnique({
        where: { officeCode: medicalOfficeCode },
        select: { userId: true },
      }),
    ])
    if (!puneCity) {
      throw new TestSeedError('Existing Pune City area in Pune district is required; no test records were created.')
    }
    if (existingHospital && existingHospital.name !== TEST_HOSPITAL_NAME) {
      throw new TestSeedError('The reserved test hospital registration number is already used by another hospital.')
    }
    if (!hospitalRole || !officerRole) {
      throw new TestSeedError('Existing HOSPITAL and MEDICAL_OFFICER roles are required; run the existing role seed first.')
    }
    assertOfficeCodeAvailable(officeCodeOwner, existingOfficer?.id)
    assertOwnedTestUser(
      existingHospitalUser,
      'HOSPITAL',
      TEST_HOSPITAL_USER_NAME,
      existingHospital?.id,
    )
    assertOwnedTestUser(
      existingOfficer,
      'MEDICAL_OFFICER',
      TEST_OFFICER_USER_NAME,
      existingHospital?.id,
      medicalOfficeCode,
    )

    const hospital = await tx.hospital.upsert({
      where: { registrationNumber: TEST_HOSPITAL_REGISTRATION },
      update: {
        name: TEST_HOSPITAL_NAME,
        districtId: puneDistrict.id,
        address: 'Test data - Pune',
      },
      create: {
        name: TEST_HOSPITAL_NAME,
        registrationNumber: TEST_HOSPITAL_REGISTRATION,
        districtId: puneDistrict.id,
        address: 'Test data - Pune',
      },
      select: { id: true },
    })

    const hospitalUser = await tx.user.upsert({
      where: { email: configuration.hospitalEmail },
      update: {
        ...TEST_HOSPITAL_USER_NAME,
        passwordHash: passwordHashes.hospital,
        roleId: hospitalRole.id,
      },
      create: {
        email: configuration.hospitalEmail,
        ...TEST_HOSPITAL_USER_NAME,
        passwordHash: passwordHashes.hospital,
        roleId: hospitalRole.id,
      },
      select: { id: true },
    })
    const officerUser = await tx.user.upsert({
      where: { email: configuration.officerEmail },
      update: {
        ...TEST_OFFICER_USER_NAME,
        passwordHash: passwordHashes.officer,
        roleId: officerRole.id,
      },
      create: {
        email: configuration.officerEmail,
        ...TEST_OFFICER_USER_NAME,
        passwordHash: passwordHashes.officer,
        roleId: officerRole.id,
      },
      select: { id: true },
    })

    await tx.hospitalUser.upsert({
      where: { hospitalId_userId: { hospitalId: hospital.id, userId: hospitalUser.id } },
      update: {},
      create: {
        hospitalId: hospital.id,
        userId: hospitalUser.id,
        jobTitle: 'Test report submitter',
      },
    })

    const medicalOffice = await tx.medicalOffice.upsert({
      where: { userId: officerUser.id },
      update: { officeCode: medicalOfficeCode },
      create: {
        userId: officerUser.id,
        officeCode: medicalOfficeCode,
      },
      select: { id: true },
    })

    await tx.medicalOfficeArea.upsert({
      where: { medicalOfficeId_areaId: { medicalOfficeId: medicalOffice.id, areaId: puneCity.id } },
      update: {},
      create: { medicalOfficeId: medicalOffice.id, areaId: puneCity.id },
    })

    const [hospitalMembership, officerOffice, officeArea] = await Promise.all([
      tx.hospitalUser.findUnique({
        where: { hospitalId_userId: { hospitalId: hospital.id, userId: hospitalUser.id } },
        select: { id: true },
      }),
      tx.medicalOffice.findUnique({
        where: { userId: officerUser.id },
        select: { id: true },
      }),
      tx.medicalOfficeArea.findUnique({
        where: { medicalOfficeId_areaId: { medicalOfficeId: medicalOffice.id, areaId: puneCity.id } },
        select: { id: true },
      }),
    ])
    if (!hospitalMembership || !officerOffice || !officeArea) {
      throw new TestSeedError('Test record verification failed; transaction rolled back.')
    }
  })
}

async function runTestSeed() {
  let prisma
  try {
    const configuration = readConfiguration(process.env)
    const [hospitalHash, officerHash] = await Promise.all([
      bcrypt.hash(configuration.hospitalPassword, 12),
      bcrypt.hash(configuration.officerPassword, 12),
    ])

    prisma = require('../src/config/prisma')
    await seedTestData(prisma, configuration, {
      hospital: hospitalHash,
      officer: officerHash,
    })
    console.log(
      'Test data verified: 1 Pune hospital, 1 hospital membership, 1 medical officer, ' +
      '1 medical office, and 1 Pune City assignment.',
    )
  } catch (error) {
    console.error(
      error instanceof TestSeedError
        ? `Test data seed failed: ${error.message}`
        : 'Test data seed failed safely. Verify the local database and existing Pune records; no credentials or hashes were printed.',
    )
    process.exitCode = 1
  } finally {
    if (prisma) await prisma.$disconnect()
  }
}

if (require.main === module) {
  runTestSeed()
}

module.exports = {
  assertOfficeCodeAvailable,
  assertSafeDatabaseUrl,
  getTestMedicalOfficeCode,
  readConfiguration,
}
