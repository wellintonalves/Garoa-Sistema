import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agendar } from './Agendar';
import { Fidelidade } from './Fidelidade';

const estado = vi.hoisted(() => ({ cliente: null as null | { clienteId: string }, carregando: false }));
vi.mock('../../hooks/useClienteAuth', () => ({ useClienteAuth: () => estado }));

beforeEach(() => { estado.cliente = null; estado.carregando = false; });

function render(pagina: React.ReactNode, caminho = '/agendar') {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[caminho]}>{pagina}</MemoryRouter>);
}

describe('Entradas públicas usam identidade verificada', () => {
  it('agendamento mantém acesso a login e cadastro sem pedir telefone como identidade', () => {
    const html = render(<Agendar />);
    expect(html).toContain('Agende seu atendimento');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/cadastro"');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('telefone');
  });
  it('fidelidade não permite pesquisar dados de outro telefone', () => {
    const html = render(<Fidelidade />, '/fidelidade');
    expect(html).toContain('Acesse sua conta');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Consultar outro número');
  });
  it('cliente conectado continua no fluxo existente e mantém a unidade selecionada pelo slug', () => {
    estado.cliente = { clienteId: 'cliente-fixture' };
    const html = render(<Agendar />, '/agendar?slug=barbearia-a');
    expect(html).toContain('href="/cliente/home?slug=barbearia-a"');
    expect(html).not.toContain('Criar conta');
  });
  it('carregamento de sessão não exibe ações prematuras', () => {
    estado.carregando = true;
    const html = render(<Agendar />);
    expect(html).not.toContain('Entrar na minha conta');
    expect(html).not.toContain('Escolher barbearia');
  });
});
