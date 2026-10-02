import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RecuperarSenha } from './RecuperarSenha';

function renderizarRecuperacao(query = '') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/recuperar-senha${query}`]}>
      <RecuperarSenha />
    </MemoryRouter>,
  );
}

describe('entrada da recuperação de senha', () => {
  it.each([
    ['admin', 'ADMIN', 'Administrador'],
    ['cliente', 'CLIENTE', 'Cliente'],
    ['barbeiro', 'BARBEIRO', 'Barbeiro'],
  ])('pré-seleciona a conta ao abrir o link de %s', (perfil, papel, rotulo) => {
    const html = renderizarRecuperacao(`?perfil=${perfil}`);
    expect(html).toContain(`<option value="${papel}" selected="">${rotulo}</option>`);
    expect(html).toContain('Tipo de conta');
  });

  it('pré-preenche a barbearia sem consultar os vínculos do email', () => {
    const html = renderizarRecuperacao('?perfil=cliente&barbeariaSlug=minha-barbearia');
    expect(html).toContain('value="minha-barbearia"');
    expect(html).toContain('Endereço da barbearia (opcional)');
    expect(html).toContain('Se criou sua conta na página principal, deixe em branco.');
  });

  it('limita os campos e mantém os atributos de email para celular', () => {
    const html = renderizarRecuperacao(`?barbeariaSlug=${'a'.repeat(150)}`);
    expect(html).toContain('maxLength="254"');
    expect(html).toContain('maxLength="100"');
    expect(html).toContain('inputMode="email"');
    expect(html).toContain('autoCapitalize="none"');
    expect(html).toContain('autoCorrect="off"');
    expect(html).toContain('spellCheck="false"');
    expect(html).toContain(`value="${'a'.repeat(100)}"`);
    expect(html).not.toContain('a'.repeat(101));
  });
});
