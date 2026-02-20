const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Senh@123', 12);
  
  const admin = await prisma.adminUser.upsert({
    where: { email: 'opt@gmail.com' },
    update: { password: hashedPassword, name: 'Moderador', role: 'superadmin', isActive: true },
    create: {
      email: 'opt@gmail.com',
      password: hashedPassword,
      name: 'Moderador',
      role: 'superadmin',
      isActive: true,
    },
  });
  
  console.log('Admin criado/atualizado:', admin.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());