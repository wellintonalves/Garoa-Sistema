@echo off
cd /d "C:\Users\welli\Garoa_Sistema"
git add backend/src/services/barbeiro.service.ts
git commit -m "fix: usar barbeariaId escalar no criar barbeiro (resolve conflito com middleware tenant)"
git push origin main
echo.
echo === CONCLUIDO ===
pause
