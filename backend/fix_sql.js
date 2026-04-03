const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, 'src', 'database', 'CRM.sql');
const outputFile = path.join(__dirname, 'src', 'database', 'CRM_fixed.sql');

console.log('Reading SQL file...');
let sql = fs.readFileSync(sqlFile, 'utf8');

let fixCount = 0;

// ============================================================
// FIX 1: Column type "ARRAY" without element type -> "text[]"
// Matches: column_name ARRAY, or column_name ARRAY)
// But NOT: ARRAY[...] or ARRAY'' (value expressions in INSERT)
// ============================================================
const arrayTypeRegex = /(\w+)\s+ARRAY\b(?!\s*\[)(?!\s*')/g;
sql = sql.replace(arrayTypeRegex, (match, colName) => {
  // Only replace in CREATE TABLE context (column definitions)
  // "ARRAY" as a type keyword is always in a CREATE TABLE
  fixCount++;
  return `${colName} text[]`;
});
console.log(`Fix 1: Replaced ${fixCount} bare ARRAY types with text[]`);

// ============================================================
// FIX 2: [object Object] in VALUES -> '{}'::jsonb
// These are JavaScript objects that got .toString()'d during export
// ============================================================
let fix2Count = 0;

// Pattern: , [object Object], or , [object Object])
sql = sql.replace(/,\s*\[object Object\]\s*,/g, () => { fix2Count++; return ", '{}'::jsonb,"; });
sql = sql.replace(/,\s*\[object Object\]\s*\)/g, () => { fix2Count++; return ", '{}'::jsonb)"; });
sql = sql.replace(/\(\s*\[object Object\]\s*,/g, () => { fix2Count++; return "('{}'::jsonb,"; });
// Standalone at end
sql = sql.replace(/,\s*\[object Object\]\s*$/gm, () => { fix2Count++; return ", '{}'::jsonb"; });

console.log(`Fix 2: Replaced ${fix2Count} [object Object] literals with '{}'::jsonb`);

// ============================================================
// FIX 3: ARRAY['[object Object]',...] -> '[]'::jsonb
// These are jsonb arrays that got exported as PostgreSQL text arrays
// ============================================================
let fix3Count = 0;
sql = sql.replace(/ARRAY\[(?:'[^']*'(?:\s*,\s*)?)*\]/g, (match) => {
  if (match.includes('[object Object]')) {
    fix3Count++;
    return "'[]'::jsonb";
  }
  return match;
});
console.log(`Fix 3: Replaced ${fix3Count} ARRAY['[object Object]',...] with '[]'::jsonb`);

// ============================================================
// FIX 4: Empty ARRAY[] in INSERT statements -> '{}'
// PostgreSQL needs '{}' for empty array literals, not ARRAY[]
// ============================================================
let fix4Count = 0;
sql = sql.replace(/,\s*ARRAY\[\]\s*,/g, () => { fix4Count++; return ", '{}',"; });
sql = sql.replace(/,\s*ARRAY\[\]\s*\)/g, () => { fix4Count++; return ", '{}')"; });
sql = sql.replace(/\(\s*ARRAY\[\]\s*,/g, () => { fix4Count++; return "('{}',"; });
console.log(`Fix 4: Replaced ${fix4Count} empty ARRAY[] with '{}'`);

// ============================================================
// FIX 5: DEFAULT '{}'::uuid[] with mention_users 
// workgroup_posts has: mention_users ARRAY DEFAULT '{}'::uuid[]
// After Fix 1 this became: mention_users text[] DEFAULT '{}'::uuid[]
// We need to keep the default consistent
// ============================================================
// Already handled - text[] with DEFAULT '{}'::uuid[] is fine since we're using text[] now
// Actually let's fix the uuid[] defaults to text[]
let fix5Count = 0;
sql = sql.replace(/DEFAULT\s*'\{\}'::\s*uuid\[\]/g, () => { fix5Count++; return "DEFAULT '{}'::text[]"; });
console.log(`Fix 5: Replaced ${fix5Count} DEFAULT '{}'::uuid[] with DEFAULT '{}'::text[]`);

// ============================================================
// FIX 6: Add uuid-ossp extension at the top
// ============================================================
if (!sql.includes('uuid-ossp')) {
  sql = `-- Extensions\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n` + sql;
  console.log('Fix 6: Added uuid-ossp and pgcrypto extensions');
} else {
  console.log('Fix 6: Extensions already present (skipped)');
}

// ============================================================
// FIX 7: ARRAY['value1','value2'] in INSERT context where column is text[]
// These are valid PostgreSQL syntax, keep them as-is
// ============================================================
console.log('Fix 7: Valid ARRAY[...] expressions preserved (no change needed)');

// ============================================================
// FIX 8: Check for any remaining issues
// ============================================================
const remainingObjectRefs = (sql.match(/\[object Object\]/g) || []).length;
console.log(`\nRemaining [object Object] occurrences: ${remainingObjectRefs}`);

if (remainingObjectRefs > 0) {
  // Find lines with remaining issues
  const lines = sql.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('[object Object]')) {
      console.log(`  Line ${i + 1}: ${line.substring(0, 120)}...`);
    }
  });
}

// Write the fixed SQL file
fs.writeFileSync(outputFile, sql, 'utf8');
console.log(`\nFixed SQL written to: ${outputFile}`);
console.log(`Original size: ${fs.statSync(sqlFile).size} bytes`);
console.log(`Fixed size: ${fs.statSync(outputFile).size} bytes`);

// Also overwrite the original
fs.writeFileSync(sqlFile, sql, 'utf8');
console.log(`\nOriginal file updated: ${sqlFile}`);
console.log('\nDone! Now run: npm run db:import');
