const prisma = require('../config/prisma')

const ROLES = Object.freeze(['PUBLIC', 'HOSPITAL', 'MEDICAL_OFFICER', 'ADMIN'])
const roleSet = new Set(ROLES)

function authorizeRoles(...permittedRoles) {
  const roles = permittedRoles.flat()
  if (roles.length === 0 || roles.some((role) => !roleSet.has(role))) {
    throw new Error('authorizeRoles requires one or more valid role names.')
  }

  return async function roleAuthorization(req, res, next) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { role: { select: { name: true } } },
      })

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const actualRole = user.role.name
      req.user.role = actualRole
      if (!roles.includes(actualRole)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      return next()
    } catch (error) {
      return next(error)
    }
  }
}

authorizeRoles.ROLES = ROLES

module.exports = authorizeRoles
