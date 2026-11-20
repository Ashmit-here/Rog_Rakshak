const { after, before, test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const express = require('express')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-bytes'
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'

const app = require('../src/app')
const prisma = require('../src/config/prisma')
const authenticate = require('../src/middleware/authenticate')
const authorizeRoles = require('../src/middleware/authorizeRoles')

const testPassword = 'correct horse battery staple'
const account = {
  id: 'user-test-1',
  email: 'person@example.com',
  passwordHash: '',
  firstName: 'Test',
  lastName: 'User',
  phone: null,
  role: { name: 'HOSPITAL' },
}

let originalFindUnique
let apiServer
let roleServer
let apiUrl
let roleUrl

function listen(app) {
  const server = app.listen(0, '127.0.0.1')
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.once('listening', () => {
      server.removeListener('error', reject)
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` })
    })
  })
}

async function postLogin(body) {
  return fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function getMe(token) {
  return fetch(`${apiUrl}/api/auth/me`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

before(async () => {
  account.passwordHash = await bcrypt.hash(testPassword, 4)
  originalFindUnique = prisma.user.findUnique
  prisma.user.findUnique = async ({ where }) => {
    if (where.email === account.email) return account
    if (where.id === account.id) return account
    return null
  }

  const api = await listen(app)
  apiServer = api.server
  apiUrl = api.url

  const roleApp = express()
  roleApp.get('/admin', authenticate, authorizeRoles('ADMIN'), (req, res) => {
    res.json({ role: req.user.role })
  })
  const role = await listen(roleApp)
  roleServer = role.server
  roleUrl = role.url
})

after(async () => {
  prisma.user.findUnique = originalFindUnique
  await Promise.all([
    new Promise((resolve) => apiServer.close(resolve)),
    new Promise((resolve) => roleServer.close(resolve)),
  ])
})

test('login returns a signed token and safe user information with the actual role', async () => {
  const response = await postLogin({ email: ' PERSON@EXAMPLE.COM ', password: testPassword })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(typeof body.token, 'string')
  assert.deepEqual(body.user, {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    role: 'HOSPITAL',
  })
  assert.equal(Object.hasOwn(body.user, 'passwordHash'), false)
  assert.equal(jwt.verify(body.token, process.env.JWT_SECRET).sub, account.id)
})

test('login rejects an incorrect password', async () => {
  const response = await postLogin({ email: account.email, password: 'incorrect' })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Invalid email or password' })
})

test('login rejects an unknown email without disclosing whether it exists', async () => {
  const response = await postLogin({ email: 'unknown@example.com', password: testPassword })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Invalid email or password' })
})

test('login validates required request fields', async () => {
  const response = await postLogin({ email: 'not-an-email', password: testPassword })

  assert.equal(response.status, 400)
})

test('me requires an authentication token', async () => {
  const response = await getMe()

  assert.equal(response.status, 401)
})

test('me rejects an invalid token', async () => {
  const response = await getMe('not-a-valid-token')

  assert.equal(response.status, 401)
})

test('me rejects an expired token', async () => {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: account.id,
    expiresIn: '-1s',
  })
  const response = await getMe(token)

  assert.equal(response.status, 401)
})

test('me returns only the authenticated user safe profile', async () => {
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: account.id, expiresIn: '1h' })
  const response = await getMe(token)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    user: {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      role: 'HOSPITAL',
    },
  })
})

test('role authorization checks the database role, not the token role', async () => {
  const token = jwt.sign({ role: 'ADMIN' }, process.env.JWT_SECRET, {
    subject: account.id,
    expiresIn: '1h',
  })
  const response = await fetch(`${roleUrl}/admin`, {
    headers: { authorization: `Bearer ${token}` },
  })

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: 'Forbidden' })
})

test('role authorization allows a permitted database role', async () => {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: account.id,
    expiresIn: '1h',
  })
  const roleApp = express()
  roleApp.get('/hospital', authenticate, authorizeRoles('HOSPITAL'), (req, res) => {
    res.json({ role: req.user.role })
  })
  const server = roleApp.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/hospital`, {
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { role: 'HOSPITAL' })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('health endpoint remains available', async () => {
  const response = await fetch(`${apiUrl}/api/health`)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'ok')
})