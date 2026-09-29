# Valéria: integração e condições para lançamento

Verificação local de 29/09/2026. Base desta entrega: `da541cc`, na branch `codex/base-agente-ia`. A base já contém 24 commits posteriores a `origin/main` (`3b57fd9`). Integrar somente os commits novos não leva toda a Valéria para a main.

## Entregue no código

O servidor normal instala o transporte de voz no mesmo servidor HTTP do Express quando `IA_VOZ_ENABLED=true`. O frontend recebe a URL WSS do backend, sem endereço local fixo em produção. A chave OpenAI permanece no backend. A voz continua Marin, com fala natural.

As rotas autenticadas de administrador, barbeiro e cliente emitem tickets assinados de 15 segundos. O WebSocket exige origem HTTPS explicitamente permitida. A identidade é revalidada no repositório, e as ferramentas são limitadas por perfil. O identificador do ticket vira a chave idempotente no PostgreSQL; a transição atômica para envio impede reutilização em outra réplica. A exclusividade por usuário/barbearia também é conferida dentro da transação, sem depender apenas da memória do processo.

Mantidos os limites de 90 segundos por chamada, reserva técnica máxima de US$ 0,09, envelope conservador por resposta e 30 minutos na franquia Pro. A reserva se ajusta ao saldo existente, com conversão para a unidade de crédito configurada. O encerramento libera a parte não consumida somente quando o uso é confirmado. A interface consulta novamente a disponibilidade enquanto a chamada anterior encerra. Não há mais contagem fixa de três respostas.

O anúncio usa a arte aprovada em um modal de até 960 pixels, com X visível, Escape, foco inicial no X e retorno ao botão da assistente. Ao fechar, aparece a dica dispensável “Fale com a Valéria aqui”, com seta ancorada no botão real; clicar nela abre o chat. O anúncio depende de disponibilidade confirmada pela API e aparece uma vez por identidade, barbearia, perfil e versão no armazenamento deste navegador. Outro dispositivo pode apresentá-lo novamente. Sem armazenamento persistente, a lembrança dura a sessão da página.

O modal explica que a assistente consulta e orienta, mas não altera registros nem agenda. A arte aprovada contém uma frase mais ampla sobre automação; esse texto não foi alterado. O anúncio está integrado aos layouts atuais de administrador, barbeiro e cliente; o fluxo legado `/b/:slug/app` continua fora dessa integração.

## Validação executada

Passaram `test:ia`, `test:ia-postgres`, `test:ia-analises`, `test:ia-contexto`, `test:ia-ajuda`, `test:ia-comissoes`, `test:ia-voz` e `test:ia-voz-producao`, no workspace do backend. Os testes de banco usam exclusivamente PostgreSQL local em 127.0.0.1:55439, com fixtures. Nenhuma chamada real à OpenAI foi feita.

A nova suíte verifica configuração WSS/origens, Marin, assinatura e adulteração de ticket, replay, tenant, plano Pro, reserva concorrente, unidade de crédito diferente de um microdólar e encerramento seguido de outra chamada. A conexão exercitada usa WebSocket local com provedor simulado; isso não comprova TLS, proxy ou áudio real no Railway.

Os 53 testes existentes do frontend passaram (8 arquivos). Os builds completos passaram: `npm run build --workspace=barbearia-frontend` e `npm run build --workspace=barbearia-backend`. O frontend executou lint de cores, TypeScript e Vite. Há avisos já existentes de tamanho de chunks e dependências, sem falha de build.

Na prévia isolada, com API e microfone simulados, foram conferidos 375×812, 768×1024 e 1920×1080. Sem overflow horizontal do modal. Foram exercitados X, Escape, foco inicial e retorno, clique da dica abrindo o chat, dispensa da dica, recarga e navegação sem repetir anúncio, outro usuário e ausência de anúncio sem disponibilidade. A prévia não valida permissões reais de microfone nem uma sessão autenticada no ambiente publicado.

## Configuração e pendências externas

Nada foi publicado. Nenhuma credencial nova, limite financeiro, schema ou migration foi criado ou aplicado por esta entrega. Não houve escrita no banco de produção. As flags de exemplo continuam desligadas.

Antes de ativar, é necessário revisar a migration já existente `20260927_base_ia`, verificar sua situação no ambiente alvo e preparar aplicação autorizada com backup. O novo transporte não altera o schema. A existência das tabelas, restrições e triggers em produção não foi confirmada. A cobertura dessas tabelas na réplica, exportação, restauração e retenção também precisa de validação operacional.

O backend precisa dos parâmetros de consumo e resultado cifrado descritos em `.env.example`: modelos, créditos de cada plano, unidade de crédito, tarifas e versões, `IA_CONTAGEM_TEXTO=RESPOSTA_CONCLUIDA`, chave de resultados e retenção. Definir explicitamente a oferta comercial; a entrega não escolhe orçamento nem preço de venda. A regra atual atende ciclos mensais confirmados. Planos anuais, testes e cobranças pendentes não foram liberados por inferência.

Para voz, configurar `IA_ENABLED`, `IA_PERSISTENCIA_ENABLED` e `IA_VOZ_ENABLED`, `OPENAI_VOICE_MODEL=gpt-realtime-mini-2025-12-15`, `IA_VOZ_CREDITOS=TODOS_CUSTOS`, `IA_VOZ_PUBLIC_URL=wss://<domínio-do-backend>/ia/voz/conexao`, `IA_VOZ_ORIGENS` com origens HTTPS exatas do frontend e `IA_VOZ_TICKET_SECRET` próprio com pelo menos 32 caracteres, igual entre réplicas. Segredos não recebem prefixo VITE e não entram no repositório. O modelo e a tarifa conservadora continuam os já usados no teste, sem atualização silenciosa.

O frontend precisa apontar para o backend correto. O anúncio só é compilado como ativo com `VITE_VALERIA_LANCAMENTO_ENABLED=true`; mudar essa variável requer novo build. Habilitar o anúncio após validar o acesso real. Os arquivos de exemplo não ativam nada sozinhos.

O Railway documenta suporte a upgrade WebSocket via HTTP/1.1 em sua [rede pública](https://docs.railway.com/networking/public-networking/specs-and-limits). O transporte segue eventos de sessão e resposta da [API Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations). Ainda falta teste autorizado no ambiente alvo com WSS real, sessão autenticada, microfone, resposta audível, encerramento e reabertura, incluindo navegador móvel e reinício do serviço. Esse teste tem consumo e não foi executado aqui.

Uso incerto preserva a reserva; não há conciliação automática com a fatura do provedor nem estorno presumido. Uma queda do processo pode exigir conferência operacional. Não existe retomada da mesma chamada após reinício. O transporte permanece sem interrupção verbal de uma resposta em reprodução. São limitações reais da versão, não condições já resolvidas pela validação local.

Os documentos anteriores `BASE_ASSISTENTE_IA.md` e `PROPOSTA_PERSISTENCIA_IA.md` registram etapas anteriores. Para o transporte público e o anúncio, esta descrição prevalece sobre trechos históricos que dizem que ainda não há integração de voz.
