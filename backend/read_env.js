const dotenv = require('dotenv');
dotenv.config();
console.log('Environment variable keys:', Object.keys(process.env));
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@\s]+@/, ':***@'));
}
