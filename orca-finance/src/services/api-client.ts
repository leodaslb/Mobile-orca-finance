export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export class SessionChangedError extends Error {
  constructor() { super('A sessão ou o perfil mudou. Atualize a tela.'); }
}

let session = { token: null as string | null, profileId: null as string | null, revision: 0 };
let onUnauthorized: (() => void) | undefined;
export function getApiSession() { return { ...session }; }
export function setApiSession(token: string | null, profileId: string | null) {
  session = { token, profileId, revision: session.revision + 1 };
}
export function handleUnauthorized(handler?: () => void) { onUnauthorized = handler; }
export function profilePath(resource: string, profileId = session.profileId) {
  if (!profileId || !session.token) throw new ApiError(401, 'Entre na conta e selecione um perfil financeiro.');
  if (profileId !== session.profileId) throw new SessionChangedError();
  return `/profiles/${encodeURIComponent(profileId)}/${resource}`;
}

const messages: Record<number, string> = {
  400: 'Confira os dados informados.', 401: 'Sessão inválida. Entre novamente.',
  403: 'Você não tem acesso a este perfil ou recurso.', 404: 'Registro não encontrado.',
  409: 'Já existe um registro com esses dados ou a operação está em conflito.',
  413: 'A imagem deve ter no máximo 5 MiB. Escolha uma imagem menor.',
  415: 'Escolha uma imagem JPEG ou PNG.',
  502: 'Não foi possível enviar o comprovante. Tente novamente.',
  503: 'O envio de comprovantes está indisponível no momento. Tente novamente mais tarde.',
};

export async function apiRequest<T>(path: string, options: {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown;
  authenticated?: boolean; token?: string; signal?: AbortSignal;
  responseType?: 'json' | 'file';
} = {}): Promise<T> {
  const baseURL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!baseURL || !/^https?:\/\//i.test(baseURL)) {
    throw new ApiError(0, 'O serviço não está configurado neste aplicativo. Entre em contato com o responsável.');
  }
  const captured = getApiSession();
  const authenticated = options.authenticated !== false;
  const token = options.token ?? captured.token;
  if (authenticated && !token) throw new ApiError(401, messages[401]);
  const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${baseURL}${path}`, {
      method: options.method ?? 'GET', signal: options.signal,
      headers: { Accept: options.responseType === 'file' ? '*/*' : 'application/json', ...(options.body !== undefined && !multipart && { 'Content-Type': 'application/json' }),
        ...(authenticated && token && { Authorization: `Bearer ${token}` }) },
      ...(options.body !== undefined && { body: multipart ? options.body as FormData : JSON.stringify(options.body) }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.');
  }
  if (captured.revision !== session.revision) throw new SessionChangedError();
  if (!response.ok) {
    // Nunca repassar strings livres do servidor (SQL, Prisma, stack traces).
    if (response.status === 401 && authenticated && !options.token) {
      setApiSession(null, null);
      onUnauthorized?.();
    }
    throw new ApiError(response.status, messages[response.status] ?? 'Não foi possível concluir a operação. Tente novamente.');
  }
  if (response.status === 204) return undefined as T;
  let result: T;
  try { result = (options.responseType === 'file'
    ? { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get('Content-Type') ?? '' }
    : await response.json()) as T; }
  catch { throw new ApiError(0, 'Não foi possível carregar os dados. Tente novamente.'); }
  if (captured.revision !== session.revision) throw new SessionChangedError();
  return result;
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof SessionChangedError
    ? error.message : 'Não foi possível concluir a operação. Tente novamente.';
}
