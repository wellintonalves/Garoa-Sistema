const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./frontend/src');
let changed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/color: 'var\(--amber\)'/g, "color: 'var(--cor-icone)'");
  
  // also replace background: 'var(--amber-dim)' with border: 1px solid rgba(var(--cor-primaria-rgb), 0.3)
  // this is tricky to do blindly, but we can replace `border: '1px solid var(--border)'` when it's near `var(--amber-dim)`
  // Actually, let's just do the color: var(--amber) replacement first
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changed++;
  }
});

console.log('Modified', changed, 'files');
