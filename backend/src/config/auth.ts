// Configuração de autenticação
export const authConfig = {
  secret: process.env.JWT_SECRET || 'fallback-secret-troque-em-producao',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  saltRounds: 10,
};
