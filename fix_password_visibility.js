const fs = require('fs');

const filesToProcess = [
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
];

for (const file of filesToProcess) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Split the content by `<input`
    const parts = content.split('<input');
    for (let i = 1; i < parts.length; i++) {
        const closeIdx = parts[i].indexOf('/>');
        if (closeIdx !== -1) {
            let inputContent = parts[i].substring(0, closeIdx);
            
            if (inputContent.includes('type="password"')) {
                // Determine state name
                let stateName = "mostrarSenha";
                if (inputContent.includes('regSenha')) stateName = "mostrarRegSenha";
                else if (inputContent.includes('novaSenha')) stateName = "mostrarNovaSenha";
                else if (inputContent.includes('confirmarSenha')) stateName = "mostrarConfirmarSenha";

                // Replace type
                inputContent = inputContent.replace('type="password"', `type={${stateName} ? "text" : "password"}`);
                
                // Add padding
                if (inputContent.includes('paddingLeft') && !inputContent.includes('paddingRight')) {
                    inputContent = inputContent.replace(/(paddingLeft:\s*'[^\']+?')/, "$1, paddingRight: '36px'");
                } else if (inputContent.includes('padding:') && !inputContent.includes('paddingRight')) {
                    inputContent = inputContent.replace(/(padding:\s*'[^\']+?')/, "$1, paddingRight: '36px'");
                }

                // Add button after `/>`
                const buttonHtml = `/>
                    <button
                      type="button"
                      onClick={() => set${stateName[0].toUpperCase() + stateName.slice(1)}(!${stateName})}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 0 }}
                    >
                      {${stateName} ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                    </button>`;
                
                parts[i] = inputContent + buttonHtml + parts[i].substring(closeIdx + 2);
            }
        }
    }

    fs.writeFileSync(file, parts.join('<input'), 'utf8');
    console.log(`Fixed ${file}`);
}
