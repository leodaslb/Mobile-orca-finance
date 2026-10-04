export type UnlockMethod = 'biometric' | 'pin';

export interface LocalSecuritySettings {
  biometricEnabled: boolean;
  pinConfigured: boolean;
  preferredMethod: UnlockMethod;
}

// Somente demonstração em memória. Não substitui SecureStore nem APIs biométricas do Android.
let pinDigest: string | null = null;
let biometricEnabled = false;
let preferredMethod: UnlockMethod = 'pin';

function digestPin(pin: string) {
  // Não criptográfico; impede texto puro no mock, mas não serve para persistência segura.
  let result = 2166136261;
  for (let index = 0; index < pin.length; index += 1) {
    result = Math.imul(result ^ pin.charCodeAt(index), 16777619);
  }
  return (result >>> 0).toString(16);
}

export function getLocalSecuritySettings(): LocalSecuritySettings {
  return { biometricEnabled, pinConfigured: pinDigest !== null, preferredMethod };
}

export function configureLocalPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('O PIN deve conter 4 números.');
  pinDigest = digestPin(pin);
  if (!biometricEnabled) preferredMethod = 'pin';
  return getLocalSecuritySettings();
}

export function checkLocalPin(pin: string) {
  return pinDigest !== null && digestPin(pin) === pinDigest;
}

export function setLocalBiometricEnabled(enabled: boolean) {
  biometricEnabled = enabled;
  preferredMethod = enabled ? 'biometric' : 'pin';
  return getLocalSecuritySettings();
}

export function setPreferredUnlockMethod(method: UnlockMethod) {
  if (method === 'pin' && pinDigest === null) throw new Error('Configure um PIN primeiro.');
  if (method === 'biometric' && !biometricEnabled) throw new Error('Ative a biometria primeiro.');
  preferredMethod = method;
  return getLocalSecuritySettings();
}

export function hasLocalLock() {
  return pinDigest !== null || biometricEnabled;
}

export function clearLocalLock() {
  pinDigest = null;
  biometricEnabled = false;
  preferredMethod = 'pin';
  return getLocalSecuritySettings();
}
