import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FalhaSessao } from './useSessaoRemota';
import { type Portal } from './controlarSessaoRemota';

afterEach(() => vi.unstubAllGlobals());

describe('erro da sessão na interface', () => {
  const portais: Portal[] = ['admin', 'cliente', 'barbeiro', 'tenant'];
  it.each([
    ['admin', '/admin/login'], ['cliente', '/'], ['barbeiro', '/barbeiro/login'], ['tenant', '/b/valen/login'],
  ] as const)('somente o portal ativo %s mostra o erro e tentar novamente', (ativo, pathname) => {
    vi.stubGlobal('window', { location: { pathname } });
    for (const portal of portais) {
      const html = renderToStaticMarkup(<FalhaSessao erro="Falha de conexão" portal={portal} tentarNovamente={() => undefined}><p>Conteúdo</p></FalhaSessao>);
      if (portal === ativo) {
        expect(html).toContain('role="alert"');
        expect(html).toContain('Tentar novamente');
        expect(html).not.toContain('Conteúdo');
      } else {
        expect(html).toContain('Conteúdo');
        expect(html).not.toContain('role="alert"');
      }
    }
  });
  it('estado sem erro mantém o conteúdo', () => {
    vi.stubGlobal('window', { location: { pathname: '/admin/login' } });
    expect(renderToStaticMarkup(<FalhaSessao erro="" portal="admin" tentarNovamente={() => undefined}><p>Conteúdo</p></FalhaSessao>)).toBe('<p>Conteúdo</p>');
  });
});
