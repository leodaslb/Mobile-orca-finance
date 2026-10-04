const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Scheduler mínimo dos hooks: Promises controladas verificam o comportamento,
// sem renderizar componentes nativos nem acrescentar framework ao projeto.
function harness(context) {
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
  const load = createLoader({ react: { useState: state, useCallback: memo, useRef: initial => { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); }, useEffect: effect },
    'expo-router': { useFocusEffect: callback => effect(callback, [callback]) },
    '@/contexts/AppSessionContext': { useAppSession: () => context },
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
  const mutator = harness(context); const client = mutator.load('src/services/api-client.ts'); client.setApiSession('token-b', 'profile-b');
  const { useProfileMutation } = mutator.load('src/hooks/useProfileMutation.ts'); let mutation = mutator.mount(useProfileMutation);
  let writes = 0; let callbacks = 0; const writing = deferred();
  const first = mutation.run(() => { writes++; return writing.promise; }, () => callbacks++);
  const second = mutation.run(() => { writes++; return Promise.resolve(); }, () => callbacks++);
  assert.equal(writes, 1); assert.equal(mutator.render().busy, true); await second;
  client.setApiSession(null, null); writing.resolve('old'); await first; mutation = mutator.render(); assert.equal(callbacks, 0); assert.equal(mutation.busy, false);
  client.setApiSession('new-token', 'profile-b'); await mutation.run(() => Promise.reject(new Error('failure')), () => callbacks++); assert.ok(mutator.render().error);
  const late = deferred(); mutation = mutator.render(); const action = mutation.run(() => late.promise, () => callbacks++); mutator.unmount(); late.resolve('late'); await action; assert.equal(callbacks, 0);
  console.log('PASS: mutation bloqueia duplo submit e callbacks após logout/desmontagem.');
})().catch(error => { console.error(error); process.exitCode = 1; });
