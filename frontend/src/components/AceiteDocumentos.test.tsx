import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AceiteDocumentos, dadosAceiteDocumentos } from './AceiteDocumentos';

describe('Aceite de documentos no cadastro', () => {
  it('começa sem autorização e exige decisão expressa, separada de promoções', () => {
    const html = renderToStaticMarkup(<AceiteDocumentos aceito={false} onChange={() => {}} />);
    expect(html).toContain('required=""');
    expect(html).not.toContain('checked=""');
    expect(html).toContain('href="/termos-de-uso"');
    expect(html).toContain('href="/politica-de-privacidade"');
    expect(dadosAceiteDocumentos(false).aceito).toBe(false);
  });
  it('envia ambas as versões sem timestamp fabricado no navegador', () => {
    expect(dadosAceiteDocumentos(true)).toEqual({ aceito: true, termosVersao: '2026-09-15', privacidadeVersao: '2026-09-15' });
  });
});
