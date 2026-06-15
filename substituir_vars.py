import os
import glob

files = glob.glob('frontend/src/**/*.tsx', recursive=True) + \
        glob.glob('frontend/src/**/*.ts', recursive=True) + \
        glob.glob('frontend/src/**/*.css', recursive=True)

replacements = {
    "--font-display": "--fonte-interface",
    "--font-body": "--fonte-interface",
    "--fonte-titulo": "--fonte-interface",
    "--fonte-corpo": "--fonte-interface",
    "--font-mono": "--fonte-numeros",
    "'Syne'": "var(--fonte-interface)",
    "'DM Mono'": "var(--fonte-numeros)"
}

for filepath in files:
    if not os.path.isfile(filepath):
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
