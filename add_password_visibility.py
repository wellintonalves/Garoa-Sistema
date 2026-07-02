import os
import re

files_to_process = [
    "frontend/src/pages/Login.tsx",
    "frontend/src/pages/cliente/ClienteLoginPrincipal.tsx",
    "frontend/src/pages/cliente/ClienteLogin.tsx",
    "frontend/src/pages/cliente/ClienteCadastro.tsx",
    "frontend/src/pages/cliente/ClienteRegister.tsx",
    "frontend/src/pages/admin/AdminLogin.tsx",
    "frontend/src/pages/admin/AdminPrimeiroAcesso.tsx",
    "frontend/src/pages/barbeiro/BarbeiroLoginPage.tsx",
    "frontend/src/pages/barbeiro/BarbeiroLogin.tsx",
    "frontend/src/pages/RecuperarSenha.tsx"
]

def process_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add Eye, EyeOff to lucide-react imports if not there
    lucide_import_pattern = r'import\s+\{([^}]+)\}\s+from\s+[\'"]lucide-react[\'"]'
    match = re.search(lucide_import_pattern, content)
    if match:
        imports = match.group(1)
        if 'Eye' not in imports:
            new_imports = imports.strip()
            if new_imports.endswith(','):
                new_imports += ' Eye, EyeOff'
            else:
                new_imports += ', Eye, EyeOff'
            content = content.replace(match.group(0), f'import {{ {new_imports} }} from \'lucide-react\'')
    
    # 2. Handle state additions
    # Find all type="password" inputs
    # If the file has 'senha', add mostrarSenha
    if 'setSenha(' in content and 'mostrarSenha' not in content:
        content = re.sub(r'(const \[senha, setSenha\] = useState\([^\)]+\);)', r'\1\n  const [mostrarSenha, setMostrarSenha] = useState(false);', content)
    
    if 'setRegSenha(' in content and 'mostrarRegSenha' not in content:
        content = re.sub(r'(const \[regSenha, setRegSenha\] = useState\([^\)]+\);)', r'\1\n  const [mostrarRegSenha, setMostrarRegSenha] = useState(false);', content)
    
    if 'setNovaSenha(' in content and 'mostrarNovaSenha' not in content:
        content = re.sub(r'(const \[novaSenha, setNovaSenha\] = useState\([^\)]+\);)', r'\1\n  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);', content)
    
    if 'setConfirmarSenha(' in content and 'mostrarConfirmarSenha' not in content:
        content = re.sub(r'(const \[confirmarSenha, setConfirmarSenha\] = useState\([^\)]+\);)', r'\1\n  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);', content)

    lines = content.split('\n')
    new_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        if '<input' in line and 'type="password"' in line:
            state_name = "mostrarSenha"
            if 'regSenha' in line:
                state_name = "mostrarRegSenha"
            elif 'novaSenha' in line:
                state_name = "mostrarNovaSenha"
            elif 'confirmarSenha' in line:
                state_name = "mostrarConfirmarSenha"
            
            line = line.replace('type="password"', f'type={{{state_name} ? "text" : "password"}}')
            
            if 'style={{' in line:
                if 'paddingLeft' in line and 'paddingRight' not in line:
                    line = re.sub(r'(paddingLeft:\s*\'[^\']+\')', r'\1, paddingRight: \'36px\'', line)
                elif 'padding:' in line and 'paddingRight' not in line:
                    # simplistic append
                    pass
            
            new_lines.append(line)
            
            while '/>' not in line:
                i += 1
                line = lines[i]
                if 'style={{' in line:
                    if 'paddingLeft' in line and 'paddingRight' not in line:
                        line = re.sub(r'(paddingLeft:\s*\'[^\']+\')', r'\1, paddingRight: \'36px\'', line)
                new_lines.append(line)
            
            button_code = f"""                    <button
                      type="button"
                      onClick={{() => set{state_name[0].upper() + state_name[1:]}(!{state_name})}}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 0 }}
                    >
                      {{{state_name} ? <EyeOff size={{14}} /> : <Eye size={{14}} />}}
                    </button>"""
            new_lines.append(button_code)
        else:
            new_lines.append(line)
        
        i += 1
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    print(f"Processed {filepath}")

for file in files_to_process:
    process_file(file)
