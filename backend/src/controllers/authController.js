const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')
const { getJwtExpiresIn, getJwtSecret } = require('../config/environment')

const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: { select: { name: true } },
}

function toSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name,
  }
}

async function login(req, res, next) {
  const { email, password } = req.body || {}
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

  if (
    !normalizedEmail ||
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    typeof password !== 'string' ||
    password.length === 0 ||
    password.length > 1024
  ) {
    return res.status(400).json({ error: 'A valid email and password are required' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { ...safeUserSelect, passwordHash: true },
    })

    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = jwt.sign({}, getJwtSecret(), {
      algorithm: 'HS256',
      subject: user.id,
      expiresIn: getJwtExpiresIn(),
    })

    return res.status(200).json({ token, user: toSafeUser(user) })
  } catch (error) {
    return next(error)
  }
}

async function getCurrentUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: safeUserSelect,
    })

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    return res.status(200).json({ user: toSafeUser(user) })
  } catch (error) {
    return next(error)
  }
}

module.exports = { login, getCurrentUser }