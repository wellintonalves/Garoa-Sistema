@echo off
cd /d "C:\Users\welli\Garoa_Sistema"
git add frontend/src/index.css
git commit -m "fix: contraste insuficiente no modo claro — amber, success e error ajustados para WCAG AA"
git push origin main
echo DONE
