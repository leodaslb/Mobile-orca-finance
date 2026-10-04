const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const originalFetch = global.fetch;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const catalog = { categories: [{ id: 'category', name: 'Lazer e Estilo de Vida', active: true }], subcategories: [] };
const input = { type: 'expense', amountCents: 2550, date: '2099-10-03', time: '12:00', description: 'Compra revisada', categoryId: 'category' };
const load = createLoader({ '@/services/category.service': { getTransactionCatalog: async () => catalog } });
const api = load('src/services/api-client.ts'); const transactions = load('src/services/transaction.service.ts');
const reflections = load('src/services/reflection.service.ts');
const remote = { id: 'transaction', perfilId: 'profile', tipo: 'DESPESA', valor: '25.50', descricao: input.description,
  dataHora: '2099-10-03T12:00:00Z', categoriaId: 'category', status: 'EFETIVADA', essencialidade: 'NAO_CLASSIFICADA', tags: [], recibos: [] };
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
function ui(extra = {}) {
  let cursor = 0; const slots = []; let render;
  const state = initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; };
  const loader = createLoader({
    react: { useState: state, useCallback: fn => fn, useEffect: () => {}, useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl', Alert: { alert: () => {} }, StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@tabler/icons-react-native': new Proxy({}, { get: (_, name) => name }),
    '@/components/common/CategoryIcon': { CategoryIcon: 'CategoryIcon' },
    '@/components/common/AppSwitch': { AppSwitch: 'AppSwitch' },
    '@/components/domain/ReceiptPicker': { ReceiptPicker: 'ReceiptPicker' },
    '@/components/domain/PurchaseReflectionModal': { PurchaseReflectionModal: 'PurchaseReflectionModal' },
    '@/components/domain/RecurrenceConfigurationModal': { RecurrenceConfigurationModal: 'RecurrenceConfigurationModal' },
    '@/components/common/AppCard': { AppCard: 'AppCard' },
    '@/components/common/AsyncState': { AsyncState: 'AsyncState' },
    ...extra,
  });
  return { load: loader, mount: fn => { render = fn; cursor = 0; return render(); }, render: () => { cursor = 0; return render(); } };
}
const button = (tree, label) => nodes(tree).find(node => node.type === 'Pressable' && text(node) === label);
const field = (tree, placeholder) => nodes(tree).find(node => node.type === 'TextInput' && node.props.placeholder === placeholder);
(async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://reflection-exit.test'; api.setApiSession('token', 'profile');
  const calls = []; global.fetch = async (url, options) => { calls.push({ url, options });
    return options.method === 'DELETE' ? new Response(null, { status: 204 }) : json(url.endsWith('/transactions/transaction') ? remote : { id: 'item', descricao: 'Descrição original', liberado: true }); };
  assert.equal((await reflections.getRemoteReflectionItem('item')).descricao, 'Descrição original');
  assert.equal(calls.length, 1); assert.equal(calls[0].options.method, 'GET');
  await reflections.discardRemoteReflectionItem('item'); assert.equal(calls[1].options.method, 'DELETE');
  assert.ok(calls.every(call => !call.url.endsWith('/transactions')));
  console.log('PASS: consultar confirmação não cria compra; desistir usa somente DELETE do item/perfil com JWT.');

  calls.length = 0; global.fetch = async (url, options) => { calls.push({ url, options }); return json(remote); };
  assert.equal((await transactions.createTransaction(input, undefined, 'item')).status, 'effective');
  const posts = calls.filter(call => call.options.method === 'POST'); assert.equal(posts.length, 1);
  assert.ok(posts[0].url.endsWith('/profiles/profile/reflection-items/item/transactions'));
  assert.equal(JSON.parse(posts[0].options.body).status, 'EFETIVADA', 'Mesmo com data futura informada novamente');
  assert.equal(posts[0].options.headers.Authorization, 'Bearer token');
  assert.ok(calls.some(call => call.url.endsWith('/profiles/profile/transactions/transaction')));
  assert.ok(!calls.some(call => call.options.method === 'DELETE'), 'Remoção pertence à mesma operação financeira no servidor');
  await assert.rejects(transactions.createTransaction({ ...input, type: 'income' }, undefined, 'item'), /despesa/);
  global.fetch = async () => json({}, 409); await assert.rejects(transactions.createTransaction(input, undefined, 'item'), error => error.status === 409);
  console.log('PASS: novo envio da reflexão força EFETIVADA, usa endpoint atômico e preserva erros/conflitos sem DELETE separado.');

  const formUi = ui(); const Form = formUi.load('src/components/domain/TransactionForm.tsx').TransactionForm;
  const submitted = []; const props = { ...catalog, initialDescription: 'Descrição original', expenseOnly: true,
    onSubmit: (...value) => submitted.push(value) };
  let tree = formUi.mount(() => Form(props));
  const fields = nodes(tree).filter(node => node.type === 'TextInput');
  assert.deepEqual(fields.filter(node => node.props.value).map(node => node.props.value), ['Descrição original']);
  assert.ok(text(tree).includes('Selecione a categoria')); assert.ok(text(tree).includes('Selecione o método'));
  assert.equal(nodes(tree).find(node => node.type === 'ReceiptPicker').props.value, null);
  assert.equal(button(tree, 'Receita').props.disabled, true);
  button(tree, 'Salvar transação').props.onPress(); assert.equal(submitted.length, 0);
  tree = formUi.render();
  field(tree, 'R$ 0,00').props.onChangeText('25,50'); field(tree, 'dd/mm/aaaa').props.onChangeText('03102026'); field(tree, 'hh:mm').props.onChangeText('1200');
  tree = formUi.render(); button(tree, 'Selecione a categoria').props.onPress(); tree = formUi.render();
  button(tree, 'Lazer e Estilo de Vida').props.onPress(); tree = formUi.render();
  button(tree, 'Salvar transação').props.onPress(); assert.equal(submitted.length, 1);
  assert.equal(submitted[0][0].description, 'Descrição original'); assert.equal(submitted[0][0].amountCents, 2550);
  assert.equal(submitted[0][0].paymentMethod, null); assert.deepEqual(submitted[0][0].tags, []); assert.equal(submitted[0][0].receiptFile, null);
  tree = formUi.render(); nodes(tree).find(node => node.props.accessibilityLabel === 'Compra não essencial').props.onPress();
  tree = formUi.render(); button(tree, 'Salvar transação').props.onPress(); tree = formUi.render();
  const prompt = nodes(tree).find(node => node.type === 'PurchaseReflectionModal'); assert.equal(prompt.props.visible, true);
  prompt.props.onReview(); assert.equal(nodes(formUi.render()).find(node => node.type === 'PurchaseReflectionModal').props.visible, false);
  assert.equal(submitted.length, 1, 'Revisar pergunta não cria compra');
  console.log('PASS: formulário real reaproveita apenas descrição; dados vazios exigem novo preenchimento; pergunta para não essencial permanece.');

  const context = { account: { id: 'user' }, activeProfileId: 'profile' }; const nav = [];
  let resource = { loading: true, reload: () => {} }; let capturedLoader; let reflection = { id: 'item', descricao: 'Descrição original', liberado: true };
  let creationError; let writes = 0;
  const screenUi = ui({
    'expo-router': { useLocalSearchParams: () => ({ reflectionItemId: 'item' }), useRouter: () => ({ canGoBack: () => true, back: () => nav.push('back'), replace: path => nav.push(path) }), Stack: { Screen: 'Stack.Screen' } },
    '@/contexts/AppSessionContext': { useAppSession: () => context },
    '@/hooks/useProfileResource': { useProfileResource: loader => { capturedLoader = loader; return resource; } },
    '@/components/domain/TransactionForm': { TransactionForm: 'TransactionForm' },
    '@/services/category.service': { getTransactionCatalog: async () => catalog },
    '@/services/api-client': api,
    '@/services/reflection.service': { getRemoteReflectionItem: async () => reflection },
    '@/services/transaction.service': { ...transactions, createTransaction: async (...args) => { writes++; assert.equal(args[2], 'item'); if (creationError) throw creationError; return { id: 'transaction' }; } },
  });
  const Screen = screenUi.load('src/app/transacao/nova.tsx').default;
  tree = screenUi.mount(Screen); assert.equal(nodes(tree).find(node => node.type === 'TransactionForm'), undefined);
  const loaded = await capturedLoader(); assert.equal(writes, 0); resource = { ...resource, loading: false, data: loaded }; tree = screenUi.render();
  let form = nodes(tree).find(node => node.type === 'TransactionForm'); assert.equal(form.props.initialDescription, 'Descrição original'); assert.equal(form.props.initialValues, undefined);
  nodes(tree).find(node => node.props.accessibilityLabel === 'Voltar').props.onPress(); assert.deepEqual(nav, ['back']); assert.equal(writes, 0); nav.length = 0;
  creationError = new api.ApiError(400, 'Confira os dados'); await form.props.onSubmit(input); tree = screenUi.render();
  assert.equal(nav.length, 0); assert.equal(nodes(tree).find(node => node.type === 'TransactionForm').props.error, 'Confira os dados');
  creationError = undefined; form = nodes(tree).find(node => node.type === 'TransactionForm'); await form.props.onSubmit(input);
  assert.deepEqual(nav, [{ pathname: '/transacao/[id]', params: { id: 'transaction' } }]);
  reflection = { ...reflection, liberado: false }; await assert.rejects(capturedLoader(), /Aguarde/);
  console.log('PASS: tela real aguarda leitura/liberação; abrir/voltar/erro mantêm item; sucesso navega para compra salva.');

  let discarded = 0; let refreshed = 0; const routes = [];
  const listUi = ui({ 'expo-router': { useRouter: () => ({ push: route => routes.push(route) }) },
    '@/services/reflection.service': { getRemoteReflectionItems: async () => [] , discardRemoteReflectionItem: async id => { assert.equal(id, 'ready'); discarded++; } },
    '@/hooks/useProfileResource': { useProfileResource: () => ({ data: [
      { id: 'waiting', descricao: 'Aguardar', liberado: false, entradaEm: '2026-10-01', liberaEm: '2026-10-04', duracaoHoras: 72 },
      { id: 'ready', descricao: 'Liberado', liberado: true, entradaEm: '2026-10-01', liberaEm: '2026-10-03', duracaoHoras: 48 }], reload: () => refreshed++ }) },
    '@/hooks/useProfileMutation': { useProfileMutation: () => ({ busy: false, run: async (operation, success) => success(await operation()) }) },
  });
  tree = listUi.mount(listUi.load('src/app/reflexao/index.tsx').default);
  assert.equal(nodes(tree).filter(node => node.type === 'Pressable' && text(node) === 'Confirmar decisão').length, 1);
  button(tree, 'Confirmar decisão').props.onPress(); assert.deepEqual(routes, [{ pathname: '/transacao/nova', params: { reflectionItemId: 'ready' } }]);
  assert.equal(discarded, 0); await button(tree, 'Desistir').props.onPress(); assert.equal(discarded, 1); assert.equal(refreshed, 1);
  console.log('PASS: lista real expõe decisões apenas após liberação; confirmar somente navega; desistência recarrega lista.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
