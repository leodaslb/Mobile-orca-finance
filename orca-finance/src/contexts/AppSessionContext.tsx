import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { signIn, signUp, type Account, type ApiProfile, type AuthSession } from '@/services/auth.service';
import { getApiSession, handleUnauthorized, setApiSession, SessionChangedError } from '@/services/api-client';
import {
  checkLocalPin, clearLocalLock, configureLocalPin, getLocalSecuritySettings,
  hasLocalLock, setLocalBiometricEnabled, setPreferredUnlockMethod,
  initializeLocalSecurity, authenticateLocalBiometric,
  type LocalSecuritySettings, type UnlockMethod,
} from '@/services/security.service';

interface AppSessionValue {
  account: Account | null;
  profiles: ApiProfile[];
  activeProfileId: string | null;
  locked: boolean;
  security: LocalSecuritySettings;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  setActiveProfile: (profileId: string) => void;
  setPin: (pin: string) => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
  setPreferredMethod: (method: UnlockMethod) => Promise<void>;
  disableLock: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<void>;
  securityReady: boolean;
  securityError: string;
  retryLocalSecurity: () => void;
  lockNow: () => void;
}

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [profiles, setProfiles] = useState<ApiProfile[]>([]);
  const authenticationVersion = useRef(0);
  const authenticationBusy = useRef(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [security, setSecurity] = useState(getLocalSecuritySettings);
  const [securityReady, setSecurityReady] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securityAttempt, setSecurityAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setSecurityError('');
    initializeLocalSecurity().then(settings => { if (mounted) { setSecurity(settings); setSecurityReady(true); } })
      .catch(() => { if (mounted) setSecurityError('Não foi possível carregar a proteção local. Tente novamente.'); });
    return () => { mounted = false; };
  }, [securityAttempt]);

  function clearSession() {
    authenticationVersion.current += 1;
    setApiSession(null, null);
    setAccount(null); setProfiles([]); setActiveProfileId(null); setLocked(false);
  }
  useEffect(() => { handleUnauthorized(clearSession); return () => { handleUnauthorized(); }; }, []);

  async function authenticate(operation: () => Promise<AuthSession>) {
    if (authenticationBusy.current) return;
    authenticationBusy.current = true;
    const version = authenticationVersion.current;
    try {
      const result = await operation();
      if (version !== authenticationVersion.current) throw new SessionChangedError();
      setApiSession(result.accessToken, result.activeProfileId);
      setAccount(result.account); setProfiles(result.profiles); setActiveProfileId(result.activeProfileId); setLocked(false);
    } finally { authenticationBusy.current = false; }
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && account && hasLocalLock()) setLocked(true);
    });
    return () => subscription.remove();
  }, [account]);

  const value = useMemo<AppSessionValue>(() => ({
    account, profiles, activeProfileId, locked, security, securityReady, securityError,
    retryLocalSecurity() { setSecurityAttempt(value => value + 1); },
    signIn(email, password) { return authenticate(() => signIn(email, password)); },
    signUp(name, email, password) { return authenticate(() => signUp(name, email, password)); },
    signOut: clearSession,
    setActiveProfile(profileId) {
      if (!account) throw new Error('Entre na conta primeiro.');
      if (!profiles.some(profile => profile.id === profileId)) throw new Error('Perfil não pertence à conta.');
      // Alterar a revisão invalida respostas HTTP do perfil anterior.
      setApiSession(getApiSession().token, profileId);
      setActiveProfileId(profileId);
    },
    async setPin(pin) { setSecurity(await configureLocalPin(pin)); },
    async setBiometric(enabled) { setSecurity(await setLocalBiometricEnabled(enabled)); },
    async setPreferredMethod(method) { setSecurity(await setPreferredUnlockMethod(method)); },
    async disableLock() { setSecurity(await clearLocalLock()); setLocked(false); },
    async unlockWithPin(pin) {
      const revision = getApiSession().revision;
      const valid = await checkLocalPin(pin);
      if (revision !== getApiSession().revision) throw new SessionChangedError();
      if (valid) setLocked(false);
      return valid;
    },
    async unlockWithBiometric() {
      if (!security.biometricEnabled) throw new Error('Ative a biometria primeiro.');
      const revision = getApiSession().revision;
      await authenticateLocalBiometric();
      if (revision !== getApiSession().revision) throw new SessionChangedError();
      setLocked(false);
    },
    lockNow() { if (hasLocalLock()) setLocked(true); },
  }), [account, profiles, activeProfileId, locked, security, securityReady, securityError]);

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) throw new Error('AppSessionProvider ausente.');
  return context;
}
