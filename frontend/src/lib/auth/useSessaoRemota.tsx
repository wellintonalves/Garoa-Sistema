import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { type AxiosInstance } from 'axios';
import { limparSessao } from './limparSessao';
import { controlarSessaoRemota, destinoLogin, portalDoCaminho, type EstadoSessao, type Portal } from './controlarSessaoRemota';

export function useSessaoRemota<T>(api: AxiosInstance, caminho: string, campo: string, portal: Portal) {
  const [estado, setEstado] = useState<EstadoSessao<T>>({ dados: null, carregando: true, erro: '' });
  const controle = useMemo(() => controlarSessaoRemota<T>(api, caminho, campo, {
    atualizar: setEstado,
    limparLegado: limparSessao,
    aposLogout: () => { window.location.href = destinoLogin(portal, window.location.pathname); },
  }), [api, caminho, campo, portal]);

  useEffect(() => {
    void controle.iniciar();
    return controle.parar;
  }, [controle]);

  return { ...estado, setDados: controle.setDados, tentarNovamente: controle.tentarNovamente, logout: controle.logout };
}

export function FalhaSessao({ erro, portal, tentarNovamente, children }: { erro: string; portal: Portal; tentarNovamente: () => void; children: ReactNode }) {
  if (!erro || portalDoCaminho(window.location.pathname) !== portal) return <>{children}</>;
  return <div role="alert" className="p-6"><p>{erro}</p><button className="ds-btn ds-btn-primary" onClick={tentarNovamente}>Tentar novamente</button></div>;
}
