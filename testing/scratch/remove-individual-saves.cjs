const fs = require('fs');
const path = require('path');

const testsDir = path.resolve(__dirname, '../web-tests/tests');

const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));

for (const file of files) {
  const filePath = path.join(testsDir, file);
  console.log(`Processing ${file}...`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove the call to reportManager.saveReport(); in the after hooks
  content = content.replace(/await\s+reportManager\.saveReport\(\);/g, "");

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Individual saveReport calls removed.');
