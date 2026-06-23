const supabase = require('./src/config/database');
async function run() {
  const { data, error } = await supabase.from('event_types').select('*').limit(1);
  if (error) {
    console.error('Error fetching event_types:', error);
  } else {
    console.log('event_types sample record keys:', data && data.length > 0 ? Object.keys(data[0]) : 'empty table');
  }
}
run();
