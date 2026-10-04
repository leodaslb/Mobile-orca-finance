import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export type UnlockMethod = 'biometric' | 'pin';
export interface LocalSecuritySettings { biometricEnabled: boolean; pinConfigured: boolean; preferredMethod: UnlockMethod }
interface StoredSecurity { salt: string | null; pinDigest: string | null; biometricEnabled: boolean; preferredMethod: UnlockMethod }
const key = 'orca-finance.local-security.v1';
const empty = (): StoredSecurity => ({ salt: null, pinDigest: null, biometricEnabled: false, preferredMethod: 'pin' });
let state = empty();
let ready = false;

export function getLocalSecuritySettings(): LocalSecuritySettings {
  return { biometricEnabled: state.biometricEnabled, pinConfigured: state.pinDigest !== null, preferredMethod: state.preferredMethod };
}
export async function initializeLocalSecurity() {
  if (ready) return getLocalSecuritySettings();
  if (Platform.OS === 'web') { ready = true; return getLocalSecuritySettings(); }
  const stored = await SecureStore.getItemAsync(key);
  if (stored) {
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object') throw new Error('Não foi possível ler a proteção local.');
    const candidate = value as Partial<StoredSecurity>;
    if (typeof candidate.biometricEnabled !== 'boolean' || !['pin','biometric'].includes(candidate.preferredMethod ?? '') ||
      !(candidate.pinDigest === null || (typeof candidate.pinDigest === 'string' && /^[a-f0-9]{64}$/.test(candidate.pinDigest))) ||
      !(candidate.salt === null || (typeof candidate.salt === 'string' && /^[a-f0-9]{32}$/.test(candidate.salt))) ||
      (!!candidate.pinDigest !== !!candidate.salt)) throw new Error('Configuração de proteção local inválida.');
    state = candidate as StoredSecurity;
  }
  ready = true;
  return getLocalSecuritySettings();
}
async function persist(next: StoredSecurity) {
  if (Platform.OS !== 'android') throw new Error('A proteção local está disponível no Android.');
  await SecureStore.setItemAsync(key, JSON.stringify(next));
  state = next;
  return getLocalSecuritySettings();
}
async function digest(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}
export async function configureLocalPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('O PIN deve conter 4 números.');
  await initializeLocalSecurity();
  const salt = Array.from(Crypto.getRandomBytes(16), byte => byte.toString(16).padStart(2, '0')).join('');
  return persist({ ...state, salt, pinDigest: await digest(pin, salt), preferredMethod: state.biometricEnabled ? state.preferredMethod : 'pin' });
}
export async function checkLocalPin(pin: string) {
  return !!state.pinDigest && !!state.salt && /^\d{4}$/.test(pin) && await digest(pin, state.salt) === state.pinDigest;
}
export async function getBiometricAvailability() {
  if (Platform.OS !== 'android') return { available: false, message: 'Biometria disponível no Android.' };
  if (!await LocalAuthentication.hasHardwareAsync()) return { available: false, message: 'Este dispositivo não possui sensor biométrico disponível.' };
  if (!await LocalAuthentication.isEnrolledAsync()) return { available: false, message: 'Cadastre uma biometria nas configurações do Android.' };
  return { available: true, message: 'Biometria do Android disponível.' };
}
export async function authenticateLocalBiometric() {
  const availability = await getBiometricAvailability();
  if (!availability.available) throw new Error(availability.message);
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear Orca Finance', cancelLabel: 'Cancelar', disableDeviceFallback: true });
  if (!result.success) throw new Error(result.error === 'user_cancel' || result.error === 'app_cancel' || result.error === 'system_cancel'
    ? 'Autenticação cancelada. Use a biometria ou seu PIN.' : 'Não foi possível autenticar. Tente novamente ou use seu PIN.');
  return true;
}
export async function setLocalBiometricEnabled(enabled: boolean) {
  await initializeLocalSecurity();
  if (enabled) await authenticateLocalBiometric();
  return persist({ ...state, biometricEnabled: enabled, preferredMethod: enabled ? 'biometric' : 'pin' });
}
export async function setPreferredUnlockMethod(method: UnlockMethod) {
  if (method === 'pin' && !state.pinDigest) throw new Error('Configure um PIN primeiro.');
  if (method === 'biometric' && !state.biometricEnabled) throw new Error('Ative a biometria primeiro.');
  return persist({ ...state, preferredMethod: method });
}
export function hasLocalLock() { return state.pinDigest !== null || state.biometricEnabled; }
export async function clearLocalLock() {
  await SecureStore.deleteItemAsync(key);
  state = empty();
  return getLocalSecuritySettings();
}
