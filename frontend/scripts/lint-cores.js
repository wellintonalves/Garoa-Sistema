import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

const ARQUIVOS_PERMITIDOS = [
  'tokens.css',
  'tokens.ts'
];

// Regex para detectar hex literais (ex: #ffffff, #F97316) ou classes fixas do Tailwind (ex: bg-black, text-white, zinc-800, red-500)
const REGEX_CORES_FIXAS = /#(?:[0-9a-fA-F]{3,8})\b|(?:zinc|slate|gray|neutral|stone|red|green|blue|yellow|amber|indigo|purple|pink|black|white)-\d{2,3}|(?:bg|text|border)-(?:black|white)\b/g;

let errosEncontrados = 0;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanDir(filePath);
    } else if (/\.(tsx|ts|css)$/.test(file) && !file.endsWith('.test.ts') && !file.endsWith('.spec.ts')) {
      if (ARQUIVOS_PERMITIDOS.includes(file)) continue;

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const matches = line.match(REGEX_CORES_FIXAS);
        if (matches) {
          // Ignorar comentários explicativos que mencionem hex/cores por documentação
          if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
          
          console.error(`❌ Erro de lint (Cor Fixa) em ${path.relative(srcDir, filePath)}:${index + 1}`);
          console.error(`   Linha: "${line.trim()}"`);
          console.error(`   Ocorrência(s): ${matches.join(', ')}\n`);
          errosEncontrados++;
        }
      });
    }
  }
}

console.log('🔍 Executando lint:cores em frontend/src/ ...');
scanDir(srcDir);

if (errosEncontrados > 0) {
  console.error(`🚫 Falha no build: Foram encontradas ${errosEncontrados} ocorrências de cores hex literais ou classes fixas do Tailwind fora de tokens.css ou tokens.ts.`);
  console.error('👉 Por favor, utilize os tokens semânticos do Design System v2 (var(--cor-primaria), var(--sucesso), classes semânticas, etc.).');
  process.exit(1);
} else {
  console.log('✔ Lint de cores passou com sucesso: 0 hex literais e 0 classes fixas do Tailwind fora dos arquivos permitidos!');
  process.exit(0);
}
