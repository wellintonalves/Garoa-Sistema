// Configuração de autenticação — secrets separados por papel (sem fallback)
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 24) {
    throw new Error(`Variável de ambiente ${name} ausente ou muito curta. Configure um segredo aleatório forte de pelo menos 24 caracteres.`);
  }
  return v;
}

export const authConfig = {
  secret: required('JWT_SECRET'),
  secretCliente: required('JWT_SECRET_CLIENTE'),
  secretBarbeiro: required('JWT_SECRET_BARBEIRO'),
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  saltRounds: 10,
};
