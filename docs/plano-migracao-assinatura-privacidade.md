# Plano de migração — assinatura e privacidade

Não execute estas mudanças diretamente em produção. O schema Prisma é a fonte completa desta rodada.

Mudanças pendentes:

- enums e tabelas `assinaturas_saas`, `mudancas_assinatura` e `solicitacoes_cancelamento_assinatura`;
- colunas `ativo` e `arquivadoEm` em `clientes_barbearias`;
- tabela `preferencias_promocionais` com unicidade por cliente e chave de origem;
- tabela `exclusoes_dados_auditaveis` para retenção legal, prazo de backup e proteção de restauração.

Sequência segura:

1. Gerar o diff SQL a partir do schema atual contra um banco de desenvolvimento equivalente.
2. Revisar criação de enums, FKs, índices e defaults; confirmar que `clientes_barbearias.ativo` recebe `true` para vínculos existentes.
3. Aplicar somente no banco de desenvolvimento e executar a suíte completa.
4. Fazer backup verificável antes da janela de produção.
5. Aplicar a migração e validar contagens por barbearia, sem registrar senhas, tokens ou dados pessoais nos logs.
6. Manter Asaas e exclusão física desativados até as dependências da matriz estarem resolvidas.

O cadastro de novos clientes finais passa a exigir nascimento, mas clientes já existentes com `dataNascimento = NULL` continuam entrando e podem preencher o campo no perfil. Não há backfill inventado nem bloqueio de login legado.
