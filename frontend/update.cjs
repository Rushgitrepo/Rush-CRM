const fs = require('fs');
const content = fs.readFileSync('src/pages/crm/LeadDetailPage.tsx', 'utf-8');
const replacement = fs.readFileSync('replacement.txt', 'utf-8');

const sIdx = content.indexOf('<div className="min-h-screen bg-slate-50">');
const eIdx = content.indexOf('{/* Workspace Share Modal */}');

if (sIdx > -1 && eIdx > -1) {
  const newContent = content.slice(0, sIdx) + replacement + content.slice(eIdx);
  fs.writeFileSync('src/pages/crm/LeadDetailPage.tsx', newContent, 'utf-8');
  console.log('Success');
} else {
  console.log('Failed to find indices');
}
