const fs = require('fs');
try {
  let content = fs.readFileSync('backend/supabase_schema.sql', 'utf16le');
  if (!content.includes('CREATE TABLE')) {
    // try utf8
    content = fs.readFileSync('backend/supabase_schema.sql', 'utf8');
  }
  const lines = content.split('\n');
  let print = false;
  let braces = 0;
  for (const line of lines) {
    if (line.includes('CREATE TABLE "event_types"') || line.includes('CREATE TABLE "bookings"') || line.includes('CREATE TABLE "payments"')) {
      print = true;
      console.log('--- TABLE SCHEMA ---');
    }
    if (print) {
      console.log(line);
      if (line.includes('(')) braces++;
      if (line.includes(');')) {
        braces = 0;
        print = false;
      }
    }
  }
} catch (err) {
  console.error(err);
}
