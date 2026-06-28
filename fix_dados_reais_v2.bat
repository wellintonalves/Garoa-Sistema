@echo off
cd /d C:\Users\welli\Garoa_Sistema
git add frontend/src/layouts/ClienteLayout.tsx
git add frontend/src/pages/cliente/barbearia/ClienteBarbeariaInicio.tsx
git add frontend/src/pages/cliente/barbearia/ClienteBarbeariaPerfil.tsx
git add backend/src/services/clienteApp.service.ts
git commit -m "fix(cliente): corrigir visitas, investido, badge VIP e data de cadastro da barbearia

- minhasBarbearias: inclui createdAt da barbearia no retorno
- ClienteLayout: exibe 'Desde {ano}' real do createdAt da barbearia na sidebar
- ClienteBarbeariaInicio: visitas contam so CONCLUIDO (nao cancelados),
  mobile letterhead exibe ano real de cadastro da barbearia, contador de
  sessao usa atendimentos + 1
- ClienteBarbeariaPerfil: stats (visitas, faltas, investido) calculados
  dos agendamentos da barbearia atual (nao globais), badge VIP dinamico
  baseado em visitas reais (0-4: sem badge, 5-9: Frequente, 10+: VIP),
  'Membro desde' usa data real de registro do usuario"
git push origin main
echo.
echo Deploy iniciado!
pause
