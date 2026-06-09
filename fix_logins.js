const fs = require('fs');

const filesToFix = [
  'frontend/src/pages/admin/AdminLogin.tsx',
  'frontend/src/pages/barbeiro/BarbeiroLogin.tsx',
  'frontend/src/pages/barbeiro/BarbeiroLoginPage.tsx',
  'frontend/src/pages/cliente/ClienteLogin.tsx',
  'frontend/src/pages/cliente/ClienteWelcome.tsx',
  'frontend/src/pages/cliente/ClienteRegister.tsx',
  'frontend/src/pages/cliente/ClienteCadastro.tsx'
];

let filesChanged = 0;

filesToFix.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // 1. Remover import e uso do useTema
  newContent = newContent.replace(/import\s+{\s*useTema\s*}\s+from\s+['"].*?useTema['"];?\n?/g, '');
  newContent = newContent.replace(/const\s+{\s*limparTema\s*}\s*=\s*useTema\(\);\n?/g, '');
  newContent = newContent.replace(/useEffect\(\(\)\s*=>\s*{\s*limparTema\(\);\s*},\s*\[limparTema\]\);\n?/g, '');

  // 2. Substituir variáveis CSS por valores fixos (Inline e Tailwind)
  newContent = newContent.replace(/var\(--cor-primaria\)/g, '#F59E0B');
  newContent = newContent.replace(/var\(--amber\)/g, '#F59E0B');
  newContent = newContent.replace(/var\(--cor-icone\)/g, '#F59E0B');
  newContent = newContent.replace(/rgba\(var\(--cor-primaria-rgb\),\s*([0-9.]+)\)/g, 'rgba(245, 158, 11, $1)');
  newContent = newContent.replace(/var\(--bg-primary\)/g, '#0F172A');
  newContent = newContent.replace(/var\(--bg-surface\)/g, '#1E293B');
  newContent = newContent.replace(/var\(--text-primary\)/g, '#FFFFFF');
  newContent = newContent.replace(/var\(--text-muted\)/g, '#94A3B8');
  newContent = newContent.replace(/var\(--border\)/g, '#334155');

  // Classes do tailwind que usam variaveis, para valores fixos
  newContent = newContent.replace(/bg-\[var\(--cor-primaria\)\]/g, 'bg-[#F59E0B]');
  newContent = newContent.replace(/text-\[var\(--cor-primaria\)\]/g, 'text-[#F59E0B]');
  newContent = newContent.replace(/text-\[var\(--cor-icone\)\]/g, 'text-[#F59E0B]');
  newContent = newContent.replace(/border-\[var\(--cor-primaria\)\]/g, 'border-[#F59E0B]');
  newContent = newContent.replace(/hover:bg-\[var\(--cor-primaria\)\]/g, 'hover:bg-[#D97706]');
  newContent = newContent.replace(/hover:text-\[var\(--cor-icone\)\]/g, 'hover:text-[#F59E0B]');
  newContent = newContent.replace(/bg-\[rgba\(var\(--cor-primaria-rgb\),0\.10\)\]/g, 'bg-[rgba(245,158,11,0.10)]');
  newContent = newContent.replace(/bg-\[rgba\(var\(--cor-primaria-rgb\),0\.15\)\]/g, 'bg-[rgba(245,158,11,0.15)]');

  // 3. Inputs com ds-input para classes consistentes
  newContent = newContent.replace(/className="ds-input"/g, 'className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"');

  // 4. Botões btn-primary
  // Note: we replace btn-primary with the specific styles requested
  newContent = newContent.replace(/className="btn-primary([^"]*)"/g, 'className="flex items-center gap-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-bold uppercase tracking-widest text-xs rounded transition-colors$1"');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    filesChanged++;
    console.log(`Updated: ${file}`);
  }
});

console.log(`Total files changed: ${filesChanged}`);
