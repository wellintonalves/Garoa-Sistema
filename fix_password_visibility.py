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

    # Find all type="password"
    # We will use regex to find `<input ... type="password" ... />`
    
    # regex to match the input block: <input ... />
    input_pattern = re.compile(r'(<input[^>]*?type="password"[^>]*?/>)', re.DOTALL)
    
    def replacer(match):
        input_html = match.group(1)
        # Determine state
        state_name = "mostrarSenha"
        if 'regSenha' in input_html:
            state_name = "mostrarRegSenha"
        elif 'novaSenha' in input_html:
            state_name = "mostrarNovaSenha"
        elif 'confirmarSenha' in input_html:
            state_name = "mostrarConfirmarSenha"
            
        # Replace type
        input_html = input_html.replace('type="password"', f'type={{{state_name} ? "text" : "password"}}')
        
        # Add padding right
        if 'style={{' in input_html:
            if 'paddingLeft' in input_html and 'paddingRight' not in input_html:
                input_html = re.sub(r'(paddingLeft:\s*\'[^\']+?\')', r"\1, paddingRight: '36px'", input_html)
            elif 'padding:' in input_html and 'paddingRight' not in input_html:
                input_html = re.sub(r'(padding:\s*\'[^\']+?\')', r"\1, paddingRight: '36px'", input_html)
        else:
            # Maybe it uses className? We'll just leave padding to className if no inline style
            # In tailwind, it would be pr-9, but we can just inject inline style
            input_html = input_html.replace('/>', ' style={{ paddingRight: "36px" }} />')

        button_html = f"""
                    <button
                      type="button"
                      onClick={{() => set{state_name[0].upper() + state_name[1:]}(!{state_name})}}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 0 }}
                    >
                      {{{state_name} ? <EyeOff size={{14}} strokeWidth={{1.5}} /> : <Eye size={{14}} strokeWidth={{1.5}} />}}
                    </button>"""
                    
        return input_html + button_html

    new_content = input_pattern.sub(replacer, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Fixed {filepath}")

for file in files_to_process:
    process_file(file)
