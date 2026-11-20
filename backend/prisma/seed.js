const bcrypt = require('bcryptjs')
const prisma = require('../src/config/prisma')

const roleSeeds = [
  { name: 'PUBLIC', description: 'Public user' },
  { name: 'HOSPITAL', description: 'Hospital user' },
  { name: 'MEDICAL_OFFICER', description: 'Medical officer' },
  { name: 'ADMIN', description: 'System administrator' },
]

const diseaseSeeds = [
  { code: 'DENGUE', name: 'Dengue', description: 'Dengue fever' },
  { code: 'MALARIA', name: 'Malaria', description: 'Malaria infection' },
  { code: 'TYPHOID', name: 'Typhoid', description: 'Typhoid fever' },
]

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  if (!adminEmail) {
    throw new Error('SEED_ADMIN_EMAIL must be set before running the seed.')
  }
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be set and at least 12 characters long.')
  }

  const roles = {}
  for (const roleData of roleSeeds) {
    roles[roleData.name] = await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: roleData,
    })
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      firstName: 'Initial',
      lastName: 'Administrator',
      passwordHash,
      roleId: roles.ADMIN.id,
    },
    create: {
      email: adminEmail,
      firstName: 'Initial',
      lastName: 'Administrator',
      passwordHash,
      roleId: roles.ADMIN.id,
    },
  })

  for (const disease of diseaseSeeds) {
    await prisma.disease.upsert({
      where: { code: disease.code },
      update: { name: disease.name, description: disease.description },
      create: disease,
    })
  }

  const state = await prisma.state.upsert({
    where: { code: 'MH' },
    update: { name: 'Maharashtra' },
    create: { code: 'MH', name: 'Maharashtra' },
  })
  const districts = []
  for (const districtName of ['Pune', 'Nashik']) {
    districts.push(await prisma.district.upsert({
      where: { stateId_name: { stateId: state.id, name: districtName } },
      update: {},
      create: { name: districtName, stateId: state.id },
    }))
  }

  const areaSeeds = [
    { districtId: districts[0].id, name: 'Pune City' },
    { districtId: districts[0].id, name: 'Haveli' },
    { districtId: districts[1].id, name: 'Nashik City' },
  ]
  for (const area of areaSeeds) {
    await prisma.area.upsert({
      where: { districtId_name: { districtId: area.districtId, name: area.name } },
      update: {},
      create: area,
    })
  }

  const [roleCount, diseaseCount, districtCount, areaCount, admin] = await Promise.all([
    prisma.role.count({ where: { name: { in: roleSeeds.map(({ name }) => name) } } }),
    prisma.disease.count({ where: { code: { in: diseaseSeeds.map(({ code }) => code) } } }),
    prisma.district.count({ where: { stateId: state.id } }),
    prisma.area.count({ where: { districtId: { in: districts.map(({ id }) => id) } } }),
    prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    }),
  ])

  if (!admin || roleCount !== roleSeeds.length || diseaseCount !== diseaseSeeds.length) {
    throw new Error('Seed verification failed for admin, roles, or diseases.')
  }

  console.log(
    `Seed verified: ${roleCount} roles, ${diseaseCount} diseases, 1 state, ` +
      `${districtCount} districts, ${areaCount} areas, and 1 admin account.`,
  )
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
