@echo off
cd /d "%~dp0"
set LOG=%~dp0git_commit_chat_log.txt

echo === INICIANDO: %date% %time% === > "%LOG%"

echo === PASSO 1: git add === >> "%LOG%"
git add backend/prisma/schema.prisma backend/src/services/chat.service.ts backend/src/controllers/chat.controller.ts backend/src/routes/chat.routes.ts backend/src/routes/clienteApp.routes.ts backend/src/routes/index.ts frontend/src/App.tsx frontend/src/components/Sidebar.tsx frontend/src/pages/admin/AdminChat.tsx "frontend/src/pages/cliente/barbearia/ClienteBarbeariaChat.tsx" "frontend/src/pages/cliente/barbearia/ClienteBarbeariaInicio.tsx" >> "%LOG%" 2>&1
echo Saida git add: %errorlevel% >> "%LOG%"

echo. >> "%LOG%"
echo === PASSO 2: git commit === >> "%LOG%"
git commit -F "%~dp0git_msg.txt" >> "%LOG%" 2>&1
echo Saida git commit: %errorlevel% >> "%LOG%"

echo. >> "%LOG%"
echo === PASSO 3: git push origin main === >> "%LOG%"
git push origin main >> "%LOG%" 2>&1
echo Saida git push: %errorlevel% >> "%LOG%"

echo. >> "%LOG%"
echo === CONCLUIDO: %date% %time% === >> "%LOG%"

echo Resultado:
type "%LOG%"
pause
