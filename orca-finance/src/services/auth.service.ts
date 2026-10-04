import { apiRequest, ApiError } from '@/services/api-client';

export interface Account { id: string; name: string; email: string; profileIds: string[] }
export interface ApiProfile { id: string; nome: string; moedaBase: string }
export interface AuthSession { account: Account; profiles: ApiProfile[]; accessToken: string; activeProfileId: string | null }

export async function signIn(email: string, password: string): Promise<AuthSession> {
  let accessToken: string;
  try {
    ({ accessToken } = await apiRequest<{ accessToken: string }>('/auth/login', {
      method: 'POST', authenticated: false, body: { email: normalizeEmail(email), senha: password },
    }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw new ApiError(401, 'E-mail ou senha inválidos.');
    throw error;
  }
  const [user, profiles] = await Promise.all([
    apiRequest<{ id: string; nome: string; email: string }>('/me', { token: accessToken }),
    apiRequest<ApiProfile[]>('/profiles', { token: accessToken }),
  ]);
  return { accessToken, profiles, activeProfileId: profiles.length === 1 ? profiles[0].id : null,
    account: { id: user.id, name: user.nome, email: user.email, profileIds: profiles.map(p => p.id) } };
}

export async function signUp(name: string, email: string, password: string): Promise<AuthSession> {
  try {
    await apiRequest('/auth/register', { method: 'POST', authenticated: false,
      body: { nome: name.trim(), email: normalizeEmail(email), senha: password } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) throw new ApiError(409, 'Este e-mail já está cadastrado.');
    throw error;
  }
  // Cadastro cria a conta e o primeiro perfil, mas o contrato não retorna token.
  try { return await signIn(email, password); }
  catch (error) { throw new ApiError(error instanceof ApiError ? error.status : 0,
    'Conta criada. Não foi possível abrir a sessão. Use Entrar com seu e-mail e senha.'); }
}

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
