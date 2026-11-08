import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ApiError, getApiSession, normalizeServerURL, setApiServerURL } from './api-client';

const key = 'orca.server-url.v1';
export async function initializeServerSettings() {
  try {
    const stored = Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    setApiServerURL(stored);
  } catch { throw new ApiError(0, 'Não foi possível carregar o endereço do servidor. Tente novamente.'); }
}
export async function saveServerSettings(value: string | null) {
  if (getApiSession().token) throw new ApiError(400, 'Saia da conta antes de alterar o servidor.');
  const next = value === null ? null : normalizeServerURL(value);
  try {
    if (Platform.OS === 'web') {
      if (next === null) globalThis.localStorage.removeItem(key); else globalThis.localStorage.setItem(key, next);
    } else if (next === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, next);
  } catch { throw new ApiError(0, 'Não foi possível salvar o endereço neste aparelho. Tente novamente.'); }
  setApiServerURL(next);
}
export async function testServerConnection(value: string) {
  const url = normalizeServerURL(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url}/health`, { signal: controller.signal, credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok || (await response.json()).status !== 'ok') throw new Error();
    return url;
  } catch { throw new ApiError(0, 'Servidor indisponível. Confira o endereço, a rede e se o backend está ligado.'); }
  finally { clearTimeout(timeout); }
}
