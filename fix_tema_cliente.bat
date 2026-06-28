@echo off
cd /d "C:\Users\welli\Garoa_Sistema"
git add frontend/src/index.css
git add frontend/src/hooks/useTema.ts
git add frontend/src/pages/cliente/ClienteHome.tsx
git add frontend/src/layouts/ClienteLayout.tsx
git commit -m "fix: tema padrao na tela principal do cliente, tema da barbearia apenas nas telas da barbearia"
git push origin main
echo DONE
