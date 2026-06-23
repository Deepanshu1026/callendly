const { PrismaClient } = require('@prisma/client');

async function testConnection(password) {
  const url = `postgresql://postgres:${password}@db.uxcigmsdkrcpfkxzqttw.supabase.co:6543/postgres?sslmode=require`;
  console.log('Testing with url:', url.replace(password, '***'));
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url
      }
    }
  });

  try {
    const res = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Success! Result:', res);
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.error('Failed with password:', password, err.message);
    await prisma.$disconnect();
    return false;
  }
}

async function run() {
  // Test common passwords
  const passwords = ['postgres', 'postgres123', 'admin', 'password'];
  for (const pw of passwords) {
    const ok = await testConnection(pw);
    if (ok) {
      console.log('Connected successfully with password:', pw);
      break;
    }
  }
}

run();
