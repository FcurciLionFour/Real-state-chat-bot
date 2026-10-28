const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient, UserRole } = require('@prisma/client');

loadEnvFile(path.resolve(__dirname, '../../.env'));

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    throw new Error('Usage: node backend/test/helpers/promote-user-admin.js <email>');
  }

  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new Error(`User not found for email ${email}`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });

    process.stdout.write(`Promoted ${user.email} to ADMIN`);
  } finally {
    await prisma.$disconnect();
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
