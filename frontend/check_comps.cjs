const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const componentsDir = path.join(srcDir, 'components');

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

const compFiles = getAllFiles(componentsDir, '.tsx');
const allSrcFiles = getAllFiles(srcDir, '.tsx').concat(getAllFiles(srcDir, '.ts'));

const fileContents = allSrcFiles.map(f => fs.readFileSync(f, 'utf-8'));

const unusedComps = [];

for (const comp of compFiles) {
  const basename = path.basename(comp, '.tsx');
  if (basename === 'index') continue;
  
  let isUsed = false;
  for (let i = 0; i < allSrcFiles.length; i++) {
    const file = allSrcFiles[i];
    // don't count itself
    if (file === comp) continue;
    
    // check if basename occurs in content
    if (fileContents[i].includes(basename) || fileContents[i].includes(basename + 'Component')) {
      isUsed = true;
      break;
    }
  }
  if (!isUsed) {
    unusedComps.push(comp.replace(componentsDir, ''));
  }
}

console.log(unusedComps.join('\n'));
