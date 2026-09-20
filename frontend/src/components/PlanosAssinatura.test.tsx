import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanosAssinatura, precoPlano } from './PlanosAssinatura';

describe('Oferta dos planos', () => {
  it('cobra doze meses pelo equivalente a dez mensalidades, em ambos os planos', () => {
    expect(precoPlano('BASICO', 'MENSAL')).toBe(3999);
    expect(precoPlano('PRO', 'MENSAL')).toBe(6999);
    for (const plano of ['BASICO', 'PRO'] as const) {
      expect(precoPlano(plano, 'ANUAL')).toBe(precoPlano(plano, 'MENSAL') * 10);
    }
  });
  it('mantém Pró visível, mas impede seleção quando a oferta não está liberada', () => {
    const html = renderToStaticMarkup(<PlanosAssinatura plano="BASICO" periodicidade="ANUAL" proDisponivel={false} onChange={() => {}} />);
    expect(html).toMatch(/<button[^>]*data-plano="PRO"[^>]*disabled=""/);
    expect(html).toContain('Pró indisponível');
    expect(html).toContain('Pagamento anual à vista');
    expect(html).toContain('399,90');
    expect(html).toContain('699,90');
    expect(html).toContain('Loja virtual é um recurso futuro e não faz parte dos planos atuais');
  });
  it('identifica corretamente Pró selecionado quando liberado', () => {
    const html = renderToStaticMarkup(<PlanosAssinatura plano="PRO" periodicidade="MENSAL" proDisponivel onChange={() => {}} />);
    expect(html).toMatch(/<button[^>]*data-plano="PRO"[^>]*aria-pressed="true"/);
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('Até 200 clientes ativos');
    expect(html).toContain('Clientes ativos ilimitados');
  });
});
