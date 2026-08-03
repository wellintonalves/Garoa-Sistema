@echo off
echo ==============================================
echo Limpando terminais antigos...
echo ==============================================
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM tsx.exe >nul 2>&1

echo.
echo ==============================================
echo Iniciando o BACKEND...
echo ==============================================
start "Backend - Valen Barber" cmd /k "npm run dev --workspace=barbearia-backend"

echo.
echo ==============================================
echo Iniciando o FRONTEND...
echo ==============================================
start "Frontend - Valen Barber" cmd /k "npm run dev --workspace=barbearia-frontend -- --host 0.0.0.0"

echo.
echo ==============================================
echo TUDO PRONTO!
echo.
echo 1. O painel do backend vai abrir em uma janela preta.
echo 2. O painel do frontend vai abrir em outra janela preta.
echo.
echo Agora, acesse no navegador do seu CELULAR o link abaixo:
echo http://192.168.15.6:5173
echo ==============================================
pause
