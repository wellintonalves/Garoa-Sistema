# Valen Barber — evidências de validação

## Resultado final

Código aplicado a `C:\dev\valen-barber`: 10 arquivos existentes alterados e 6 arquivos novos em `frontend/src/components/barbeiro`. Hashes antes/depois em `changes.json`. Os arquivos originais foram comparados antes da cópia, e os arquivos aplicados são idênticos aos testados. O arquivo local preexistente `backend/scripts/qa_descontos_preview.ts` foi preservado.

| Verificação | Resultado final | Evidência/limite |
| --- | --- | --- |
| Build frontend completo | Passou | `frontend-build.log`: lint de cores, TypeScript e Vite |
| Lint de cores | Passou | Zero cores fixas fora das exceções existentes |
| Build backend completo | Passou | `backend-build.log`: Prisma generate e TypeScript, sem migrações |
| Testes frontend | 58 passaram em 9 arquivos | `frontend-tests.log`, incluindo cinco casos novos de fuso, navegação de datas, duração/combos e estados |
| Fechamento | 10 passaram | `backend-fechamento.log`: cálculos existentes, descontos, fidelidade, preço alterado, comissão zero |
| Fidelidade | Passou | `backend-fidelidade.log`: motor real com persistência simulada; sem banco |
| Navegador Chromium | 16 cenários passaram | `evidence/browser-results.json`, Playwright com Edge/Chromium e bundle de produção local |
| Navegador WebKit 26.6 | 16 cenários passaram | evidence/webkit-results.json; motor automatizado, não iPhone físico |
| Console/runtime/API no frontend | Passou nos cenários exercitados | Sem pageerror; cenário explícito de console/HTTP sem falhas em navegação normal. Erros 500 e 409 foram induzidos e esperados nos testes correspondentes |
| Acessibilidade automática | Passou | Axe WCAG 2 A/AA e 2.1 AA nas cinco telas, claro em 390/1440px, escuro em desktop e modal em 375px |
| Integração HTTP com backend/banco local real | **12 cenários passaram** | Express + PostgreSQL 18.6 efêmero em loopback, evidence/integration-results.json |
| Storage Supabase | **Sucesso não executado** | Limite 2 MB e erro real tratados; falta bucket de teste autorizado |
| Safari/iOS físico, leitor de tela real | **Não executados** | Responsividade em viewport não equivale a certificação nesses dispositivos |
| Deploy/Railway | **Não executado** | Sem push, merge ou publicação |

## Matriz de navegador

1. Hoje, Agenda, Comissões, Perfil e Login em 360, 375, 390, 768, 1280, 1440 e 1920px; navegação e ausência de overflow horizontal.
2. Agenda com 07:15 e 21:45; busca, limpar busca, resultado vazio, filtro de concluídos, próximo dia e retorno a hoje.
3. Criar bloqueio fictício, intervalo inválido, erro de API preservando formulário, recuperação, cancelamento da exclusão e remoção com nome digitado.
4. Checkout com token do barbeiro, desconto em reais e pontos combinados, dinheiro, erro na gravação mantendo valores e nova tentativa sem conclusão duplicada.
5. Mudança para desconto percentual bloqueia confirmação até novo preview; cancelamento não conclui; foco retorna ao acionador.
6. Perfil: cancelamento descarta rascunho; salva nome/telefone; upload fictício; horários inválidos, copiar segunda-feira e salvar.
7. Comissões: intervalo inválido não consulta API; retorno ao mês; desempenho semanal secundário.
8. Aprovações: abrir/fechar preserva pendência; rejeitar atualiza estado.
9. Loading, erro com retry e vazio nas telas aplicáveis; skeleton com resposta atrasada.
10. Login: mostrar senha, erro de servidor, sucesso e email normalizado.
11. Axe em desktop/mobile, tema claro/escuro nas cinco telas.
12. Disponibilidade: aguarda persistência antes da mudança visual; aprovação de exclusão exige nome; logout remove sessão.
13. Conclusão futura exige confirmação explícita; modal em 375px, cancelamento e axe.
14. Console e respostas HTTP sem falhas na navegação normal.
15. Login com múltiplas barbearias preserva seleção e envia o vínculo escolhido.

Todos os registros são fictícios, como Rafael Almeida, Marcos Oliveira e Lucas Ferreira. Na matriz de UI as APIs são interceptadas; na matriz integrada somente APIs em loopback são permitidas. Não houve envio de mensagem, notificação a cliente ou transação produtiva. As fixtures usam um token sem assinatura exclusivamente para o frontend local; não é uma credencial nem comprovação de autorização no servidor.

## Reproduzir localmente

Na raiz da cópia isolada, instalar as ferramentas de QA em pasta separada:

```powershell
npm install --prefix .qa --no-save playwright@1.63.0 @axe-core/playwright@4.13.0
npm run build --workspace=barbearia-frontend
npm run build --workspace=barbearia-backend
npm test --workspace=barbearia-frontend
npm run test:fechamento --workspace=barbearia-backend
npm run test:fidelidade --workspace=barbearia-backend
npm run preview --workspace=barbearia-frontend -- --host 127.0.0.1 --port 5189
```

Em outro terminal, com Microsoft Edge instalado:

```powershell
node qa/browser-tests.cjs
node qa/capture.cjs after
```

Use build isolado sem `.env` real. O cliente HTTP precisa apontar para o fallback `http://localhost:3001`, interceptado pelas fixtures. O script aborta origens fora das portas locais permitidas; requisição de API não simulada resulta em 501 e falha de teste. Não trocar a interceptação por acesso a produção. A suíte de fixtures usa a data de Brasília atual e respostas controladas. A suíte integrada separada usa Express e PostgreSQL reais, descrita abaixo.

## Capturas e limitações

- `evidence/current-before/desktop-*.png` e `mobile-*.png`: versão original do projeto confirmado.
- `evidence/after/desktop-*.png` e `mobile-*.png`: versão final, mesmas fixtures, relógio fixado em 10:15 de Brasília para mostrar o próximo atendimento.
- `evidence/after/375-*.png`, `768-*.png`, `1920-*.png`: capturas da suíte nas larguras obrigatórias; relógio de execução, podendo mostrar pendências encerradas.
- `checkout.png`, `mobile-checkout.png`, `dark-profile.png`: fechamento e tema escuro.
- Na versão original, o botão de bloqueio mobile não tinha nome acessível; por isso não há comparação confiável desse modal mobile.

Falhas intermediárias de ambiente (indisponibilidade transitória do executor, preview iniciado antes de terminar o build) foram recuperadas. Falhas de localização de selects e espera de checkbox assíncrono foram tratadas; o JSON final contém apenas o resultado da execução completa mais recente. Build mantém avisos já existentes sobre Lottie e tamanho de chunks de outras áreas.

## Homologação integrada adicional

Criado cluster vazio exclusivamente para esta tarefa, usando os binários portáteis já existentes no projeto, em 127.0.0.1:55439, banco valen_barber_ui_test. Schema existente aplicado apenas nesse banco. Duas unidades, três barbeiros e quatro clientes fictícios. Nenhum banco anterior ou remoto foi utilizado. O bootstrap integration-server.cjs importa o app Express sem iniciar jobs/backup/sincronização e remove variáveis de credenciais externas.

**12 cenários passaram:** autenticação e senha/token inválidos; isolamento de agenda/fechamento/fidelidade entre profissionais e unidades; CORS PATCH; criação/edição/conflito/cancelamento de agendamento auxiliar; perfil e horários persistidos após recarga; disponibilidade; criação/remoção de bloqueio; simulação/checkout/comissão/recusa de repetição; rejeição e aprovação persistidas; foto maior que 2 MB e falha de storage; ausência de exceções não tratadas.

Caso financeiro conferido diretamente no banco: serviço R$ 80, desconto R$ 10 + 5 pontos, total R$ 65, comissão R$ 32,50 e um único lançamento após tentativa repetida. Apenas fixtures foram alteradas.

Scripts: integration-env.cjs (somente configuração fictícia local), integration-seed.cjs, integration-server.cjs e integration-tests.cjs. Para repetir, o cluster exclusivo deve estar ativo e o schema aplicado. Executar seed em banco vazio; BARBER_QA_RESET=1 reinicializa somente esse banco de fixtures com guarda de nomes. Depois iniciar servidor e executar testes. Nunca adaptar esses scripts para banco remoto.

Correções adicionais: CORS inclui PATCH, necessário à disponibilidade; limite de foto alinhado ao multer de 2 MB; botões acionadores recebem foco explícito na área do barbeiro, permitindo retorno consistente no WebKit. Dois seletores de teste foram corrigidos para esperar o conteúdo visível e a atualização assíncrona. O build backend foi repetido após parar o processo local que mantinha a DLL do Prisma aberta.

**Restante:** para comprovar upload persistido de fotos, disponibilizar bucket Supabase de teste e suas variáveis em ambiente protegido, sem enviar segredos pelo chat. Não há necessidade de fornecer banco remoto para os fluxos já homologados. Safari/iPhone físico e implantação Railway continuam não executados.

WebKit: `node qa/webkit-tests.cjs` reutiliza a mesma suíte. O harness fornece CORS explícito, inclusive durante logout; não suprime pageerror. Os 15 cenários passaram no motor WebKit após o ajuste de foco.

## Prontidão e integração para publicação

A main remota estava 32 commits à frente do checkout inicial. Release preparada em worktree separado a partir de f452100775d3b53ba197e3aa4aac7d7e3c0b368d, preservando esses commits, o componente Valéria e seu estado entre rotas. A margem inferior mobile foi ajustada ao acionador já existente. Não há alteração de schema, endpoint de upload, controller de foto, serviço Supabase ou regra financeira nesta release.

O teste upload-contract.cjs passou com HTTP, autenticação e PostgreSQL reais e adaptador local no limite do storage: campo multipart file, bytes/MIME, contrato do bucket barbeiros, resposta 200 e persistência da URL. Não é comprovação de escrita no Supabase remoto. A consulta remota opcional foi rejeitada pela revisão automática porque o bucket não era identificado como exclusivo de teste; não foi executada nem contornada. A cobertura local e o diff comprovam a compatibilidade da mudança com a função preexistente; não houve alteração da configuração remota.

Deploy: push normal para main do remote configurado, sem force; ambos os serviços Railway devem confirmar sucesso no SHA publicado. A CLI Railway não está autenticada; os checks Railway no GitHub permitem acompanhar os serviços artistic-happiness/barbearia-backend e barbearia-frontend. Fallback: reverter somente os commits desta tarefa sobre a main, preservando os commits anteriores e todos os dados. Não há rollback de banco necessário.

Release integrada: matriz final 16/16 Chromium e 16/16 WebKit, com Valéria e título Valen Barber; integração real 12/12 Chromium e 13/13 WebKit (inclui navegação rápida); contrato de foto local aprovado. O harness aguarda requisições simuladas entre recargas, exceto no teste explícito de skeleton; não ignora erros. Os testes reais de navegação rápida passaram sem essa espera extra.
