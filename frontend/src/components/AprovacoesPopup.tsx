import { useState, useEffect } from 'react';
import barbeiroApi from '../api/barbeiroApi';
import { AlertCircle, Check, X } from 'lucide-react';
import { useBarbeiroAuth } from '../hooks/useBarbeiroAuth';

interface Aprovacao {
  id: string;
  acao: string;
  dadosNovos: any;
  createdAt: string;
  lancamento?: {
    servico?: { nome: string };
    descricao?: string;
    valor?: number;
    categoria?: string;
  };
}

export function AprovacoesPopup() {
  const { barbeiro } = useBarbeiroAuth();
  const [pendentes, setPendentes] = useState<Aprovacao[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (barbeiro) {
      buscarPendentes();
    }
  }, [barbeiro]);

  const buscarPendentes = async () => {
    try {
      const res = await barbeiroApi.get('/aprovacoes/pendentes');
      setPendentes(res.data);
    } catch (e) {
      console.error('Erro ao buscar aprovações pendentes:', e);
    }
  };

  const handleAprovar = async (id: string) => {
    setCarregando(true);
    try {
      await barbeiroApi.post(`/aprovacoes/${id}/aprovar`);
      buscarPendentes();
    } catch (e: any) {
      alert(e?.response?.data?.erro || 'Erro ao aprovar.');
    } finally {
      setCarregando(false);
    }
  };

  const handleRejeitar = async (id: string) => {
    setCarregando(true);
    try {
      await barbeiroApi.post(`/aprovacoes/${id}/rejeitar`);
      buscarPendentes();
    } catch (e: any) {
      alert(e?.response?.data?.erro || 'Erro ao rejeitar.');
    } finally {
      setCarregando(false);
    }
  };

  if (pendentes.length === 0) return null;

  const atual = pendentes[0];

  let titulo = 'Ação de Lançamento';
  if (atual.acao === 'EDITAR') titulo = 'Edição de Lançamento';
  if (atual.acao === 'EXCLUIR') titulo = 'Exclusão de Lançamento';
  if (atual.acao === 'ADICIONAR') titulo = 'Adição de Serviço Extra';

  const fmt = (v: any) => {
    if (v === null || v === undefined) return '';
    const num = Number(v);
    if (!isNaN(num)) return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return String(v);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      backdropFilter: 'blur(4px)'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '24px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <AlertCircle size={24} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Ação Requerida
            </h3>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
              {pendentes.length} {pendentes.length === 1 ? 'solicitação pendente' : 'solicitações pendentes'}
            </p>
          </div>
        </div>
        
        <div style={{ background: 'var(--bg-surface2)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {titulo}
          </p>
          <div style={{
            fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0
          }}>
            {atual.acao === 'EXCLUIR' && (
              <p>Confirma a exclusão do lançamento de {fmt(atual.lancamento?.valor)} ({atual.lancamento?.servico?.nome || atual.lancamento?.categoria})?</p>
            )}
            {atual.acao === 'EDITAR' && (
              <>
                <p>O administrador solicitou a edição dos valores:</p>
                <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                  {atual.dadosNovos?.valor !== undefined && <li>Novo Valor: {fmt(atual.dadosNovos.valor)}</li>}
                  {atual.dadosNovos?.valorComissao !== undefined && <li>Nova Comissão: {fmt(atual.dadosNovos.valorComissao)}</li>}
                  {atual.dadosNovos?.formaPagamento && <li>Forma de Pgto: {atual.dadosNovos.formaPagamento}</li>}
                </ul>
              </>
            )}
            {atual.acao === 'ADICIONAR' && (
              <>
                <p>O administrador adicionou um serviço extra ao seu lançamento:</p>
                <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                  <li>Valor do Serviço Extra: {fmt(atual.dadosNovos?.valor)}</li>
                  <li>Forma de Pgto: {atual.dadosNovos?.formaPagamento}</li>
                </ul>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            style={{ flex: 1, borderColor: 'var(--error-border)', color: 'var(--error-text)' }}
            onClick={() => handleRejeitar(atual.id)}
            disabled={carregando}
          >
            <X size={16} /> Rejeitar
          </button>
          <button 
            className="btn-primary" 
            style={{ flex: 1, background: 'var(--success-text)', color: '#000' }}
            onClick={() => handleAprovar(atual.id)}
            disabled={carregando}
          >
            <Check size={16} /> Aprovar
          </button>
        </div>
      </div>
    </div>
  );
}
