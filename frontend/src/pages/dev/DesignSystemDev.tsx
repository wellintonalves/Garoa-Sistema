import React, { useState } from 'react';
import { useModoTema } from '../../hooks/useModoTema';
import {
  Botao,
  Card,
  Campo,
  Input,
  Select,
  Textarea,
  Badge,
  Tabela,
  TabelaCabecalho,
  TabelaCorpo,
  TabelaLinha,
  TabelaCabecalhoCelula,
  TabelaCelula,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  ToastProvider,
  useToast,
  EstadoVazio,
} from '../../components/ui';
import { Search, Calendar } from 'lucide-react';

const ConteudoDev: React.FC = () => {
  const { modo, setModo } = useModoTema();
  const { addToast } = useToast();
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const ehEscuro = modo === 'dark' || (modo === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const alternarModo = () => setModo(ehEscuro ? 'light' : 'dark');

  const simularLoading = () => {
    setLoadingBtn(true);
    setTimeout(() => setLoadingBtn(false), 2500);
  };

  return (
    <div style={{ padding: 'var(--espaco-8) var(--espaco-6)', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--fonte-sans)', color: 'var(--texto-principal)' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espaco-8)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-6)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '2rem', fontWeight: 600, marginBottom: 'var(--espaco-2)' }}>
            Design System v2 — Showcase
          </h1>
          <p style={{ color: 'var(--texto-secundario)', fontSize: '1rem' }}>
            Auditoria visual completa de todos os componentes da Seção 7 em todas as variantes e estados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--espaco-3)' }}>
          <Botao variante="secundario" onClick={alternarModo}>
            Tema Atual: {ehEscuro ? '🌙 Escuro' : '☀️ Claro'}
          </Botao>
        </div>
      </div>

      {/* Seção 1: Botões */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          1. Botão (Botao.tsx)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--texto-secundario)', display: 'block', marginBottom: 'var(--espaco-2)' }}>Variantes em estado normal:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espaco-3)', alignItems: 'center' }}>
              <Botao variante="primario">Primário</Botao>
              <Botao variante="secundario">Secundário</Botao>
              <Botao variante="fantasma">Fantasma</Botao>
              <Botao variante="inverso">Inverso</Botao>
              <Botao variante="destrutivo">Destrutivo</Botao>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--texto-secundario)', display: 'block', marginBottom: 'var(--espaco-2)' }}>Estados (Desabilitado e Loading com largura travada):</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espaco-3)', alignItems: 'center' }}>
              <Botao variante="primario" disabled>Primário Disabled</Botao>
              <Botao variante="secundario" disabled>Secundário Disabled</Botao>
              <Botao variante="destrutivo" disabled>Destrutivo Disabled</Botao>
              <Botao variante="primario" loading={loadingBtn} onClick={simularLoading}>
                {loadingBtn ? 'Salvando...' : 'Clique para simular Loading (2.5s)'}
              </Botao>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 2: Cards */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          2. Card (Card.tsx)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--espaco-4)' }}>
          <Card>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 'var(--espaco-2)' }}>Card Padrão (Sem sombra em repouso)</h3>
            <p style={{ color: 'var(--texto-secundario)', fontSize: '0.875rem' }}>
              Fundo superfície com borda sutil. Ideal para containeres de informação e agrupamentos estáticos.
            </p>
          </Card>
          <Card clicavel onClick={() => addToast('Card clicável pressionado!', 'info')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--espaco-2)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 500 }}>Card Clicável</h3>
              <Badge variante="sucesso" ponto>Ativo</Badge>
            </div>
            <p style={{ color: 'var(--texto-secundario)', fontSize: '0.875rem' }}>
              Passe o mouse por cima para ver a transição para --fundo-superficie-2. Clique para testar!
            </p>
          </Card>
        </div>
      </section>

      {/* Seção 3: Campos */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          3. Campos de Formulário (Campo.tsx — Input, Select, Textarea)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--espaco-6)' }}>
          <div>
            <Input
              label="Nome Completo"
              placeholder="Digite seu nome..."
              hint="Nome que aparecerá nos agendamentos"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
          </div>
          <div>
            <Input
              label="Buscar Serviço"
              placeholder="Ex: Corte Degrade..."
              iconeEsquerda={<Search size={18} strokeWidth={1.75} />}
            />
          </div>
          <div>
            <Input
              label="E-mail de Contato"
              defaultValue="email.invalido@"
              erro="Por favor, insira um endereço de e-mail válido com @ e domínio."
            />
          </div>
          <div>
            <Input
              label="Campo Desabilitado"
              defaultValue="Informação travada pelo sistema"
              disabled
            />
          </div>
          <div>
            <Select label="Selecione o Barbeiro" hint="Escolha o profissional de sua preferência">
              <option value="">Selecione...</option>
              <option value="valen">Valentim (Especialista)</option>
              <option value="lucas">Lucas Silva</option>
            </Select>
          </div>
          <div>
            <Textarea
              label="Observações do Agendamento"
              placeholder="Ex: Prefiro corte com tesoura na parte superior..."
              hint="Máximo de 200 caracteres"
            />
          </div>
          <div>
            <Campo label="Campo Wrapper Customizado" hint="Uso do container de campo genérico">
              <div style={{ padding: '10px 14px', background: 'var(--fundo-superficie-2)', borderRadius: 'var(--raio-sm)', border: '1px solid var(--borda-forte)' }}>
                Elemento arbitrário com layout padronizado
              </div>
            </Campo>
          </div>
        </div>
      </section>

      {/* Seção 4: Badges */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          4. Badges / Status (Badge.tsx)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--texto-secundario)', display: 'block', marginBottom: 'var(--espaco-2)' }}>Com ponto indicativo (Padrão de status):</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espaco-3)' }}>
              <Badge variante="sucesso" ponto>Confirmado</Badge>
              <Badge variante="info" ponto>Em Atendimento</Badge>
              <Badge variante="aviso" ponto>Aguardando Pagamento</Badge>
              <Badge variante="erro" ponto>Cancelado</Badge>
              <Badge variante="neutro" ponto>Agendado</Badge>
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--texto-secundario)', display: 'block', marginBottom: 'var(--espaco-2)' }}>Sem ponto:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espaco-3)' }}>
              <Badge variante="sucesso">Concluído</Badge>
              <Badge variante="info">Novo</Badge>
              <Badge variante="aviso">Atenção</Badge>
              <Badge variante="erro">Falha</Badge>
              <Badge variante="neutro">Rascunho</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 5: Tabela */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          5. Tabela de Dados (Tabela.tsx)
        </h2>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Tabela>
            <TabelaCabecalho>
              <TabelaLinha>
                <TabelaCabecalhoCelula>Cliente</TabelaCabecalhoCelula>
                <TabelaCabecalhoCelula>Serviço</TabelaCabecalhoCelula>
                <TabelaCabecalhoCelula>Status</TabelaCabecalhoCelula>
                <TabelaCabecalhoCelula tipo="hora">Horário</TabelaCabecalhoCelula>
                <TabelaCabecalhoCelula tipo="monetario">Valor (R$)</TabelaCabecalhoCelula>
              </TabelaLinha>
            </TabelaCabecalho>
            <TabelaCorpo>
              <TabelaLinha>
                <TabelaCelula>Arthur Pendelton</TabelaCelula>
                <TabelaCelula>Corte + Barba Lenhador</TabelaCelula>
                <TabelaCelula><Badge variante="sucesso" ponto>Concluído</Badge></TabelaCelula>
                <TabelaCelula tipo="hora">14:30</TabelaCelula>
                <TabelaCelula tipo="monetario">R$ 85,00</TabelaCelula>
              </TabelaLinha>
              <TabelaLinha>
                <TabelaCelula>Gabriel Ferreira</TabelaCelula>
                <TabelaCelula>Corte Degradê</TabelaCelula>
                <TabelaCelula><Badge variante="info" ponto>Em Atendimento</Badge></TabelaCelula>
                <TabelaCelula tipo="hora">15:00</TabelaCelula>
                <TabelaCelula tipo="monetario">R$ 50,00</TabelaCelula>
              </TabelaLinha>
              <TabelaLinha>
                <TabelaCelula>Marcelo Souza</TabelaCelula>
                <TabelaCelula>Pigmentação + Sobrancelha</TabelaCelula>
                <TabelaCelula><Badge variante="aviso" ponto>Aguardando</Badge></TabelaCelula>
                <TabelaCelula tipo="hora">16:15</TabelaCelula>
                <TabelaCelula tipo="monetario">R$ 110,00</TabelaCelula>
              </TabelaLinha>
            </TabelaCorpo>
          </Tabela>
        </Card>
      </section>

      {/* Seção 6: Skeletons */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          6. Skeleton (Skeleton.tsx)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--espaco-6)' }}>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--texto-secundario)', display: 'block', marginBottom: 'var(--espaco-2)' }}>Skeleton Base Customizado:</span>
            <Skeleton width="100%" height={36} />
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--texto-secundario)', display: 'block', marginBottom: 'var(--espaco-2)' }}>Skeleton Card:</span>
            <SkeletonCard />
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--texto-secundario)', display: 'block', marginBottom: 'var(--espaco-2)' }}>Skeleton Texto (3 linhas):</span>
            <SkeletonText lines={3} />
          </div>
        </div>
      </section>

      {/* Seção 7: Toasts */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          7. Toast (Toast.tsx via useToast)
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espaco-3)' }}>
          <Botao
            variante="primario"
            onClick={() => addToast('Agendamento confirmado com sucesso para amanhã às 15h!', 'sucesso')}
          >
            Disparar Sucesso
          </Botao>
          <Botao
            variante="secundario"
            onClick={() => addToast('O horário selecionado não está mais disponível no sistema.', 'aviso')}
          >
            Disparar Aviso
          </Botao>
          <Botao
            variante="destrutivo"
            onClick={() => addToast('Erro ao conectar com o gateway de pagamento. Tente novamente.', 'erro')}
          >
            Disparar Erro
          </Botao>
          <Botao
            variante="fantasma"
            onClick={() => addToast('Novo barbeiro adicionado à escala de sábado.', 'info')}
          >
            Disparar Info
          </Botao>
        </div>
      </section>

      {/* Seção 8: EstadoVazio */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          8. Estado Vazio (EstadoVazio.tsx)
        </h2>
        <Card>
          <EstadoVazio
            icone={Calendar}
            titulo="Nenhum agendamento para hoje"
            descricao="Você ainda não possui horários agendados nesta data. Que tal agendar um novo cliente agora mesmo?"
            textoBotao="Novo Agendamento"
            onClickBotao={() => addToast('Ação de novo agendamento disparada!', 'sucesso')}
          />
        </Card>
      </section>

      {/* Seção 9: Comparação Lado a Lado (Claro vs Escuro) */}
      <section style={{ marginBottom: 'var(--espaco-10)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 'var(--espaco-4)', borderBottom: '1px solid var(--borda-sutil)', paddingBottom: 'var(--espaco-2)' }}>
          9. Comparação Lado a Lado Simultânea (Claro vs Escuro)
        </h2>
        <p style={{ color: 'var(--texto-secundario)', marginBottom: 'var(--espaco-4)' }}>
          Abaixo forçamos o tema localmente usando o atributo `data-tema` para demonstrar a consistência dos tokens em ambos os modos ao mesmo tempo.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--espaco-6)' }}>
          {/* Container Claro */}
          <div
            data-tema="claro"
            style={{
              background: '#FDFBF7', /* Fundo claro explicitamente forçado para a demo */
              color: '#1A1712',
              padding: 'var(--espaco-6)',
              borderRadius: 'var(--raio-lg)',
              border: '1px solid #EFE9DB',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espaco-4)' }}>
              <h3 style={{ fontWeight: 600 }}>☀️ Modo Claro (Forçado)</h3>
              <Badge variante="sucesso" ponto>Ativo</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
              <Card>
                <h4 style={{ fontWeight: 500, marginBottom: 'var(--espaco-1)' }}>Superfície em repouso</h4>
                <p style={{ fontSize: '0.8125rem', color: '#6E675C' }}>Texto secundário sobre o card no tema claro.</p>
              </Card>
              <div style={{ display: 'flex', gap: 'var(--espaco-2)' }}>
                <Botao variante="primario" style={{ flex: 1 }}>Primário</Botao>
                <Botao variante="secundario" style={{ flex: 1 }}>Secundário</Botao>
              </div>
            </div>
          </div>

          {/* Container Escuro */}
          <div
            data-tema="escuro"
            style={{
              background: '#0A0A0A', /* Fundo escuro explicitamente forçado para a demo */
              color: '#F4F4F4',
              padding: 'var(--espaco-6)',
              borderRadius: 'var(--raio-lg)',
              border: '1px solid #262626',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--espaco-4)' }}>
              <h3 style={{ fontWeight: 600 }}>🌙 Modo Escuro (Forçado)</h3>
              <Badge variante="info" ponto>Ativo</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
              <Card>
                <h4 style={{ fontWeight: 500, marginBottom: 'var(--espaco-1)' }}>Superfície em repouso</h4>
                <p style={{ fontSize: '0.8125rem', color: '#8F8F8F' }}>Texto secundário sobre o card no tema escuro.</p>
              </Card>
              <div style={{ display: 'flex', gap: 'var(--espaco-2)' }}>
                <Botao variante="primario" style={{ flex: 1 }}>Primário</Botao>
                <Botao variante="secundario" style={{ flex: 1 }}>Secundário</Botao>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export const DesignSystemDev: React.FC = () => {
  return (
    <ToastProvider>
      <ConteudoDev />
    </ToastProvider>
  );
};
