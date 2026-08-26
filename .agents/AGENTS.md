Em QUALQUER alteração de UI/estilo do Valen Barber, siga rigorosamente o `design.md` na raiz do projeto: cores e tokens SEMPRE via variáveis de tema (`--cor-primaria`, `--fundo-pagina`, `--texto-principal`, `--fundo-card`), NUNCA hardcode, além dos padrões de botões, cards, inputs, números, tabelas, badges, navegação e agenda. Não introduza cores, fontes ou estilos fora do `design.md`.

Tipografia e ícones, conforme o `design.md`:

- Texto geral: `Inter Tight`
- Números, dinheiro e horários: `JetBrains Mono`, sempre com `font-variant-numeric: tabular-nums`
- Tamanho mínimo de fonte: 13px (`0.8125rem`) em qualquer elemento
- Ícones: conjunto único **Lucide React**, variante outline, `strokeWidth={1.75}`

## 16. Mensagens de erro e tratamento de exceções visuais

O usuário final é o cliente da barbearia, o barbeiro e o dono. Nenhuma mensagem visível pode conter status code, nome de exceção, stack trace, nome de campo técnico, nome de tabela ou jargão. Detalhe técnico vai exclusivamente para o `console.error` do servidor.

Textos a usar:

- Sessão expirada: "Sua sessão expirou. Entre novamente para continuar."
- Falha de rede: "Não foi possível conectar. Verifique sua internet e tente de novo."
- Erro na agenda: "Não conseguimos carregar sua agenda agora. Tente novamente em instantes."
- Erro em lista genérica: "Não conseguimos carregar essas informações. Tente novamente em instantes."

Toda tela de erro sem saída precisa de botão de ação (Tentar novamente ou Entrar novamente), nunca só texto.
