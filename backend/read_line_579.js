const fs = require('fs');
const logPath = 'C:\\Users\\chair\\.gemini\\antigravity-ide\\brain\\82d1405c-7d22-4891-ade3-55f00550cce7\\.system_generated\\logs\\transcript.jsonl';

try {
  const lines = fs.readFileSync(logPath, 'utf8').split('\n');
  for (let i = 560; i < 590; i++) {
    if (lines[i]) {
      const obj = JSON.parse(lines[i]);
      if (obj.tool_calls) {
        console.log(`Step ${i}:`, JSON.stringify(obj.tool_calls, null, 2));
      }
    }
  }
} catch (e) {
  console.error(e);
}
