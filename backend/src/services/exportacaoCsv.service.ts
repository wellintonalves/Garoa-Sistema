type Linha = Record<string, unknown>;

export interface ArquivoExportacao {
  nome: string;
  conteudo: string;
}

function protegerFormula(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function serializarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') return JSON.stringify(valor);
  return protegerFormula(String(valor));
}

function escaparCsv(valor: unknown): string {
  const texto = serializarValor(valor).replace(/"/g, '""');
  return `"${texto}"`;
}

export function gerarCsv(registros: Linha[]): string {
  if (registros.length === 0) return '\uFEFF';
  const colunas = [...new Set(registros.flatMap((registro) => Object.keys(registro)))];
  const linhas = [
    colunas.map(escaparCsv).join(';'),
    ...registros.map((registro) => colunas.map((coluna) => escaparCsv(registro[coluna])).join(';')),
  ];
  return `\uFEFF${linhas.join('\r\n')}\r\n`;
}

export function gerarArquivosExportacao(exportacao: {
  formato: string;
  versao: number;
  geradoEm: string;
  barbeariaId: string;
  dados: Record<string, unknown>;
}): ArquivoExportacao[] {
  const categorias = Object.entries(exportacao.dados).map(([nome, valor]) => {
    const registros = Array.isArray(valor) ? valor : valor ? [valor] : [];
    return { nome, registros: registros as Linha[] };
  });
  const manifesto = {
    formato: 'VALEN_EXPORTACAO_ZIP_CSV',
    versao: exportacao.versao,
    geradoEm: exportacao.geradoEm,
    fusoDatasOperacionais: 'America/Sao_Paulo',
    datasTecnicas: 'ISO 8601 conforme armazenado',
    separadorCsv: ';',
    codificacao: 'UTF-8 com BOM',
    categorias: categorias.map(({ nome, registros }) => ({ arquivo: `${nome}.csv`, registros: registros.length })),
  };
  const readme = [
    'EXPORTAÇÃO DE DADOS — VALEN BARBER',
    '',
    'Cada categoria operacional está em um CSV UTF-8 separado por ponto e vírgula.',
    'IDs preservam as relações entre arquivos. Objetos e listas aparecem como JSON dentro da célula.',
    'Datas técnicas usam ISO 8601; datas operacionais devem ser interpretadas no fuso America/Sao_Paulo.',
    'Campos iniciados por =, +, -, @, tabulação ou retorno recebem apóstrofo para impedir fórmulas em planilhas.',
    'Senhas, hashes, tokens e códigos de autenticação não fazem parte deste pacote.',
  ].join('\r\n');

  return [
    { nome: 'README.txt', conteudo: readme },
    { nome: 'manifesto.json', conteudo: JSON.stringify(manifesto, null, 2) },
    ...categorias.map(({ nome, registros }) => ({ nome: `${nome}.csv`, conteudo: gerarCsv(registros) })),
  ];
}
