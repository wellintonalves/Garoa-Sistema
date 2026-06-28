@echo off
del "C:\Users\welli\Garoa_Sistema\.git\index.lock" 2>nul
cd /d "C:\Users\welli\Garoa_Sistema"
git add backend/src/services/estoque.service.ts
git add backend/src/controllers/estoque.controller.ts
git add backend/src/routes/estoque.routes.ts
git add frontend/src/pages/Estoque.tsx
git commit -m "feat: carrinho de vendas com multiplos produtos"
git push origin main
echo DONE
