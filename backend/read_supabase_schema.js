const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const url = process.env.SUPABASE_URL + '/rest/v1/';
  const anonKey = process.env.SUPABASE_ANON_KEY;

  console.log('Fetching schema from:', url);
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const schema = await response.json();
    console.log('PostgREST Schema Title:', schema.info?.title);
    console.log('Tables found in OpenAPI paths:');
    const tables = Object.keys(schema.paths || {});
    console.log(tables);
    
    console.log('\nDefinitions:');
    if (schema.definitions) {
      for (const [name, def] of Object.entries(schema.definitions)) {
        console.log(`- ${name}:`, Object.keys(def.properties || {}));
      }
    }
  } catch (err) {
    console.error('Failed to fetch schema:', err);
  }
}

run();
