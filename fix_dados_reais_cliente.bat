@echo off
cd /d C:\Users\welli\Garoa_Sistema
git add frontend/src/layouts/ClienteLayout.tsx
git add frontend/src/pages/cliente/barbearia/ClienteBarbeariaInicio.tsx
git add frontend/src/pages/cliente/barbearia/ClienteBarbeariaPerfil.tsx
git add backend/src/services/clienteApp.service.ts
git commit -m "fix(cliente): substituir dados ilustrativos por dados reais da API

- ClienteBarbeariaInicio: fidelidade via /fidelidade API, endereco do
  barbearia.endereco, 'Desde' calculado do primeiro agendamento, sem
  distancia hardcoded, sem 'Estabelecida em 2024', fallback preco '--'
- ClienteLayout: adiciona endereco a BarbeariaInfo, nome dinamico na sidebar
- ClienteBarbeariaPerfil: remove stats mock injetados no frontend, usa
  dados reais retornados pelo backend
- clienteApp.service: perfil agora retorna stats reais (atendimentos,
  faltas, gastoTotal computados dos agendamentos) e dataRegistro do
  usuario.createdAt"
git push origin main
echo.
echo Deploy iniciado com sucesso!
pause
