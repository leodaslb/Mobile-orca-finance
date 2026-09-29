export function jwtConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret?.trim()) {
    throw new Error('JWT_SECRET deve ser configurado para iniciar a aplicação.');
  }

  const value = process.env.JWT_EXPIRES_IN;
  const expiresIn = Number(value);
  if (!value || !Number.isInteger(expiresIn) || expiresIn <= 0) {
    throw new Error('JWT_EXPIRES_IN deve ser um número positivo de segundos.');
  }

  return {
    secret,
    signOptions: { expiresIn, algorithm: 'HS256' as const },
    verifyOptions: { algorithms: ['HS256' as const] },
  };
}
