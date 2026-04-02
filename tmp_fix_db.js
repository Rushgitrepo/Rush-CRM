const fs = require('fs');

const dbPath = 'd:/Development/FC/Rush-CRM/backend/src/database/database.sql';
let dbContent = fs.readFileSync(dbPath, 'utf8');

dbContent = dbContent.replace(/CREATE TABLE (\s*\w+)\s*\(/g, (match, tableName) => {
    if (tableName.toUpperCase().includes('IF NOT EXISTS')) return match;
    return `CREATE TABLE IF NOT EXISTS ${tableName} (`;
});

dbContent = dbContent.replace(/CREATE INDEX (\w+) ON (\w+)\s*\(/g, (match, indexName, tableName) => {
    if (indexName.toUpperCase().includes('IF NOT EXISTS')) return match;
    return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(`;
});

fs.writeFileSync(dbPath, dbContent);
console.log('Fixed database.sql to include IF NOT EXISTS');
