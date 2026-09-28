import { profilesMock } from '@/data/mocks/profile.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import type { FinancialProfile } from '@/types';

export interface LocalAccount {
  id: string;
  name: string;
  email: string;
  profileIds: string[];
}

// Demonstração em memória: não representa autenticação remota nem guarda credenciais entre aberturas.
const accounts: { account: LocalAccount; passwordDigest: string }[] = [{
  account: {
    id: 'account-demo',
    name: 'Usuário',
    email: 'demo@orca.finance',
    profileIds: ['profile-001'],
  },
  passwordDigest: digest('demo1234'),
}];
let nextAccountNumber = 1;

function digest(value: string): string {
  // Comparador de demonstração, NÃO é hash criptográfico para produção.
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return (result >>> 0).toString(16);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function activate(account: LocalAccount) {
  const profileId = account.profileIds[0];
  if (!profileId) throw new Error('Conta sem perfil financeiro.');
  mockScenario.activeProfileId = profileId;
  return { account, activeProfileId: profileId };
}

export function signUpLocal(name: string, email: string, password: string) {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const cleanEmail = normalizeEmail(email);
  if (!cleanName || !cleanEmail || !password) {
    throw new Error('Preencha nome, e-mail e senha.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Informe um e-mail válido.');
  }
  if (accounts.some((entry) => entry.account.email === cleanEmail)) {
    throw new Error('Este e-mail já está cadastrado.');
  }
  const number = String(nextAccountNumber++).padStart(3, '0');
  const profileId = `profile-account-${number}`;
  const account: LocalAccount = {
    id: `account-${number}`,
    name: cleanName,
    email: cleanEmail,
    profileIds: [profileId],
  };
  const profile: FinancialProfile = {
    id: profileId,
    name: cleanName,
    initials: cleanName.split(' ').slice(0, 2).map((part) => part[0].toUpperCase()).join(''),
    currencyCode: 'BRL',
    initialBalanceCents: 0,
  };
  accounts.push({ account, passwordDigest: digest(password) });
  profilesMock.push(profile);
  return activate(account);
}

export function signInLocal(email: string, password: string) {
  const entry = accounts.find((item) => item.account.email === normalizeEmail(email));
  if (!entry || entry.passwordDigest !== digest(password)) {
    throw new Error('E-mail ou senha inválidos.');
  }
  return activate(entry.account);
}

export function selectLocalProfile(account: LocalAccount, profileId: string) {
  if (!account.profileIds.includes(profileId)) {
    throw new Error('Perfil não pertence a esta conta.');
  }
  mockScenario.activeProfileId = profileId;
}

export function leaveLocalAccount() {
  mockScenario.activeProfileId = 'profile-001';
}
