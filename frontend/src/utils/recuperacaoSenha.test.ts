import { describe, expect, it } from 'vitest';
import { criarContextoRecuperacao, loginDaRecuperacao, papelRecuperacaoDoPerfil } from './recuperacaoSenha';

describe('contexto da recuperação de senha', () => {
  it.each([
    ['admin', 'ADMIN'],
    ['cliente', 'CLIENTE'],
    ['barbeiro', 'BARBEIRO'],
    [null, 'CLIENTE'],
    ['desconhecido', 'CLIENTE'],
    ['__proto__', 'CLIENTE'],
  ] as const)('preenche o tipo de conta a partir de %s', (perfil, papel) => {
    expect(papelRecuperacaoDoPerfil(perfil)).toBe(papel);
  });

  it('normaliza o email e a barbearia e preserva o tipo de conta', () => {
    expect(criarContextoRecuperacao({
      email: '  Pessoa@Example.COM ', papel: 'BARBEIRO', barbeariaSlug: ' Minha-Barbearia ',
    })).toEqual({ email: 'pessoa@example.com', papel: 'BARBEIRO', barbeariaSlug: 'minha-barbearia' });
  });

  it('omite barbearia vazia para a conta global de cliente', () => {
    expect(criarContextoRecuperacao({ email: 'pessoa@example.com', papel: 'CLIENTE', barbeariaSlug: '  ' }))
      .toEqual({ email: 'pessoa@example.com', papel: 'CLIENTE' });
  });

  it('mantém a conta enviada imutável para reenvio e redefinição', () => {
    const formulario = { email: 'Pessoa@Example.com', papel: 'BARBEIRO' as const, barbeariaSlug: 'primeira' };
    const enviado = criarContextoRecuperacao(formulario);
    formulario.email = 'outra@example.com';
    formulario.barbeariaSlug = 'segunda';
    expect(Object.isFrozen(enviado)).toBe(true);
    expect(Reflect.set(enviado, 'papel', 'ADMIN')).toBe(false);
    const reenvio = { ...enviado };
    const redefinicao = { ...enviado, codigo: '123456', novaSenha: 'senha-de-teste' };
    expect(reenvio).toEqual({ email: 'pessoa@example.com', papel: 'BARBEIRO', barbeariaSlug: 'primeira' });
    expect(redefinicao).toMatchObject(reenvio);
    expect(enviado).not.toHaveProperty('codigo');
    expect(enviado).not.toHaveProperty('novaSenha');
  });

  it('mantém separadas contas de tipos diferentes com o mesmo email', () => {
    const email = 'pessoa@example.com';
    const cliente = criarContextoRecuperacao({ email, papel: 'CLIENTE' });
    const admin = criarContextoRecuperacao({ email, papel: 'ADMIN' });
    expect(cliente).not.toEqual(admin);
  });

  it('volta ao acesso correspondente à conta recuperada', () => {
    expect(loginDaRecuperacao({ papel: 'ADMIN' })).toBe('/admin/login');
    expect(loginDaRecuperacao({ papel: 'BARBEIRO' })).toBe('/barbeiro/login');
    expect(loginDaRecuperacao({ papel: 'CLIENTE' })).toBe('/');
    expect(loginDaRecuperacao({ papel: 'CLIENTE', barbeariaSlug: ' Minha-Barbearia ' })).toBe('/b/minha-barbearia/login');
  });
});
