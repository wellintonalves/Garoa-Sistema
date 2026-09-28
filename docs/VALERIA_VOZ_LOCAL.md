# Teste local de voz da Valéria

Implementação de áudio nativo bidirecional pela OpenAI Realtime, com `gpt-realtime-mini-2025-12-15` e voz sintética `coral`, orientada a falar com animação, espontaneidade e pausas naturais. Não usa ditado, síntese do navegador, clonagem ou ElevenLabs. O microfone só é solicitado no clique do ícone de voz, sem câmera e sem confirmação intermediária. Esse clique abre a nuvem flutuante com o estado da conexão e o botão para encerrar. Fechar o painel ou encerrar a conversa interrompe a captura e pede o fechamento do provedor.

O transporte está restrito ao harness local, ao PostgreSQL `valen_ia_test` em loopback e à identidade fictícia configurada pelo servidor. Produção continua desabilitada: `server.ts` não instala esse transporte. A conta fictícia foi colocada no cenário Pro, mantendo os contadores de mensagens, crédito e consumo; o registro anterior está em um arquivo de auditoria ignorado pelo Git. Nenhum plano comercial, schema ou migration foi alterado.

## Limites e custo

Cada sessão reserva 90 segundos da franquia Pro compartilhada de 1.800 segundos e até US$ 0,09 do orçamento manual existente. A sessão termina em até 90 segundos, sem contagem fixa de respostas. Antes de cada geração, incluindo a resposta após uma ferramenta, o servidor verifica se o consumo confirmado mais o custo máximo da próxima geração cabe na reserva. Caso não caiba, encerra com uma mensagem de limite de custo. Essa política não aumenta o orçamento manual.

Os [preços oficiais](https://developers.openai.com/api/docs/pricing), consultados em 27/09/2026, são US$ 0,60/2,40 por milhão de tokens de texto de entrada/saída e US$ 10/20 por milhão de tokens de áudio. Cache é desconsiderado no cálculo conservador. O [guia de custo](https://developers.openai.com/api/docs/guides/voice-latency-cost?voice-api=realtime) descreve cobrança por resposta e limite de contexto pós-instruções.

O envelope por geração é `(14.000 + 2.000) × 0,60 + 1.500 × 10 + 256 × 20 = 29.720` microUSD. São no máximo 14.000 bytes UTF-8 de instruções, ferramentas e contexto inicial, mais margem de 2.000 tokens; todo contexto pós-instruções é orçado pela tarifa de áudio, assim como toda saída. O provedor precisa confirmar `max_output_tokens=256`, contexto de 1.500 tokens e VAD sem geração automática antes de receber áudio. O servidor é o único emissor de `response.create`, com uma geração de cada vez e conferência de uso antes da próxima.

O WebSocket passa pelo backend, que mantém a chave padrão. O navegador recebe somente um ticket aleatório de uso único, válido por 15 segundos e vinculado ao ator autenticado. A conexão exige a origem local esperada. O cliente só pode enviar PCM limitado e pedir encerramento, nunca instruções, configurações, ferramentas, uso ou saldo. O servidor verifica a autorização antes de cada resposta e as ferramentas repetem a validação de tenant/perfil.

O servidor fecha o socket do provedor no limite, na desconexão ou após 60 segundos sem atividade (aviso aos 45). Fala detectada pelo provedor, áudio sendo reproduzido e execução de consulta não contam como abandono; nada amplia o prazo reservado. Ping/pong detecta perda de conexão sem tratar heartbeat como atividade humana. Fechamento forçado, uso incompleto ou erro conservam a reserva. Só um fechamento confirmado com todos os eventos de uso permite devolver a diferença ao saldo. Reiniciar não apaga reservas ou autoriza repetir a sessão paga.

## Alcance desta primeira conversa

Reutiliza as consultas administrativas, taxas de comissão e ajuda do perfil, todas de leitura. Carrega o contexto de texto cifrado da mesma pessoa/conversa; o provedor mantém os turnos de voz durante a sessão. Não grava o áudio em arquivos e não transcreve a fala do usuário com um segundo modelo. As respostas faladas aparecem no painel com horário; esta etapa não persiste histórico de voz para sessões futuras.

As falas são alternadas: o microfone não é encaminhado enquanto a resposta toca, evitando eco. Interrupção verbal durante a fala da Valéria ainda não é suportada; o botão de encerrar funciona a qualquer momento. Resultados de ferramentas acima de 1.200 bytes são recusados com orientação para continuar por texto, em vez de apresentar dados parciais ou deixar o contexto descartar o resultado. Esta versão curta serve para testar compreensão, áudio, latência e consultas pequenas; não comprova uma conversa longa ou prontidão de produção.

## Verificação

`test:ia-voz` usa provedor simulado e PostgreSQL exclusivamente local. Verifica limite de gerações, custo, repetição de evento, uso inválido, inatividade, fala em andamento, encerramento, autorização revogada, consulta, resultado grande, configuração não confirmada, fluxo de ticket e reserva/liquidação/incerteza. Nenhuma chamada paga é feita pelo teste.

Os testes gerais de IA e persistência passaram; frontend e backend tiveram builds completos. A interface foi conferida em 375, 768 e 1920 pixels. O teste real de voz depende do clique do usuário e da permissão do microfone; ainda não foi executado pelo agente. A disponibilidade do modelo nesta chave, qualidade do áudio e latência só serão confirmadas nessa conversa manual.
