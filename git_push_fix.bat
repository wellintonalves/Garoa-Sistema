@echo off
cd /d "C:\Users\welli\Garoa_Sistema"

echo Removendo lock files...
for %%f in (.git\index.lock .git\HEAD.lock) do (
    if exist "%%f" del /f /q "%%f"
)

echo.
echo Aceitando versao remota de railway.toml (resolucao de conflito)...
git checkout --theirs backend/railway.toml

echo.
echo Marcando conflito como resolvido...
git add backend/railway.toml

echo.
echo Completando o merge commit...
git commit --no-edit

echo.
echo git push origin main...
git push origin main

echo.
echo === git log final ===
git log --oneline -5

echo.
echo === CONCLUIDO ===
pause
