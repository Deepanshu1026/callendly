const fs = require('fs');
const logPath = 'C:\\Users\\chair\\.gemini\\antigravity-ide\\brain\\82d1405c-7d22-4891-ade3-55f00550cce7\\.system_generated\\logs\\transcript.jsonl';

try {
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (line.includes('![') && line.includes('](')) {
        console.log(`Line ${i}:`, line.substring(line.indexOf('!['), line.indexOf('](') + 150));
      }
    }
  }
} catch (e) {
  console.error(e);
}
