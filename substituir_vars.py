import os

files = [
    "frontend/src/index.css",
    "frontend/src/layouts/BarbeiroLayout.tsx",
    "frontend/src/layouts/ClienteLayout.tsx",
    "frontend/src/layouts/DashboardLayout.tsx",
    "frontend/src/pages/Clientes.tsx",
    "frontend/src/pages/Login.tsx",
    "frontend/src/pages/cliente/ClienteHome.tsx",
    "frontend/src/pages/cliente/barbearia/ClienteBarbeariaAgendar.tsx",
    "frontend/src/pages/publico/Agendar.tsx",
    "frontend/src/pages/publico/Fidelidade.tsx"
]

replacements = {
    "--bg-primary": "--fundo-pagina",
    "--background": "--fundo-pagina",
    "--surface": "--fundo-card",
    "--card-bg": "--fundo-card"
}

for filepath in files:
    if not os.path.exists(filepath):
        print(f"{filepath}: 0 trocas (Arquivo não encontrado)")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    total_trocas = 0
    new_content = content
    for old_str, new_str in replacements.items():
        count = new_content.count(old_str)
        if count > 0:
            new_content = new_content.replace(old_str, new_str)
            total_trocas += count
            
    if total_trocas > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
    print(f"{filepath}: {total_trocas} trocas")
