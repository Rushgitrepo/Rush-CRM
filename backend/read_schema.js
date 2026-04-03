const fs = require('fs');
const sql = fs.readFileSync('src/database/CRM.sql', 'utf8');
const statements = sql.split(';');

let output = '';
for (let s of statements) {
  const ts = s.trim();
  if (ts.startsWith('CREATE TABLE') || ts.startsWith('ALTER TABLE')) {
    if (ts.includes('organizations') || ts.includes('PRIMARY KEY')) {
      output += ts.substring(0, 150) + '\n...\n';
    }
  }
}
fs.writeFileSync('schema_debug.txt', output);
