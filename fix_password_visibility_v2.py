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
        print(f"Not found: {filepath}")
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split the file into parts: before input, input, after input
    # Since there are multiple inputs, we iterate over them.
    
    parts = []
    
    # We find all occurrences of `<input` and `/>`
    idx = 0
    while True:
        start_idx = content.find('<input', idx)
        if start_idx == -1:
            parts.append(content[idx:])
            break
            
        end_idx = content.find('/>', start_idx)
        if end_idx == -1:
            # Malformed or different tag closing, just break
            parts.append(content[idx:])
            break
            
        end_idx += 2 # include '/>'
        
        parts.append(content[idx:start_idx])
        
        input_html = content[start_idx:end_idx]
        
        if 'type="password"' in input_html:
            state_name = "mostrarSenha"
            if 'regSenha' in input_html:
                state_name = "mostrarRegSenha"
            elif 'novaSenha' in input_html:
                state_name = "mostrarNovaSenha"
            elif 'confirmarSenha' in input_html:
                state_name = "mostrarConfirmarSenha"
                
            input_html = input_html.replace('type="password"', f'type={{{state_name} ? "text" : "password"}}')
            
            if 'paddingLeft' in input_html and 'paddingRight' not in input_html:
                input_html = re.sub(r'(paddingLeft:\s*\'[^\']+?\')', r"\1, paddingRight: '36px'", input_html)
            elif 'padding:' in input_html and 'paddingRight' not in input_html:
                input_html = re.sub(r'(padding:\s*\'[^\']+?\')', r"\1, paddingRight: '36px'", input_html)
            elif 'style={{' in input_html and 'paddingRight' not in input_html:
                # Add paddingRight if it doesn't exist
                input_html = input_html.replace('style={{', 'style={{ paddingRight: "36px", ')
            else:
                input_html = input_html.replace('/>', ' style={{ paddingRight: "36px" }} />')
                
            button_html = f"""
                    <button
                      type="button"
                      onClick={{() => set{state_name[0].upper() + state_name[1:]}(!{state_name})}}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 0 }}
                    >
                      {{{state_name} ? <EyeOff size={{14}} strokeWidth={{1.5}} /> : <Eye size={{14}} strokeWidth={{1.5}} />}}
                    </button>"""
            
            parts.append(input_html + button_html)
        else:
            parts.append(input_html)
            
        idx = end_idx

    new_content = ''.join(parts)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Fixed {filepath}")

for file in files_to_process:
    process_file(file)
