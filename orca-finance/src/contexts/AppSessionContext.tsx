import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { leaveLocalAccount, selectLocalProfile, signInLocal, signUpLocal, type LocalAccount } from '@/services/auth.service';
import {
  checkLocalPin, clearLocalLock, configureLocalPin, getLocalSecuritySettings,
  hasLocalLock, setLocalBiometricEnabled, setPreferredUnlockMethod,
  type LocalSecuritySettings, type UnlockMethod,
} from '@/services/security.service';

interface AppSessionValue {
  account: LocalAccount | null;
  activeProfileId: string | null;
  locked: boolean;
  security: LocalSecuritySettings;
  signIn: (email: string, password: string) => void;
  signUp: (name: string, email: string, password: string) => void;
  signOut: () => void;
  setActiveProfile: (profileId: string) => void;
  setPin: (pin: string) => void;
  setBiometric: (enabled: boolean) => void;
  setPreferredMethod: (method: UnlockMethod) => void;
  disableLock: () => void;
  unlockWithPin: (pin: string) => boolean;
  unlockBiometricDemo: () => void;
  lockNow: () => void;
}

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [security, setSecurity] = useState(getLocalSecuritySettings);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && account && hasLocalLock()) setLocked(true);
    });
    return () => subscription.remove();
  }, [account]);

  const value = useMemo<AppSessionValue>(() => ({
    account, activeProfileId, locked, security,
    signIn(email, password) {
      const session = signInLocal(email, password);
      setAccount(session.account);
      setActiveProfileId(session.activeProfileId);
      setLocked(false);
    },
    signUp(name, email, password) {
      const session = signUpLocal(name, email, password);
      setAccount(session.account);
      setActiveProfileId(session.activeProfileId);
      setLocked(false);
    },
    signOut() {
      leaveLocalAccount();
      setAccount(null);
      setActiveProfileId(null);
      setLocked(false);
    },
    setActiveProfile(profileId) {
      if (!account) throw new Error('Entre na conta primeiro.');
      selectLocalProfile(account, profileId);
      setActiveProfileId(profileId);
    },
    setPin(pin) { setSecurity(configureLocalPin(pin)); },
    setBiometric(enabled) { setSecurity(setLocalBiometricEnabled(enabled)); },
    setPreferredMethod(method) { setSecurity(setPreferredUnlockMethod(method)); },
    disableLock() { setSecurity(clearLocalLock()); setLocked(false); },
    unlockWithPin(pin) {
      const valid = checkLocalPin(pin);
      if (valid) setLocked(false);
      return valid;
    },
    unlockBiometricDemo() {
      if (security.biometricEnabled) setLocked(false);
    },
    lockNow() { if (hasLocalLock()) setLocked(true); },
  }), [account, activeProfileId, locked, security]);

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) throw new Error('AppSessionProvider ausente.');
  return context;
}
