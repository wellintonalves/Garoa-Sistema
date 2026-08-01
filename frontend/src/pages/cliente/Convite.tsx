import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clienteApi from '../../api/clienteApi';
import { SkeletonPage } from '../../components/ui/Skeleton';
import { EstadoVazio } from '../../components/ui/EstadoVazio';
import { Gift } from '@phosphor-icons/react';

export function Convite() {
  const { slug, codigo } = useParams<{ slug: string; codigo: string }>();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [barbearia, setBarbearia] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    if (!slug || !codigo) {
      setErro('Link de convite inválido.');
      return;
    }

    // Busca a barbearia pelo slug
    clienteApi.get(`/publico/barbearia/slug/${slug}`)
      .then(async (res: any) => {
        setBarbearia(res.data);
        
        const token = localStorage.getItem('@garoa:cliente_token');
        
        if (token) {
          // Usuário já está logado. Conecta automaticamente.
          try {
            await clienteApi.post('/cliente/conectar-barbearia', {
              barbeariaId: res.data.id,
              codigoIndicacao: codigo
            });
            // Conectado com sucesso (ou já era conectado), vai direto pra área
            navigate(`/cliente/barbearia/${res.data.id}`);
            return;
          } catch (err: any) {
             const status = err.response?.status;
             if (status === 401) {
               // Token expirado. Segue pro cadastro/login
             } else {
               // Fraude, já conectado, etc. Ignora e vai pra barbearia
               navigate(`/cliente/barbearia/${res.data.id}`);
               return;
             }
          }
        }
        
        // Se não logado (ou token expirou), salva intenção no localStorage e vai pro cadastro
        localStorage.setItem('valen_invite_code', codigo);
        localStorage.setItem('valen_invite_barbearia', res.data.id);
        localStorage.setItem('valen_invite_barbearia_nome', res.data.nome);
        
        // Direciona o usuário para o cadastro
        setTimeout(() => {
          navigate(`/cadastro`);
        }, 1500);
      })
      .catch(() => {
        setErro('Barbearia não encontrada.');
      });
  }, [slug, codigo, navigate]);

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--fundo-pagina)]">
        <EstadoVazio 
          titulo="Ops!" 
          descricao={erro} 
          icone={<Gift size={48} />}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--fundo-pagina)] animate-fade-in text-center">
      <div className="w-16 h-16 rounded-full bg-[rgba(var(--cor-primaria-rgb),0.1)] flex items-center justify-center mb-6">
        <Gift size={32} weight="fill" className="text-[var(--cor-primaria)] animate-pulse" />
      </div>
      
      <h1 className="text-xl font-serif font-bold text-[var(--text-primary)] mb-2">
        Processando seu convite...
      </h1>
      
      {barbearia && (
        <p className="text-sm font-interface text-[var(--texto-secundario)]">
          Conectando você a <strong>{barbearia.nome}</strong>.
        </p>
      )}
      
      {!barbearia && <SkeletonPage className="mt-4" />}
    </div>
  );
}
