const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Scheduler mínimo dos hooks: Promises controladas verificam o comportamento,
// sem renderizar componentes nativos nem acrescentar framework ao projeto.
function harness(context, { react = {}, stubs = {} } = {}) {
  const slots = []; let cursor = 0; let effects = []; let dirty = false; let hook; let value;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  function state(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; dirty = true; }];
  }
  function memo(callback, dependencies) {
    const index = cursor++; const previous = slots[index];
    if (!previous || !equal(previous.dependencies, dependencies)) slots[index] = { dependencies, callback };
    return slots[index].callback;
  }
  function effect(callback, dependencies) {
    const index = cursor++; const previous = slots[index];
    if (!previous || !equal(previous.dependencies, dependencies)) effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: callback() }; });
  }
  const load = createLoader({ react: { useState: state, useCallback: memo, useMemo: (factory, deps) => memo(factory, deps)(), useRef: initial => { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); }, useEffect: effect, ...react },
    'expo-router': { useFocusEffect: callback => effect(callback, [callback]) },
    '@/contexts/AppSessionContext': { useAppSession: () => context },
    ...stubs,
  });
  function render() {
    do { dirty = false; cursor = 0; effects = []; value = hook(); const pending = effects; effects = []; pending.forEach(run => run()); } while (dirty);
    return value;
  }
  return { load, mount: fn => { hook = fn; return render(); }, render, unmount: () => slots.forEach(slot => slot?.cleanup?.()) };
}
(async () => {
  const context = { account: { id: 'account-a' }, activeProfileId: 'profile-a' };
  const runner = harness(context); const api = runner.load('src/services/api-client.ts'); api.setApiSession('token-a', 'profile-a');
  const { useProfileResource } = runner.load('src/hooks/useProfileResource.ts');
  let pending = deferred(); const loader = () => pending.promise;
  let resource = runner.mount(() => useProfileResource(loader)); assert.equal(resource.loading, true);
  pending.resolve(['profile-a data']); await tick(); resource = runner.render(); assert.deepEqual(resource.data, ['profile-a data']);
  pending = deferred(); resource.reload(); resource = runner.render(); assert.equal(resource.refreshing, true); assert.equal(resource.loading, false); assert.deepEqual(resource.data, ['profile-a data']);
  pending.reject(new Error('network')); await tick(); resource = runner.render(); assert.deepEqual(resource.data, ['profile-a data']); assert.ok(resource.error); assert.equal(resource.refreshing, false);
  const obsolete = deferred(); pending = obsolete; resource.reload(); runner.render();
  context.account = { id: 'account-b' }; context.activeProfileId = 'profile-b'; api.setApiSession('token-b', 'profile-b'); pending = deferred();
  resource = runner.render(); assert.equal(resource.data, undefined); assert.equal(resource.loading, true);
  obsolete.resolve(['old private data']); await tick(); assert.equal(runner.render().data, undefined);
  pending.resolve(['profile-b data']); await tick(); assert.deepEqual(runner.render().data, ['profile-b data']);
  console.log('PASS: resource mantém dados no refresh e descarta conteúdo/respostas da conta anterior.');
  const beforeReload = deferred(); pending = beforeReload; runner.render().reload(); runner.render();
  const newest = deferred(); pending = newest; runner.render().reload();
  beforeReload.resolve(['obsolete before effect cleanup']); await tick();
  assert.deepEqual(runner.render().data, ['profile-b data']);
  newest.resolve(['newest profile-b data']); await tick(); assert.deepEqual(runner.render().data, ['newest profile-b data']);
  console.log('PASS: reload invalida resposta anterior imediatamente, antes do cleanup do efeito.');
  const afterUnmount = deferred(); pending = afterUnmount; runner.render().reload(); runner.render(); runner.unmount(); afterUnmount.resolve(['unmounted']); await tick();
  assert.deepEqual(runner.render().data, ['newest profile-b data']);
  console.log('PASS: resource desmontado não recebe atualização tardia.');
  const months = harness(context); const monthApi = months.load('src/services/api-client.ts'); monthApi.setApiSession('token-b', 'profile-b');
  const monthlyResource = months.load('src/hooks/useProfileResource.ts').useProfileResource;
  let monthRequest = deferred(); let monthLoader = () => monthRequest.promise;
  months.mount(() => monthlyResource(monthLoader)); monthRequest.resolve(['October']); await tick();
  assert.deepEqual(months.render().data, ['October']);
  const september = deferred(); monthLoader = () => september.promise;
  assert.equal(months.render().data, undefined, 'Nova seleção não exibe dados do mês anterior');
  const august = deferred(); monthLoader = () => august.promise; months.render();
  september.resolve(['September late']); await tick(); assert.equal(months.render().data, undefined);
  august.resolve([]); await tick(); assert.deepEqual(months.render().data, [], 'Período vazio não herda gastos');
  const oldProfile = deferred(); monthLoader = () => oldProfile.promise; months.render();
  context.activeProfileId = 'profile-c'; monthApi.setApiSession('token-b', 'profile-c');
  const newProfile = deferred(); monthLoader = () => newProfile.promise; months.render();
  oldProfile.resolve(['private profile-b expenses']); await tick(); assert.equal(months.render().data, undefined);
  newProfile.resolve(['profile-c month']); await tick(); assert.deepEqual(months.render().data, ['profile-c month']);
  months.unmount(); context.activeProfileId = 'profile-b';
  console.log('PASS: seleção mensal limpa dados antigos, descarta troca rápida e consulta do perfil anterior.');
  const foreground = harness(context); const foregroundApi = foreground.load('src/services/api-client.ts'); foregroundApi.setApiSession('token-b', 'profile-b');
  const foregroundHook = foreground.load('src/hooks/useProfileResource.ts').useProfileResource;
  let foregroundRequest = deferred(); const foregroundLoader = () => foregroundRequest.promise;
  foreground.mount(() => foregroundHook(foregroundLoader)); foregroundRequest.resolve(['existing form data']); await tick(); foreground.render();
  foregroundRequest = deferred(); context.foregroundRevision = 1;
  let resumed = foreground.render(); assert.deepEqual(resumed.data, ['existing form data']); assert.equal(resumed.loading, false); assert.equal(resumed.refreshing, true);
  foregroundRequest.resolve(['fresh after resume']); await tick(); assert.deepEqual(foreground.render().data, ['fresh after resume']); foreground.unmount();
  console.log('PASS: retorno do app reconsulta sem desmontar o formulário com dados já carregados.');
  const mutator = harness(context); const client = mutator.load('src/services/api-client.ts'); client.setApiSession('token-b', 'profile-b');
  const { useProfileMutation } = mutator.load('src/hooks/useProfileMutation.ts'); let mutation = mutator.mount(useProfileMutation);
  let writes = 0; let callbacks = 0; const writing = deferred();
  const first = mutation.run(() => { writes++; return writing.promise; }, () => callbacks++);
  const second = mutation.run(() => { writes++; return Promise.resolve(); }, () => callbacks++);
  assert.equal(writes, 1); assert.equal(mutator.render().busy, true); await second;
  client.setApiSession(null, null); writing.resolve('old'); await first; mutation = mutator.render(); assert.equal(callbacks, 0); assert.equal(mutation.busy, false);
  client.setApiSession('new-token', 'profile-b'); await mutation.run(() => Promise.reject(new Error('failure')), () => callbacks++); assert.ok(mutator.render().error);
  const late = deferred(); mutation = mutator.render(); const action = mutation.run(() => late.promise, () => callbacks++); mutator.unmount(); late.resolve('late'); await action; assert.equal(callbacks, 0);
  const writesBeforeUnmountedCall = writes; await mutation.run(() => { writes++; return Promise.resolve(); }, () => callbacks++); assert.equal(writes, writesBeforeUnmountedCall); assert.equal(callbacks, 0);
  console.log('PASS: mutation bloqueia duplo submit e callbacks após logout/desmontagem.');
  const synchronous = harness(context); const syncApi = synchronous.load('src/services/api-client.ts'); syncApi.setApiSession('token-b', 'profile-b');
  const syncHook = synchronous.load('src/hooks/useProfileResource.ts').useProfileResource;
  const syncLoader = () => { throw new syncApi.ApiError(400, 'Consulta inválida.'); };
  let syncResource = synchronous.mount(() => syncHook(syncLoader));
  await tick(); syncResource = synchronous.render(); assert.equal(syncResource.loading, false); assert.equal(syncResource.error, 'Consulta inválida.');
  synchronous.unmount(); console.log('PASS: erro síncrono do loader segue o estado de erro da tela, sem escapar do efeito.');
  let provided; let apiSession = { token: null, profileId: null, revision: 0 };
  const account = { id: 'entry-user', name: 'Ana', profileIds: ['only-profile'] };
  const profiles = [{ id: 'only-profile', nome: 'Pessoal', moedaBase: 'BRL' }];
  const authResult = { account, profiles, accessToken: 'test-token', activeProfileId: 'only-profile' };
  const entry = harness(null, { react: { createContext: () => ({ Provider: props => { provided = props.value; return null; } }) }, stubs: {
    'react/jsx-runtime': { jsx: (type, props) => type(props) },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/services/auth.service': { signIn: async () => authResult, signUp: async () => authResult },
    '@/services/api-client': { SessionChangedError: class extends Error {}, handleUnauthorized: () => {}, apiRequest: async () => profiles,
      getApiSession: () => ({ ...apiSession }), setApiSession: (token, profileId) => { apiSession = { token, profileId, revision: apiSession.revision + 1 }; } },
    '@/services/push.service': { deactivatePush: async () => true },
    '@/services/security.service': { getLocalSecuritySettings: () => ({}), initializeLocalSecurity: async () => ({}), hasLocalLock: () => false },
  } });
  const Provider = entry.load('src/contexts/AppSessionContext.tsx').AppSessionProvider;
  entry.mount(() => { Provider({ children: null }); return provided; }); await tick();
  await entry.render().signIn('ana@example.test', 'test-password'); let session = entry.render();
  assert.equal(session.account.id, account.id); assert.equal(session.activeProfileId, null); assert.equal(apiSession.profileId, null);
  await session.refreshProfiles(); session = entry.render(); assert.equal(session.activeProfileId, null, 'atualizar perfil único não pula a escolha');
  assert.throws(() => session.setActiveProfile('foreign-profile'), /não pertence/);
  session.setActiveProfile('only-profile'); session = entry.render(); assert.equal(session.activeProfileId, 'only-profile'); assert.equal(apiSession.profileId, 'only-profile');
  await session.signOut(); assert.equal(entry.render().account, null);
  await entry.render().signUp('Ana', 'ana@example.test', 'test-password'); assert.equal(entry.render().activeProfileId, null);
  entry.unmount(); console.log('PASS: login/cadastro exigem escolha explícita mesmo com perfil único; refresh não seleciona e ownership permanece.');
})().catch(error => { console.error(error); process.exitCode = 1; });
