# Remove git lock if exists
$lockFile = "C:\Users\welli\Garoa_Sistema\.git\index.lock"
if (Test-Path $lockFile) {
    Write-Host "Removendo git lock..."
    Remove-Item -Force $lockFile
}

Set-Location "C:\Users\welli\Garoa_Sistema"

Write-Host "Adicionando arquivos..."
git add backend/tsconfig.json
git add backend/src/services/financeiro.service.ts
git add backend/prisma/schema.prisma
git add backend/src/services/agendamento.service.ts
git add frontend/src/pages/Agenda.tsx
git add frontend/src/pages/Financeiro.tsx
git add "frontend/src/pages/cliente/barbearia/ClienteBarbeariaAgendar.tsx"

Write-Host ""
Write-Host "Status:"
git status --short

Write-Host ""
Write-Host "Fazendo commit..."
git commit -m "feat: multi-servico + fix TypeScript + editar/excluir agendamentos e lancamentos

- fix: noImplicitAny false no tsconfig do backend
- fix: financeiro.service.ts tipos number|null
- feat: schema.prisma adiciona servicosIds String[] ao Agendamento
- feat: agendamento.service.ts suporta multiplos servicos
- feat: Agenda.tsx — botoes editar/excluir + multi-select servicos
- feat: ClienteBarbeariaAgendar.tsx — selecao multipla de servicos
- feat: Financeiro.tsx — botoes editar/excluir em cada lancamento"

Write-Host ""
Write-Host "Fazendo push..."
git push origin main

Write-Host ""
Write-Host "=== CONCLUIDO ==="
Read-Host "Pressione Enter para fechar"
