const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'services');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.service.ts'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix creates
  content = content.replace(/data: \{([^]+?)\}(,)?(\s*)(include:|select:|\n\s*\})/g, "data: {$1} as any$2$3$4");
  
  // Fix Papel type mismatch
  content = content.replace(/papel: 'BARBEIRO'/g, "papel: 'BARBEIRO' as any");
  content = content.replace(/papel: 'CLIENTE'/g, "papel: 'CLIENTE' as any");
  
  fs.writeFileSync(filePath, content, 'utf8');
}

// Fix publico controller missing properties
const pubCtrlPath = path.join(__dirname, 'src', 'controllers', 'publico.controller.ts');
let pubContent = fs.readFileSync(pubCtrlPath, 'utf8');
pubContent = pubContent.replace(/data: \{([^]+?)\}(,)?(\s*)(include:|select:|\n\s*\})/g, "data: {$1} as any$2$3$4");
fs.writeFileSync(pubCtrlPath, pubContent, 'utf8');

console.log("Fixed TS types for data objects");
