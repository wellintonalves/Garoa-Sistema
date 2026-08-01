export function limparSessao() {
  const chaves = [
    '@garoa:cliente_token',
    '@garoa:barbeiro_token',
    '@garoa:cliente_dados',
    '@garoa:barbeiro_dados',
    '@garoa:usuario',
    '@garoa:token'
  ];

  chaves.forEach(chave => localStorage.removeItem(chave));

  // Remove dinâmicos do cliente multi-tenant
  const keys = Object.keys(localStorage);
  keys.forEach(k => {
    if (k.startsWith('@Garoa:client_token_') || k.startsWith('@Garoa:client_user_')) {
      localStorage.removeItem(k);
    }
  });
}
