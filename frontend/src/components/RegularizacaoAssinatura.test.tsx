import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RegularizacaoAssinatura, validarFaturaAsaas } from './RegularizacaoAssinatura';

describe('Regularização da assinatura', () => {
  it('recusa links de outro ambiente, domínio ou com credenciais', () => {
    expect(validarFaturaAsaas('https://www.asaas.com/i/1', 'PRODUCTION')).toContain('/i/1');
    for (const url of ['https://sandbox.asaas.com/i/1', 'https://asaas.com.evil.test/i/1', 'http://asaas.com/i/1', 'https://x:y@asaas.com/i/1', 'https://asaas.com:8443/i/1']) {
      expect(() => validarFaturaAsaas(url, 'PRODUCTION')).toThrow();
    }
  });
  it('mostra revisão sem induzir novo pagamento ou atualização do cartão', () => {
    const html = renderToStaticMarkup(<RegularizacaoAssinatura status="ATIVA" ambiente="PRODUCTION" renovacaoAutomatica revisao={{ mensagem: 'Há uma contestação.' }} />);
    expect(html).toContain('Há uma contestação');
    expect(html).toContain('Falar com o suporte');
    expect(html).not.toContain('Consultar fatura');
    expect(html).not.toContain('Atualizar cartão');
  });
  it('oferece fatura pendente e exige aceite para o cartão de uma assinatura ativa', () => {
    const pendente = renderToStaticMarkup(<RegularizacaoAssinatura status="PAGAMENTO_PENDENTE" ambiente="PRODUCTION" renovacaoAutomatica />);
    expect(pendente).toContain('Consultar fatura');
    expect(pendente).not.toContain('Atualizar cartão');
    const ativa = renderToStaticMarkup(<RegularizacaoAssinatura status="ATIVA" ambiente="PRODUCTION" renovacaoAutomatica />);
    expect(ativa).toMatch(/disabled="">Atualizar cartão/);
    expect(ativa).toContain('sem cobrar agora');
  });
});
