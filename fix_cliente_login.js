const fs = require('fs');

const file = 'frontend/src/pages/cliente/ClienteLoginPrincipal.tsx';

let content = fs.readFileSync(file, 'utf8');
let newContent = content;

// 1. Remover import e uso do useTema
newContent = newContent.replace(/import\s+{\s*useTema\s*}\s+from\s+['"].*?useTema['"];?\n?/g, '');
newContent = newContent.replace(/const\s+{\s*limparTema\s*}\s*=\s*useTema\(\);\n?/g, '');
newContent = newContent.replace(/limparTema\(\);\n?/g, '');
newContent = newContent.replace(/,\s*limparTema/g, '');

// 2. Substituir variáveis CSS por valores fixos
newContent = newContent.replace(/var\(--cor-primaria\)/g, '#F59E0B');
newContent = newContent.replace(/var\(--amber\)/g, '#F59E0B');
newContent = newContent.replace(/var\(--cor-icone\)/g, '#F59E0B');
newContent = newContent.replace(/rgba\(var\(--cor-primaria-rgb\),\s*([0-9.]+)\)/g, 'rgba(245, 158, 11, $1)');
newContent = newContent.replace(/var\(--bg-primary\)/g, '#0F172A');
newContent = newContent.replace(/var\(--bg-surface\)/g, '#1E293B');
newContent = newContent.replace(/var\(--text-primary\)/g, '#FFFFFF');
newContent = newContent.replace(/var\(--text-muted\)/g, '#94A3B8');
newContent = newContent.replace(/var\(--border\)/g, '#334155');

// Correções específicas para manter padrão dark
newContent = newContent.replace(/linear-gradient\(180deg,\s*#0A0A0A\s*0%,\s*#141414\s*40%,\s*#1A1408\s*100%\)/g, '#0F172A');

// Inputs: a tela atual usa styles inline, vou substituir a cor de fundo e borda inline
newContent = newContent.replace(/background:\s*'rgba\(255,255,255,0\.04\)'/g, "background: '#1E293B'");
newContent = newContent.replace(/border:\s*'1px solid rgba\(255,255,255,0\.08\)'/g, "border: '1px solid #334155'");
newContent = newContent.replace(/e\.currentTarget\.style\.background = 'rgba\(255,255,255,0\.06\)'/g, "e.currentTarget.style.background = '#1E293B'");
newContent = newContent.replace(/e\.currentTarget\.style\.background = 'rgba\(255,255,255,0\.04\)'/g, "e.currentTarget.style.background = '#1E293B'");
newContent = newContent.replace(/e\.currentTarget\.style\.borderColor = 'rgba\(255,255,255,0\.08\)'/g, "e.currentTarget.style.borderColor = '#334155'");

// Botão Entrar: background: 'linear-gradient(135deg, #F59E0B 0%, #E09818 100%)',
// we already replaced var(--amber) with #F59E0B. Let's make it match exactly background: '#F59E0B'
newContent = newContent.replace(/background:\s*'linear-gradient\(135deg, #F59E0B 0%, #E09818 100%\)'/g, "background: '#F59E0B'");
newContent = newContent.replace(/color:\s*'#0A0A0A'/g, "color: '#0F172A'");

fs.writeFileSync(file, newContent, 'utf8');
console.log('Fixed ClienteLoginPrincipal.tsx');
