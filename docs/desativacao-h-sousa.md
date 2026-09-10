# Preparação da desativação da H Sousa antiga

Autorização do Wellinton: desativar apenas a barbearia antiga e seus acessos, preservando todos os dados e mantendo o cadastro com 154 lançamentos.

## Alvos confirmados pelas consultas executadas pelo usuário

- Antiga: `ebcb9e56-75be-4540-af5d-536059b873a7`. Dois usuários, um barbeiro, 21 serviços; zero lançamentos, clientes, agendamentos, movimentos de pontos e resgates nas consultas.
- Preservar: `757f0caa-33e6-4409-96cb-c8c6fce85358`. Quatro usuários, três barbeiros, 16 serviços, um cliente e 154 lançamentos no momento da consulta.
- Ambos os administradores usam o mesmo email. O usuário confirmou que houve novo cadastro por engano, em vez de login.

## Proteção implementada localmente

- Login administrativo ignora barbearias inativas e preserva contas globais sem unidade.
- Login de barbeiro exige barbeiro ativo e barbearia ativa.
- Middlewares administrativo e de barbeiro consultam o estado atual da unidade por requisição, sem cache. Tokens anteriores à desativação também são bloqueados.
- Token legado do barbeiro resolve a unidade pelo vínculo no banco; falha de consulta não libera acesso.
- Não altera schema, email, senha, financeiro nem serviços. A operação de dados necessária é apenas `Barbearia.ativo=false` para o alvo antigo.
- Reativação restaura acesso, inclusive de tokens ainda válidos; esta é suspensão reversível, não revogação permanente de credenciais.

## Evidência de teste

`npm run test:barbearia-inativa`, em postgres-dev, passou com serviços reais e HTTP nos middlewares: entrada antes da desativação, bloqueio de novos logins, bloqueio dos tokens administrativo/barbeiro/legado, login da outra unidade com mesmo email, dados preservados e reativação. Fixtures removidas e ausência conferida.

## Ordem obrigatória

1. Validar e publicar a proteção de acesso.
2. Confirmar implantação.
3. Reconsultar os dois alvos em produção e aplicar apenas a desativação do antigo.
4. Confirmar antigo inativo, atual ativo, contagens preservadas e acesso atual normal.

A desativação em produção AINDA NÃO foi executada.
