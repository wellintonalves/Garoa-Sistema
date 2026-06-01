// Configuração de autenticação — secrets separados por papel
export const authConfig = {
  secret: process.env.JWT_SECRET || 'fallback-secret-troque-em-producao',
  secretCliente: process.env.JWT_SECRET_CLIENTE || 'fallback-cliente-secret',
  secretBarbeiro: process.env.JWT_SECRET_BARBEIRO || 'fallback-barbeiro-secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  saltRounds: 10,
};
