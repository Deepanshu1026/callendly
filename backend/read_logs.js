const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\chair\\.gemini\\antigravity-ide\\brain\\82d1405c-7d22-4891-ade3-55f00550cce7\\.system_generated\\logs\\transcript.jsonl';

try {
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf8').split('\n');
    console.log('Total log lines:', lines.length);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        const text = JSON.stringify(obj);
        if (text.toLowerCase().includes('password') || text.toLowerCase().includes('postgresql') || text.toLowerCase().includes('supabase.co')) {
          console.log(`Line ${i}:`, obj.type, obj.source, obj.content ? obj.content.substring(0, 200) : 'no content');
        }
      } catch (e) {
        // ignore
      }
    }
  } else {
    console.log('Log file not found at:', logPath);
  }
} catch (err) {
  console.error(err);
}
