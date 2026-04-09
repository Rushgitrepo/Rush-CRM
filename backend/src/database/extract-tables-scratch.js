const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, 'schema.sql');
const content = fs.readFileSync(sqlFile, 'utf8');

const tableMatches = content.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:(?:public\.)|(?:"public"\.))?([a-zA-Z0-9_]+)/gi);
const tables = new Set();
for (const match of tableMatches) {
  tables.add(match[1].toLowerCase());
}

console.log(JSON.stringify(Array.from(tables).sort()));
console.log('Count:', tables.size);
