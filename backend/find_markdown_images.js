const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\chair\\.gemini\\antigravity-ide\\brain\\82d1405c-7d22-4891-ade3-55f00550cce7';

function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      scan(full);
    } else if (f.endsWith('.md')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('![')) {
          console.log(`${f}:${i + 1}: ${lines[i]}`);
        }
      }
    }
  }
}

scan(brainDir);
