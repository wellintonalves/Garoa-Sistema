@echo off
cd /d "C:\Users\welli\Garoa_Sistema"
git add backend/src/services/estoque.service.ts frontend/src/pages/Estoque.tsx
git commit -m "fix: remover include estoque de resumoVendas e sempre recarregar historico apos venda"
git push origin main
echo DONE
