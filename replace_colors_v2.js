const fs = require('fs');
const path = require('path');

// ============================================================
// MAPA DE SUBSTITUIÇÕES
// Ordem importa: mais específico primeiro
// ============================================================
const SUBSTITUICOES = [

  // --- CATEGORIA B: Transparências e variantes dim/light ---
  // Inline style com var(--amber-dim) ou var(--amber-light)
  { de: /var\(--amber-dim\)/g,              para: 'rgba(var(--cor-primaria-rgb), 0.10)' },
  { de: /var\(--amber-light\)/g,            para: 'rgba(var(--cor-primaria-rgb), 0.15)' },

  // Tailwind arbitrário com transparência
  { de: /bg-\[var\(--amber-dim\)\]/g,       para: 'bg-[rgba(var(--cor-primaria-rgb),0.10)]' },
  { de: /bg-\[var\(--amber-light\)\]/g,     para: 'bg-[rgba(var(--cor-primaria-rgb),0.15)]' },

  // --- CATEGORIA A: Cor direta via variável CSS ---
  { de: /text-\[var\(--amber\)\]/g,         para: 'text-[var(--cor-primaria)]' },
  { de: /bg-\[var\(--amber\)\]/g,           para: 'bg-[var(--cor-primaria)]' },
  { de: /border-\[var\(--amber\)\]/g,       para: 'border-[var(--cor-primaria)]' },
  { de: /ring-\[var\(--amber\)\]/g,         para: 'ring-[var(--cor-primaria)]' },
  { de: /fill-\[var\(--amber\)\]/g,         para: 'fill-[var(--cor-primaria)]' },
  { de: /stroke-\[var\(--amber\)\]/g,       para: 'stroke-[var(--cor-primaria)]' },
  { de: /shadow-\[var\(--amber\)\]/g,       para: 'shadow-[var(--cor-primaria)]' },

  // Inline styles com var(--amber)
  { de: /color: 'var\(--amber\)'/g,         para: "color: 'var(--cor-icone)'" },
  { de: /backgroundColor: 'var\(--amber\)'/g, para: "backgroundColor: 'var(--cor-primaria)'" },
  { de: /borderColor: 'var\(--amber\)'/g,   para: "borderColor: 'var(--cor-primaria)'" },

  // Hover states com variável
  { de: /hover:text-\[var\(--amber\)\]/g,   para: 'hover:text-[var(--cor-icone)]' },
  { de: /hover:bg-\[var\(--amber\)\]/g,     para: 'hover:bg-[var(--cor-primaria)]' },
  { de: /hover:border-\[var\(--amber\)\]/g, para: 'hover:border-[var(--cor-primaria)]' },

  // --- CATEGORIA C: Classes Tailwind hardcoded amber ---
  // Atenção: substituição semântica — amber-X vira cor-primaria
  { de: /\btext-amber-\d{2,3}\b/g,          para: 'text-[var(--cor-primaria)]' },
  { de: /\bbg-amber-\d{2,3}\b/g,            para: 'bg-[var(--cor-primaria)]' },
  { de: /\bborder-amber-\d{2,3}\b/g,        para: 'border-[var(--cor-primaria)]' },
  { de: /\bring-amber-\d{2,3}\b/g,          para: 'ring-[var(--cor-primaria)]' },
  { de: /\bfill-amber-\d{2,3}\b/g,          para: 'fill-[var(--cor-primaria)]' },

  // Hover hardcoded
  { de: /\bhover:text-amber-\d{2,3}\b/g,    para: 'hover:text-[var(--cor-icone)]' },
  { de: /\bhover:bg-amber-\d{2,3}\b/g,      para: 'hover:bg-[var(--cor-primaria)]' },
  { de: /\bhover:border-amber-\d{2,3}\b/g,  para: 'hover:border-[var(--cor-primaria)]' },

  // Focus hardcoded
  { de: /\bfocus:ring-amber-\d{2,3}\b/g,    para: 'focus:ring-[var(--cor-primaria)]' },
  { de: /\bfocus:border-amber-\d{2,3}\b/g,  para: 'focus:border-[var(--cor-primaria)]' },
];

// ============================================================
// WALKER — percorre /frontend/src recursivamente
// ============================================================
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = dir + '/' + file;
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.css')) {
      results.push(fullPath);
    }
  });
  return results;
}

// ============================================================
// EXECUÇÃO
// ============================================================
const files = walk('./frontend/src');
let totalArquivosAlterados = 0;
let totalSubstituicoes = 0;
const relatorio = [];

files.forEach(file => {
  const original = fs.readFileSync(file, 'utf8');
  let modificado = original;
  let substituicoesNoArquivo = 0;

  SUBSTITUICOES.forEach(({ de, para }) => {
    const matches = modificado.match(de);
    if (matches) {
      substituicoesNoArquivo += matches.length;
      totalSubstituicoes += matches.length;
      modificado = modificado.replace(de, para);
    }
  });

  if (original !== modificado) {
    fs.writeFileSync(file, modificado, 'utf8');
    totalArquivosAlterados++;
    relatorio.push({ arquivo: file, substituicoes: substituicoesNoArquivo });
  }
});

// ============================================================
// RELATÓRIO FINAL
// ============================================================
console.log('\n========================================');
console.log('  GAROA — Refatoração de Tematização');
console.log('========================================');
console.log(`Arquivos modificados : ${totalArquivosAlterados}`);
console.log(`Total de substituições: ${totalSubstituicoes}`);
console.log('\nDetalhamento por arquivo:');
relatorio
  .sort((a, b) => b.substituicoes - a.substituicoes)
  .forEach(({ arquivo, substituicoes }) => {
    console.log(`  [${substituicoes}x]  ${arquivo.replace('./frontend/src/', '')}`);
  });
console.log('========================================\n');
