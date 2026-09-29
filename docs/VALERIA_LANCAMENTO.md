# Valéria: integração e condições para lançamento

Verificação local e consulta somente leitura ao Railway em 29/09/2026. Base desta entrega: `da541cc`, na branch `codex/base-agente-ia`. A base já contém 24 commits posteriores a `origin/main` (`3b57fd9`). Integrar somente os commits novos não leva toda a Valéria para a main. Implementação em `207adeb` e `2047cf9`.

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

Consulta atual confirmou: as quatro tabelas e triggers de IA não existem no Postgres de produção. O banco também não tem `public._prisma_migrations`. O diff contra o schema atual contém somente a estrutura preparada para IA (quatro tabelas, três enums, índices e vínculos, inclusive índice composto em assinaturas); não revelou drift alheio à entrega. A consulta de catálogo usou `default_transaction_read_only=on` e `BEGIN READ ONLY`. A identidade do banco do backend coincide com a do serviço Postgres. O SQL não foi aplicado.

Não executar `prisma migrate deploy` indiscriminadamente sobre esse banco sem histórico. Para publicar, preparar snapshot consistente e aplicar apenas o SQL revisado de `20260927_base_ia` por operação explicitamente autorizada, incluindo os CHECKs e triggers que o diff Prisma não reproduz. Fazer a mesma atualização estrutural na réplica Supabase antes do próximo backup. A cópia diária compara os schemas e será bloqueada se apenas o principal receber as tabelas. As novas tabelas da réplica precisam manter RLS e ausência de acesso de `anon`/`authenticated`, conforme o procedimento já registrado em `docs/operacoes/backup-supabase-2026-09-26.md`. Esta entrega não alterou schema nem executou migrations.

A consulta à réplica usando a conexão de backup com TLS validado também passou em `BEGIN READ ONLY`: nenhuma tabela `ia_%`, 24 regras de privilégios padrão presentes e `BACKUP_ENABLED=true` no serviço. Não foi feita cópia ou restauração. O acesso externo está disponível; o impedimento é autorização para alterar esses ambientes, não falta de credenciais de banco.

Railway acessível pela CLI já instalada, projeto `artistic-happiness`, ambiente `production`. Frontend e backend estão publicados em `3b57fd9`, ambos SUCCESS. O backend não tem nenhuma variável `IA_*`, modelos OpenAI, chave OpenAI, chave de cifra nem segredo de ticket. A flag do anúncio também está ausente no frontend. Isso foi verificado por lista permitida de configurações e presença booleana de segredos, sem expor seus valores.

Os limites já registrados no código são 100 mensagens no Básico, 200 no Pro e 1.800 segundos de voz Pro, compartilhados por barbearia e renovados no ciclo mensal confirmado. Não precisam ser rediscutidos para manter a implementação. As aprovações de centavos no histórico desta conversa são ampliações do teste fictício local, não orçamento recorrente de produção. A documentação de persistência deixa explicitamente sem valor a conversão e quantidade comercial de créditos. A leitura do outro chat pelo aplicativo falhou; não se presume aprovação que não foi recuperada.

Proposta concreta ainda não aplicada: um crédito = um microdólar; 2.000.000 créditos no Básico (teto calculado de US$ 2 por ciclo), 6.000.000 no Pro (US$ 6 compartilhados entre texto e voz); uma mensagem por resposta concluída, incluindo consultas internas; voz debita segundos e custo, sem debitar mensagem; retenção cifrada de 24 horas. São tetos propostos, não preço de venda nem estimativa da fatura. Nas tarifas de texto já usadas pelo teste (entrada 400.000 e saída 1.600.000 microUSD/milhão), o envelope de 40.000/1.024 tokens é 17.639 microUSD por pedido, totalizando até US$ 1,7639 para 100 pedidos ou US$ 3,5278 para 200. A voz tem limite próprio de US$ 0,09 por chamada. O teto financeiro pode encerrar acesso antes dos 30 minutos; não prometer franquia incondicional. Alternativa: o responsável informar outros dois tetos por plano e outro prazo de retenção. Nenhum desses valores foi ativado.

A regra atual atende ciclos mensais confirmados. Anuais, teste grátis, tolerância e mudança de plano ficam bloqueados conforme a política existente. Expandir essa elegibilidade não é necessário para um lançamento restrito ao público já suportado; é outra decisão de produto.

Para voz, configurar `IA_ENABLED`, `IA_PERSISTENCIA_ENABLED` e `IA_VOZ_ENABLED`, `OPENAI_VOICE_MODEL=gpt-realtime-mini-2025-12-15`, `IA_VOZ_CREDITOS=TODOS_CUSTOS`, `IA_VOZ_PUBLIC_URL=wss://<domínio-do-backend>/ia/voz/conexao`, `IA_VOZ_ORIGENS` com origens HTTPS exatas do frontend e `IA_VOZ_TICKET_SECRET` próprio com pelo menos 32 caracteres, igual entre réplicas. Segredos não recebem prefixo VITE e não entram no repositório. O modelo e a tarifa conservadora continuam os já usados no teste, sem atualização silenciosa.

O frontend já aponta para `barbearia-backend-production-f72d.up.railway.app`. A URL de voz a configurar é `wss://barbearia-backend-production-f72d.up.railway.app/ia/voz/conexao`; a origem principal é `https://valenbarber.com.br`. Acrescentar `https://barbearia-frontend-production-bb18.up.railway.app` apenas se o domínio alternativo também for usado. O `FRONTEND_URL=*` existente não serve como origem de voz, que exige lista explícita. O anúncio só é compilado como ativo com `VITE_VALERIA_LANCAMENTO_ENABLED=true`; mudar essa variável requer novo build. Habilitar o anúncio após validar o acesso real. Os arquivos de exemplo não ativam nada sozinhos.

O Railway documenta suporte a upgrade WebSocket via HTTP/1.1 em sua [rede pública](https://docs.railway.com/networking/public-networking/specs-and-limits). O transporte segue eventos de sessão e resposta da [API Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations). Ainda falta teste autorizado no ambiente alvo com WSS real, sessão autenticada, microfone, resposta audível, encerramento e reabertura, incluindo navegador móvel e reinício do serviço. Esse teste tem consumo e não foi executado aqui.

Uso incerto preserva a reserva; não há conciliação automática com a fatura do provedor nem estorno presumido. Uma queda do processo pode exigir conferência operacional. Não existe retomada da mesma chamada após reinício. O transporte permanece sem interrupção verbal de uma resposta em reprodução. São limitações reais da versão, não condições já resolvidas pela validação local.

Os documentos anteriores `BASE_ASSISTENTE_IA.md` e `PROPOSTA_PERSISTENCIA_IA.md` registram etapas anteriores. Para o transporte público e o anúncio, esta descrição prevalece sobre trechos históricos que dizem que ainda não há integração de voz.

## O que impede a publicação agora

Há duas decisões necessárias: aprovar os dois tetos financeiros e a retenção (proposta acima ou valores substitutos) e autorizar a operação externa completa, com snapshot, SQL existente no principal/réplica, configuração dos serviços, publicação conjunta e um teste real com teto de consumo explícito (proposta: US$ 0,10). Essa operação está expressamente fora da autorização atual, que proíbe escrita em produção, migration, push/deploy e chamada paga. A chave OpenAI deverá ser configurada no Railway por canal seguro; não enviá-la no chat. Os segredos internos poderão ser gerados nesse mesmo fluxo autorizado.

A sequência preparada é: snapshot e conferência; SQL existente e proteções nos dois bancos; variáveis com as regras aprovadas; publicação do conjunto completo da branch (não só os três commits finais); conferência de saúde e disponibilidade; chamada real controlada e reabertura; build do frontend com anúncio habilitado. Em caso de falha, desabilitar as flags e manter ledger/schema, sem apagar dados de consumo. Um único push não torna os dois deployments atômicos, por isso o anúncio exige disponibilidade confirmada.

Não são bloqueios adicionais de autorização: a voz Marin, os limites 100/200/1.800, o desenho do modal, o domínio WSS, o código de reabertura e os testes locais já foram resolvidos. Interrupção verbal, retomada após reinício e conciliação automática de uso incerto permanecem limitações documentadas, não foram apresentadas como funcionalidades prontas.

Para repetir a inspeção sem expor segredos: executar `node backend/scripts/verificar_valeria.cjs` dentro de `railway run` no serviço backend; usar `--banco` dentro de `railway run` no serviço Postgres. O script não carrega `.env`, não altera dados e só consulta catálogo.
