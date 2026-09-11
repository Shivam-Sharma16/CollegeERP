const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const targetDir = 'd:/Desktop/CollegeERP/apps/web/src';

walkDir(targetDir, (filePath) => {
  if (filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace hardcoded white colors
    content = content.replace(/color:\s*#(?:fff|ffffff)\s*;/gi, 'color: var(--color-text-on-primary, #ffffff);');
    content = content.replace(/color:\s*#(?:f8fafc)\s*;/gi, 'color: var(--color-text-on-primary, #ffffff);');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
