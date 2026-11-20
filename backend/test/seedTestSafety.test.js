const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  assertOfficeCodeAvailable,
  assertSafeDatabaseUrl,
  getTestMedicalOfficeCode,
  readConfiguration,
} = require('../prisma/seedTestData')

test('test seed accepts only the local Rog Rakshak PostgreSQL database', () => {
  assert.doesNotThrow(() => (
    assertSafeDatabaseUrl('postgresql://user:password@localhost:5432/rog_rakshak?schema=public')
  ))
  assert.doesNotThrow(() => (
    assertSafeDatabaseUrl('postgresql://user:password@127.0.0.1:5432/rog_rakshak')
  ))
})

test('test seed rejects remote hosts, other databases, and query host overrides', () => {
  for (const url of [
    'postgresql://user:password@example.com:5432/rog_rakshak',
    'postgresql://user:password@localhost:5432/production',
    'postgresql://user:password@localhost:5432/rog_rakshak?host=example.com',
  ]) {
    assert.throws(() => assertSafeDatabaseUrl(url))
  }
})

test('test seed requires distinct clearly identified test accounts and strong passwords', () => {
  const environment = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/rog_rakshak',
    TEST_HOSPITAL_EMAIL: 'rr-test-hospital@example.test',
    TEST_HOSPITAL_PASSWORD: 'temporary-hospital-password',
    TEST_MEDICAL_OFFICER_EMAIL: 'rr-test-officer@example.test',
    TEST_MEDICAL_OFFICER_PASSWORD: 'temporary-officer-password',
  }
  assert.doesNotThrow(() => readConfiguration(environment))
  assert.throws(() => readConfiguration({
    ...environment,
    TEST_HOSPITAL_EMAIL: 'admin@example.test',
  }))
  assert.throws(() => readConfiguration({
    ...environment,
    TEST_MEDICAL_OFFICER_EMAIL: environment.TEST_HOSPITAL_EMAIL,
  }))
  assert.throws(() => readConfiguration({
    ...environment,
    SEED_ADMIN_EMAIL: environment.TEST_HOSPITAL_EMAIL,
  }))
})

test('test medical office codes are deterministic and distinguish different officer emails', () => {
  const firstEmail = 'rr-test-officer-one@example.test'
  const secondEmail = 'rr-test-officer-two@example.test'
  const firstCode = getTestMedicalOfficeCode(firstEmail)

  assert.equal(firstCode, getTestMedicalOfficeCode(firstEmail))
  assert.notEqual(firstCode, getTestMedicalOfficeCode(secondEmail))
  assert.match(firstCode, /^RR-TEST-MO-[A-F0-9]{32}$/)
  assert.ok(firstCode.length <= 48)
})

test('test seed rejects an office code owned by a different user without accepting reassignment', () => {
  assert.doesNotThrow(() => assertOfficeCodeAvailable(null, 'configured-officer'))
  assert.doesNotThrow(() => assertOfficeCodeAvailable(
    { userId: 'configured-officer' },
    'configured-officer',
  ))
  assert.throws(
    () => assertOfficeCodeAvailable({ userId: 'other-officer' }, 'configured-officer'),
    /already owned by another user/,
  )
})