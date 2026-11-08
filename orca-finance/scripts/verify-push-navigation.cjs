const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const profileA = '11111111-1111-4111-8111-111111111111', profileB = '22222222-2222-4222-8222-222222222222';
const response = (id, profileId, type = 'TRANSACTION_REMINDER') => ({ notification: { request: { identifier: id, content: { data: { type, profileId, ...(type === 'WEEKLY_SUMMARY' ? { periodStart: '2026-10-05', periodEnd: '2026-10-11' } : {}) } } } } });
function harness({ clearFails = false } = {}) {
  const slots = [], navigation = [], alerts = []; let cursor = 0, dirty = false, effects = [], listener;
  const cold = deferred(); let verify = deferred(), checks = 0;
  const context = { account: null, activeProfileId: null, locked: false, profiles: [], refreshProfiles: async () => { checks++; await verify.promise; }, setActiveProfile: id => { context.activeProfileId = id; dirty = true; } };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const load = createLoader({
    react: {
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { const value = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } }]; },
      useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
      useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !same(previous.deps, deps)) effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
    },
    'react-native': { Platform: { OS: 'android' }, Alert: { alert: (...args) => alerts.push(args) } },
    'expo-constants': { __esModule: true, default: { executionEnvironment: 'bare' } }, 'expo-device': {}, 'expo-secure-store': {},
    'expo-router': { useRouter: () => router },
    '@/contexts/AppSessionContext': { useAppSession: () => ({ ...context }) },
    'expo-notifications': { setNotificationHandler: () => {}, addNotificationResponseReceivedListener: fn => { listener = fn; return { remove() { listener = undefined; } }; }, getLastNotificationResponseAsync: () => cold.promise, clearLastNotificationResponseAsync: async () => { if (clearFails) throw new Error('Falha técnica controlada'); } },
  });
  const router = { push: route => navigation.push(route) };
  const Component = load('src/components/domain/PushNavigation.tsx').PushNavigation;
  function render() { let turns = 0; do { assert.ok(turns++ < 20, 'efeito não deve entrar em loop'); dirty = false; cursor = 0; effects = []; Component(); const pending = effects; effects = []; pending.forEach(run => run()); } while (dirty); }
  return { context, navigation, alerts, cold, checks: () => checks, render, receive: r => listener(r), resolveProfiles(profiles) { context.profiles = profiles.map(id => ({ id })); verify.resolve(); }, nextVerification() { const old = verify; verify = deferred(); return old; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
(async () => {
  const app = harness(); app.render(); await tick(); app.receive(response('live', profileB)); app.render();
  assert.equal(app.navigation.length, 0); assert.equal(app.checks(), 0);
  app.context.account = { id: 'user' }; app.context.locked = true; app.render(); assert.equal(app.checks(), 0);
  app.context.locked = false; app.context.activeProfileId = profileA; app.context.profiles = [{ id: profileA }]; app.render(); assert.equal(app.checks(), 1); assert.equal(app.navigation.length, 0);
  app.resolveProfiles([profileA, profileB]); await tick(); app.render();
  assert.equal(app.context.activeProfileId, profileB); assert.equal(app.navigation.length, 1); assert.equal(app.navigation[0].pathname, '/transacao/nova');
  console.log('PASS: push aguarda login/desbloqueio, consulta perfis atualizados e só navega após selecionar o perfil correto.');
  app.cold.resolve(response('old-cold', profileA)); await tick(); app.render(); assert.equal(app.navigation.length, 1); assert.equal(app.context.activeProfileId, profileB);
  app.receive(response('live', profileB)); app.render(); assert.equal(app.navigation.length, 1);
  console.log('PASS: resposta antiga da abertura a frio não sobrescreve toque recente; repetição do mesmo evento não navega duas vezes.');
  app.nextVerification(); app.receive(response('foreign', '33333333-3333-4333-8333-333333333333', 'WEEKLY_SUMMARY')); app.render(); assert.equal(app.checks(), 2);
  app.resolveProfiles([profileA, profileB]); await tick(); app.render(); assert.equal(app.navigation.length, 1); assert.equal(app.alerts.length, 1); assert.equal(app.context.activeProfileId, profileB);
  app.unmount(); console.log('PASS: perfil ausente na lista atualizada não navega nem usa outro perfil como fallback.');
  const weekly = harness({ clearFails: true }); weekly.context.account = { id: 'user' }; weekly.context.activeProfileId = profileA;
  weekly.render(); await tick(); weekly.cold.resolve(response('weekly-cold', profileB, 'WEEKLY_SUMMARY')); await tick(); weekly.render();
  assert.equal(weekly.navigation.length, 0); weekly.resolveProfiles([profileA, profileB]); await tick(); weekly.render();
  assert.deepEqual(weekly.navigation[0], { pathname: '/relatorios/analises', params: { mode: 'weekly', periodStart: '2026-10-05', periodEnd: '2026-10-11' } });
  assert.equal(weekly.context.activeProfileId, profileB); weekly.unmount();
  console.log('PASS: resumo semanal na abertura a frio preserva período/perfil; falha de limpeza do SDK é contida sem impedir navegação.');

  const changed = harness(); changed.context.account = { id: 'old-user' }; changed.context.activeProfileId = profileA;
  changed.render(); await tick(); changed.receive(response('account-race', profileB)); changed.render();
  const oldVerification = changed.nextVerification(); changed.context.account = { id: 'new-user' }; changed.render();
  oldVerification.resolve(); await tick(); changed.render(); assert.equal(changed.navigation.length, 0);
  changed.resolveProfiles([profileA]); await tick(); changed.render(); assert.equal(changed.navigation.length, 0); assert.equal(changed.alerts.length, 1);
  changed.unmount(); console.log('PASS: troca de conta durante validação descarta resposta antiga e exige ownership da conta atual.');
  const entry = harness(); entry.context.account = { id: 'user' };
  entry.render(); await tick(); entry.receive(response('before-selection', profileB)); entry.render();
  entry.resolveProfiles([profileA, profileB]); await tick(); entry.render();
  assert.equal(entry.context.activeProfileId, null); assert.equal(entry.navigation.length, 0, 'push não pula a escolha inicial');
  entry.context.activeProfileId = profileA; entry.render();
  assert.equal(entry.context.activeProfileId, profileB); assert.equal(entry.navigation.length, 1);
  entry.unmount(); console.log('PASS: push pendente aguarda escolha explícita de perfil após login.');
  const limit = harness(); limit.context.account = { id: 'user' }; limit.context.activeProfileId = profileA;
  limit.render(); await tick(); limit.receive(response('spending-limit', profileB, 'SPENDING_LIMIT')); limit.render();
  limit.resolveProfiles([profileA, profileB]); await tick(); limit.render();
  assert.equal(limit.context.activeProfileId, profileB); assert.deepEqual(limit.navigation, ['/planejamento/limites-alertas']);
  limit.unmount(); console.log('PASS: US52 abre limites após validar ownership e selecionar o perfil do push.');
  console.log('PASS: 7 grupos de navegação push com componente/efeitos reais e SDK controlado.');
})().catch(e => { console.error(e); process.exitCode = 1; });
