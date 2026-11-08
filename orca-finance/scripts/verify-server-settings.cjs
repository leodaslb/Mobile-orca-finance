const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const originalFetch = global.fetch;
process.env.EXPO_PUBLIC_API_URL = 'http://build.test:3000';
let stored = null, failStorage = false;
const platform = { OS: 'android' };
const load = createLoader({
  'react-native': { Platform: platform },
  'expo-secure-store': {
    getItemAsync: async () => { if (failStorage) throw new Error('internal'); return stored; },
    setItemAsync: async (_, value) => { if (failStorage) throw new Error('internal'); stored = value; },
    deleteItemAsync: async () => { if (failStorage) throw new Error('internal'); stored = null; },
  },
});
const api = load('src/services/api-client.ts');
const settings = load('src/services/server-settings.service.ts');
(async () => {
  await settings.initializeServerSettings();
  assert.equal(api.getApiServerURL(), 'http://build.test:3000');
  assert.equal(api.normalizeServerURL(' http://192.168.0.10:3000/ '), 'http://192.168.0.10:3000');
  for (const value of ['', 'file:///tmp', '192.168.0.1:3000', 'http:example.com', 'https://user:pass@example.com', 'http://host/api', 'http://host/?token=secret', 'http://host/#secret']) assert.throws(() => api.normalizeServerURL(value), e => e.status === 400);
  console.log('PASS: URL HTTP/HTTPS explícita, normalização e rejeição de credenciais/caminho/query.');

  let calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ status: 'ok' })); };
  assert.equal(await settings.testServerConnection('http://192.168.0.10:3000'), 'http://192.168.0.10:3000');
  assert.equal(calls[0].url, 'http://192.168.0.10:3000/health');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(api.getApiServerURL(), 'http://build.test:3000'); assert.equal(stored, null);
  await settings.saveServerSettings('http://192.168.0.10:3000');
  assert.equal(stored, 'http://192.168.0.10:3000');
  api.setApiServerURL(null); await settings.initializeServerSettings();
  assert.equal(api.getApiServerURL(), stored);
  await api.apiRequest('/health', { authenticated: false });
  assert.equal(calls.at(-1).url, 'http://192.168.0.10:3000/health');
  console.log('PASS: teste sem JWT não altera destino; configuração persiste, restaura e direciona HTTP real do cliente.');

  api.setApiSession('token-original', 'profile');
  await assert.rejects(settings.saveServerSettings('http://another.test'), e => e.status === 400);
  assert.throws(() => api.setApiServerURL('http://another.test'), e => e.status === 400);
  assert.equal(stored, 'http://192.168.0.10:3000');
  api.setApiSession(null, null);
  let release;
  global.fetch = () => new Promise(resolve => { release = resolve; });
  const pending = api.apiRequest('/auth/login', { authenticated: false, method: 'POST', body: {} });
  await settings.saveServerSettings('https://another.test');
  release(new Response(JSON.stringify({ accessToken: 'old-server-token' })));
  await assert.rejects(pending, e => e instanceof api.SessionChangedError);
  console.log('PASS: conta conectada bloqueia troca; resposta pendente do servidor anterior é descartada.');

  failStorage = true;
  await assert.rejects(settings.saveServerSettings('http://unsaved.test'), e => e.status === 0 && !e.message.includes('internal'));
  assert.equal(api.getApiServerURL(), 'https://another.test');
  await assert.rejects(settings.initializeServerSettings(), e => e.status === 0);
  failStorage = false;
  for (const reply of [() => Promise.reject(new Error('network details')), () => Promise.resolve(new Response('invalid')), () => Promise.resolve(new Response('{"status":"wrong"}')), () => Promise.resolve(new Response('{}', { status: 503 }))]) {
    global.fetch = reply;
    await assert.rejects(settings.testServerConnection('http://offline.test'), e => e.status === 0 && !e.message.includes('network details'));
    assert.equal(api.getApiServerURL(), 'https://another.test');
  }
  await settings.saveServerSettings(null);
  assert.equal(stored, null); assert.equal(api.getApiServerURL(), 'http://build.test:3000');
  console.log('PASS: falhas de persistência/rede/health preservam destino; restaurar padrão remove override.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
