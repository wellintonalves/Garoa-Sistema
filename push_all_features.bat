@echo off
echo === Push: TypeScript Fix + Multi-Servico + Editar Lancamentos ===
echo.

:: Remove git lock if exists
if exist "C:\Users\welli\Garoa_Sistema\.git\index.lock" (
    echo Removendo git lock...
    del /F "C:\Users\welli\Garoa_Sistema\.git\index.lock"
)

cd /d C:\Users\welli\Garoa_Sistema

echo Adicionando arquivos...
git add backend/tsconfig.json
git add backend/src/services/financeiro.service.ts
git add backend/prisma/schema.prisma
git add backend/src/services/agendamento.service.ts
git add frontend/src/pages/Agenda.tsx
git add frontend/src/pages/cliente/barbearia/ClienteBarbeariaAgendar.tsx
git add frontend/src/pages/Financeiro.tsx
git add frontend/src/pages/Agenda.tsx

echo.
echo Status atual:
git status --short

echo.
echo Fazendo commit...
git commit -m "feat: multi-servico + fix TypeScript Railway

- fix: noImplicitAny false no tsconfig do backend (39 erros pre-existentes)
- fix: financeiro.service.ts tipos number|null (TS2322/TS18047)
- feat: schema.prisma adiciona servicosIds String[] ao Agendamento
- feat: agendamento.service.ts suporta multiplos servicos (duracao+valor totais)
- feat: Agenda.tsx (admin) — botoes editar/excluir + SeletorServicos multi-select
- feat: ClienteBarbeariaAgendar.tsx — selecao multipla de servicos p/ cliente
- feat: Financeiro.tsx — botoes editar/excluir em cada lancamento"

echo.
echo Fazendo push...
git push origin main

echo.
echo === CONCLUIDO ===
echo Railway vai redeploiar automaticamente.
echo O backend vai rodar 'prisma db push' para adicionar coluna servicosIds.
echo.
pause
