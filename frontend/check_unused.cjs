const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const pagesDir = path.join(srcDir, 'pages');

const getAllFiles = (dir, ext, fileList = []) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, ext, fileList);
    } else if (filePath.endsWith(ext)) {
      fileList.push(filePath);
    }
  }
  return fileList;
};

const pageFiles = getAllFiles(pagesDir, '.tsx');
const allSrcFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.ts'));

const fileContents = allSrcFiles.map(f => fs.readFileSync(f, 'utf-8'));

const unusedPages = [];

for (const page of pageFiles) {
  const basename = path.basename(page, '.tsx');
  
  let isUsed = false;
  for (let i = 0; i < allSrcFiles.length; i++) {
    const file = allSrcFiles[i];
    // don't count itself
    if (file === page) continue;
    
    // check if basename occurs in content
    if (fileContents[i].includes(basename) || fileContents[i].includes(basename + 'Page')) {
      isUsed = true;
      break;
    }
  }
  if (!isUsed) {
    unusedPages.push(page.replace(pagesDir, ''));
  }
}

console.log(unusedPages.join('\n'));
