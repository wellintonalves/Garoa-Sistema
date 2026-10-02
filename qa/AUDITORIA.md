# Valen Barber — revisão da área do barbeiro

Projeto confirmado pelo usuário: `C:\dev\valen-barber`. Desenvolvimento e testes isolados em `valen-current`. Sem push, merge, deploy, migração, credenciais copiadas ou escrita em banco de produção.

## Auditoria antes da implementação

Foram lidos os componentes de Hoje, Agenda, Comissões, Perfil, Horários, Login, layout, aprovações, autenticação, fechamento, clientes HTTP e contratos backend relacionados. As cinco telas principais foram abertas com fixtures locais. Capturas da versão original estão em `evidence/current-before`.

| Área | Problema constatado | Tratamento |
| --- | --- | --- |
| Hoje | KPIs grandes precediam a rotina; ocupação calculada sobre 480 minutos fixos; comissão estimada com percentual ausente no contexto; atalhos desabilitados; gráfico semanal sem boa leitura | Próximo/atual primeiro no celular, agenda cronológica, resumo compacto de três informações; comissão registrada fornecida pela API; semana em Comissões; retirada de atalhos sem função |
| Agenda | Grade 08–20h com slots de meia hora ocultava horários como 07:15, 10:15 e 21:45; bloqueios repetidos; filtro de data por prefixo ignorava fuso/intervalos que atravessam dias | Lista cronológica com início/fim/duração, status e valores; bloqueios consolidados por interseção de datas; busca/filtros; intervalos sem eventos explicitados |
| Bloqueios | `alert`/`confirm`, pouca validação e ausência de proteção contra envio repetido | Formulário contextual, erros junto aos campos, validação temporal, bloqueio durante gravação, cancelamento e confirmação digitada ao excluir |
| Fechamento | Modal compartilhado usava cliente HTTP administrativo para saldo/simulação; erro de conclusão podia fechar o modal; risco de simulação antiga ao mudar valores | Checkout exclusivo da área com token do barbeiro, preview do servidor, cancelamento de requisições antigas, confirmação só com preview atual, erro preservando formulário, trava de reenvio |
| Comissões | Erros ocultos, intervalo inválido aceito, cartões decorativos e tabela pouco adaptada ao celular | Erro/retry, validação antes da requisição, resumo monetário consistente e histórico responsivo |
| Perfil | Erro podia virar carregamento permanente; rascunho cancelado persistia; campos e horários inconsistentes | Estados explícitos, edição em diálogo com reinicialização, feedback, atualização do nome da sessão, upload validado, horários com labels e validação |
| Navegação/login | Sem marca no shell, botões sem semântica de links/estado atual, raiz do barbeiro vazia, login decorativo | Marca existente/tokens Valen, NavLink, conteúdo principal acessível, ErrorBoundary, raiz direcionada a Hoje; login simples mantendo seleção entre barbearias |
| Aprovações | Interrupção modal obrigatória, erros pouco úteis e recarga desconectada das métricas | Aviso revisável, detalhes em diálogo, retry, confirmação de exclusão e atualização dos dados após decisão |

Nenhuma função real de criar/editar agendamento foi removida: esses recursos não existiam nesta área. Ações existentes de concluir atendimento, bloquear/remover bloqueio, aprovar/rejeitar, alterar disponibilidade/perfil/foto/horários, filtrar comissões, consultar semana e sair foram preservadas. Não foi inventada uma disponibilidade comercial: “Sem eventos” indica somente lacuna entre registros, sem afirmar que a loja aceita reservas naquele intervalo.

## Pesquisa pública anterior às mudanças

Foram consultadas páginas oficiais de produto e ajuda, com foco no comportamento descrito, não apenas em imagens. Não houve acesso a contas privadas ou validação de demos autenticadas. A página Commander da Squire é histórica e não representa garantia da interface atual.

- [Fresha — calendário e display](https://www.fresha.com/help-center/knowledge-base/calendar/16-manage-your-calendar-display-settings-): densidade e configuração das informações no calendário.
- [Fresha — visualizações](https://www.fresha.com/help-center/knowledge-base/calendar/290-customize-your-calendar-view-1): diferentes necessidades de leitura do calendário.
- [Fresha — status](https://www.fresha.com/help-center/knowledge-base/calendar/600-update-appointment-statuses): estado do atendimento separado das informações de cobrança; revisão contextual.
- [Booksy — calendar/scheduling](https://biz.booksy.com/features/calendar-scheduling): calendário como ponto central do trabalho e acesso rápido às ações.
- [Squire — command your schedule](https://getsquire.com/how-it-works/command-your-schedule): organização da agenda no contexto da barbearia.
- [Squire — Commander, referência histórica](https://resources.getsquire.com/new-commander/): agenda e operação financeira articuladas, sem reproduzir a marca.
- [Vagaro — status e cores](https://support.vagaro.com/hc/en-us/articles/28544779074971-Service-Appointment-Statuses-Colors): cor complementa status textual; evitar depender só de cor.
- [Square — filtros da agenda](https://squareup.com/help/us/en/article/8442-set-up-calendar-view-filters-for-appointments): filtros explícitos e controle da densidade.

Princípios aplicados: ação atual/próxima em destaque; informação diária compacta; detalhes financeiros secundários; status legíveis; filtros explícitos; feedback de gravação; estados vazios úteis; componentes consistentes. Nenhuma interface foi copiada.

## Sistema visual e arquitetura

- Tokens existentes Ivory/Clay/Slate, sem novas cores hexadecimais nos componentes. Inter Tight na interface, Newsreader nos títulos, JetBrains Mono em horas e valores.
- Escala mínima de 13px, corpo legível, campos de 16px no mobile, alvos principais de 48px, espaçamento regular, sombras discretas e bordas leves.
- Componentes `PageHeader`, `Notice`, `Loading`, `Empty`, `Dialog`, `Status`, `AppointmentRow` e `BarberCheckout`; reutilização de `Botao`, `Skeleton` e seletor de tema existentes.
- CSS com prefixo `bb-`, shell desktop e navegação inferior mobile; tabela se reorganiza no celular, sem apenas reduzir fontes.
- Diálogos nativos com foco contido, Escape, retorno ao acionador, bloqueio durante envio e títulos acessíveis.
- Hook comum cancela leituras antigas e fornece carregamento/erro/retry; eventos locais sincronizam agenda/comissões/aprovações.
- Schema, rotas de negócio e cálculo financeiro preservados. O único ajuste backend adiciona PATCH à lista CORS existente, exigido pelo endpoint de disponibilidade do barbeiro e verificado em preflight real. O editor de horários também é reutilizado pelo administrador: manteve assinatura/`onSalvar`, recebeu as mesmas validações/labels para evitar duplicação. Essa é a única repercussão visual fora da área; CORS é configuração compartilhada necessária a uma ação já existente.

## Revisão final por perspectiva

- **Barbeiro iniciante:** Hoje mostra a próxima ação; horários, cliente, serviço, status e conclusão têm leitura direta. Pendências encerradas não são falsamente chamadas de atendimento em andamento.
- **Designer:** hierarquia reduz cartões concorrentes; tipografia/tokens reaproveitados; navegação persistente e telas pequenas reorganizadas; status não depende só de cor.
- **Desenvolvedor:** contratos existentes mantidos; chamadas corretas com token do barbeiro; cancelamento de leituras, trava de envio e erro persistente; nenhuma migração/dependência de produto adicionada.
- **Dono:** comissões são dados registrados da API, sem ocupação fictícia nem atalhos prometendo funções inexistentes; limites da validação estão explicitados abaixo.

## Limites da entrega

A suíte de UI exercita o frontend compilado com APIs interceptadas. Além dela, 12 cenários foram executados com Express real e um PostgreSQL 18.6 novo em loopback: login e recusas de autenticação, isolamento entre profissionais/unidades, CRUD de agendamento auxiliar, preflight PATCH, persistência de perfil/horários/disponibilidade/bloqueios, checkout com pontos e comissão, prevenção de conclusão repetida, aprovação/rejeição e tratamento de falha do armazenamento de fotos. Somente fixtures fictícias foram gravadas nesse cluster. A interface foi ajustada ao limite real de 2 MB para fotos.

Falta validar um upload bem-sucedido no Supabase com bucket de teste autorizado. Não foram usados bucket, credenciais ou dados produtivos. WebKit automatizado é cobertura adicional, não iPhone físico. Railway/deploy não foram executados. Ver TESTES.md para matriz e evidências. Build mantém avisos existentes de tamanho de chunks e Lottie fora desta área.
