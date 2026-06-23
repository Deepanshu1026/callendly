const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 12);

  const user = await prisma.user.create({
    data: {
      email: 'demo@callendly.app',
      password: hashedPassword,
      name: 'Demo User',
      profile: {
        create: {
          username: 'demo',
          timezone: 'UTC',
          publicBookingPage: true
        }
      },
      eventTypes: {
        create: [
          {
            title: '15 Min Meeting',
            slug: '15min',
            duration: 15,
            location: 'Google Meet',
            color: '#3b82f6'
          },
          {
            title: '30 Min Meeting',
            slug: '30min',
            duration: 30,
            location: 'Zoom',
            color: '#10b981'
          },
          {
            title: '60 Min Meeting',
            slug: '60min',
            duration: 60,
            location: 'In-person',
            color: '#f59e0b'
          }
        ]
      },
      availabilityRules: {
        create: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true }
        ]
      }
    }
  });

  console.log('Created demo user:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
