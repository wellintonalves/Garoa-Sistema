import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import termos from '../../content/termos-de-uso.md?raw';
import privacidade from '../../content/politica-de-privacidade.md?raw';

// Os documentos são texto local versionado. Não executamos HTML do conteúdo.
function inline(texto: string): ReactNode {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) => parte.startsWith('**')
    ? <strong key={i}>{parte.slice(2, -2)}</strong> : <Fragment key={i}>{parte}</Fragment>);
}

export function DocumentoLegal({ tipo }: { tipo: 'termos' | 'privacidade' }) {
  const blocos = (tipo === 'termos' ? termos : privacidade).split(/\r?\n\s*\r?\n/);
  return <main className="min-h-screen bg-[var(--fundo-pagina)] text-[var(--texto-principal)] px-5 py-8 sm:py-12">
    <article className="max-w-3xl mx-auto min-w-0">
      <nav className="flex flex-wrap gap-4 mb-8 text-sm" aria-label="Documentos e acesso">
        <Link className="min-h-12 inline-flex items-center underline" to="/admin/login">Acesso da barbearia</Link>
        <Link className="min-h-12 inline-flex items-center underline" to="/">Acesso do cliente</Link>
        <Link className="min-h-12 inline-flex items-center underline" to={tipo === 'termos' ? '/politica-de-privacidade' : '/termos-de-uso'}>{tipo === 'termos' ? 'Política de Privacidade' : 'Termos de Uso'}</Link>
      </nav>
      <p className="text-sm text-[var(--texto-secundario)] mb-6">Versão 2026-09-15 · Documento para revisão nesta prévia local.</p>
      {blocos.map((bloco, indice) => {
        if (bloco.startsWith('# ')) return <h1 key={indice} className="text-3xl sm:text-4xl font-semibold mb-8">{bloco.slice(2)}</h1>;
        if (bloco.startsWith('## ')) return <h2 key={indice} className="text-xl font-semibold mt-9 mb-4">{bloco.slice(3)}</h2>;
        if (bloco.startsWith('### ')) return <h3 key={indice} className="text-lg font-semibold mt-6 mb-3">{bloco.slice(4)}</h3>;
        if (bloco.startsWith('|')) {
          const linhas = bloco.split(/\r?\n/).filter(l => !/^\|[\s:|-]+\|$/.test(l));
          return <div key={indice} className="overflow-x-auto my-6" tabIndex={0} role="region" aria-label="Comparação dos planos"><table className="w-full text-left text-sm"><tbody>{linhas.map((linha, i) => <tr key={i}>{linha.split('|').slice(1, -1).map((celula, j) => i === 0 ? <th key={j} className="p-3 bg-[var(--superficie-2)]">{inline(celula.trim())}</th> : <td key={j} className="p-3 align-top">{inline(celula.trim())}</td>)}</tr>)}</tbody></table></div>;
        }
        if (/^[-*] /.test(bloco)) return <ul key={indice} className="list-disc pl-6 mb-5 space-y-2">{bloco.split(/\r?\n/).map((linha, i) => <li key={i}>{inline(linha.replace(/^[-*] /, ''))}</li>)}</ul>;
        return <p key={indice} className="text-base leading-7 mb-5 whitespace-pre-line break-words">{inline(bloco)}</p>;
      })}
    </article>
  </main>;
}
