export const VERSAO_DOCUMENTOS = '2026-09-15';

export function dadosAceiteDocumentos(aceito: boolean) {
  return { aceito, termosVersao: VERSAO_DOCUMENTOS, privacidadeVersao: VERSAO_DOCUMENTOS };
}

export function LinksDocumentos() {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espaco-2)', justifyContent: 'center', fontSize: '0.875rem' }}>
    <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--texto-principal)', textDecoration: 'underline', minHeight: 48, display: 'inline-flex', alignItems: 'center' }}>Termos de Uso</a>
    <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--texto-principal)', textDecoration: 'underline', minHeight: 48, display: 'inline-flex', alignItems: 'center' }}>Política de Privacidade</a>
  </div>;
}

export function AceiteDocumentos({ aceito, onChange }: { aceito: boolean; onChange: (valor: boolean) => void }) {
  return <div style={{ width: '100%', minWidth: 0, color: 'var(--texto-principal)', fontSize: '0.875rem', lineHeight: 1.5 }}>
    <LinksDocumentos />
    <label style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 48, cursor: 'pointer' }}>
      <input type="checkbox" required checked={aceito} onChange={e => onChange(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0 }} />
      <span>Li e aceito os Termos de Uso e estou ciente da Política de Privacidade.</span>
    </label>
  </div>;
}
