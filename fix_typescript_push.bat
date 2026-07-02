@echo off
echo === Fix TypeScript Build Errors ===
echo.

:: Remove git lock if exists
if exist "C:\Users\welli\Garoa_Sistema\.git\index.lock" (
    echo Removendo git lock...
    del /F "C:\Users\welli\Garoa_Sistema\.git\index.lock"
)

cd /d C:\Users\welli\Garoa_Sistema

echo Adicionando arquivos...
git add backend/tsconfig.json backend/src/services/financeiro.service.ts

echo Fazendo commit...
git commit -m "fix: corrigir erros TypeScript no build do backend (noImplicitAny + financeiro.service)"

echo Fazendo push...
git push origin main

echo.
echo === CONCLUIDO ===
pause
