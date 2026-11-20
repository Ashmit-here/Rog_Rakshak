const jwt = require('jsonwebtoken')
const { getJwtSecret } = require('../config/environment')

function authenticate(req, res, next) {
  const authorization = req.get('authorization')
  const match = typeof authorization === 'string'
    ? authorization.match(/^Bearer\s+(\S+)$/i)
    : null

  if (!match) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const payload = jwt.verify(match[1], getJwtSecret(), { algorithms: ['HS256'] })
    if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string' || !payload.sub) {
      return res.status(401).json({ error: 'Invalid authentication token' })
    }

    req.user = { id: payload.sub }
    return next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' })
    }
    return next(error)
  }
}

module.exports = authenticate