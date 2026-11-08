const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? ''); }
function find(tree, component, label) { const node = nodes(tree).find(n => n.type === component && n.props.label === label); assert.ok(node, `${component}: ${label}`); return node; }
function harness({ data, params = {}, services = {}, canGoBack = false }) {
  let cursor = 0, request = 0, render; const slots = [], navigation = [], loaders = [], reloads = [];
  const jsx = (type, props) => typeof type === 'function' ? type(props ?? {}) : { type, props: props ?? {} };
  const load = createLoader({
    react: { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; }, useCallback: fn => fn, useEffect: () => {}, useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', Modal: 'Modal', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', RefreshControl: 'RefreshControl', TextInput: 'TextInput', Platform: { OS: 'android' }, Alert: { alert: () => {} }, StyleSheet: { create: s => s } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@tabler/icons-react-native': { IconArrowLeft: 'IconArrowLeft', IconChevronRight: 'IconChevronRight' },
    '@/components/common/DateTimeField': { DateTimeField: 'DateTimeField' },
    './DateTimeField': { DateTimeField: 'DateTimeField' },
    'expo-router': { useRouter: () => ({ push: p => navigation.push(p), replace: p => navigation.push(p), canGoBack: () => canGoBack, back: () => navigation.push('back') }), useLocalSearchParams: () => params },
    '@/components/common/AppCard': { AppCard: 'AppCard' }, '@/components/common/AsyncState': { AsyncState: 'AsyncState' },
    '@/components/common/KeyboardLayout': { FormScrollView: 'FormScrollView' },
    '@/components/common/ProgressBar': { ProgressBar: 'ProgressBar' },
    '@/components/common/AppSwitch': { AppSwitch: 'AppSwitch' },
    '@/components/common/FinanceScreen': { ui: {}, FinanceScreen: 'FinanceScreen', Action: 'Action', Field: 'Field', Choices: 'Choices', DateField: 'DateField', Notice: 'Notice', Destination: 'Destination', Section: ({ title, description, children }) => [title, description, children], Badge: ({ label }) => label, EmptyState: ({ title, description }) => [title, description], money: value => String(value), moneyDifference: (a, b) => String(Number(a) - Number(b)), inputDate: value => value.split('/').reverse().join('-'), moneyInput: value => String(Number(value.replace(',', '.')).toFixed(2)) },
    '@/contexts/AppSessionContext': { useAppSession: () => ({ activeProfileId: 'profile' }) },
    '@/hooks/useProfileResource': { useProfileResource: loader => { const index = loaders.length; loaders.push(loader); return { data: typeof data === 'function' ? data(request++) : data, reload: () => reloads.push(index), loading: false }; } },
    '@/hooks/useProfileMutation': { useProfileMutation: () => ({ busy: false, error: '', run: async (operation, success) => success(await operation()) }) },
    ...services,
  });
  const update = () => { cursor = 0; request = 0; loaders.length = 0; return render(); };
  return { load, navigation, reloads, loadResource: index => loaders[index](), mount(file) { render = load(file).default; return update(); }, render: update };
}
(async () => {
  const serverCalls = [];
  const server = harness({ services: {
    '@/services/api-client': { getApiServerURL: () => 'http://old.test:3000', errorMessage: error => error.message },
    '@/services/server-settings.service': { testServerConnection: async value => { serverCalls.push(['test', value]); return value; }, saveServerSettings: async value => { serverCalls.push(['save', value]); } },
  } });
  let serverTree = server.mount('src/app/servidor.tsx');
  nodes(serverTree).find(n => n.props.accessibilityLabel === 'Endereço do servidor').props.onChangeText('http://new.test:3000'); serverTree = server.render();
  find(serverTree, 'Action', 'Testar e salvar').props.onPress(); find(serverTree, 'Action', 'Testar e salvar').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(serverCalls, [['test', 'http://new.test:3000'], ['save', 'http://new.test:3000']]);
  assert.deepEqual(server.navigation, ['/']);
  serverTree = server.render(); find(serverTree, 'Action', 'Usar endereço padrão do aplicativo').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(serverCalls.at(-1), ['save', null]);
  const offlineServer = harness({ services: {
    '@/services/api-client': { getApiServerURL: () => '', errorMessage: error => error.message },
    '@/services/server-settings.service': { testServerConnection: async () => { throw new Error('Servidor indisponível'); }, saveServerSettings: async () => assert.fail('Não salvar conexão rejeitada') },
  } });
  serverTree = offlineServer.mount('src/app/servidor.tsx'); find(serverTree, 'Action', 'Testar e salvar').props.onPress();
  await new Promise(resolve => setImmediate(resolve)); serverTree = offlineServer.render();
  assert.ok(text(serverTree).includes('Servidor indisponível')); assert.equal(offlineServer.navigation.length, 0);
  console.log('PASS: servidor testa antes de salvar, bloqueia duplo toque, restaura padrão e mantém formulário no erro.');
  const formatting = harness({}).load('src/components/common/FinanceScreen.tsx');
  assert.equal(formatting.moneyDifference('1200.00', '1000.00').replace(/\s/g, ''), 'R$200,00');
  assert.equal(formatting.moneyDifference('-1.05', '1.01').replace(/\s/g, ''), '-R$2,06');
  assert.equal(formatting.moneyDifference('99999999999999999.99', '0.01').replace(/\s/g, ''), 'R$99.999.999.999.999.999,98');
  assert.equal(formatting.moneyInput('0,00', true), '0.00'); assert.throws(() => formatting.moneyInput('0,00'), e => e.status === 400);
  console.log('PASS: apresentação monetária preserva sinal e centavos, inclusive além do limite numérico seguro; cálculo aceita capital zero.');
  const candidate = { categoriaId: 'cat', categoriaNome: 'Alimentação', valorPlanejado: '1000.00', valorRealizado: '1200.00', valorMetaSugerido: '1000.00', percentualEstouro: 20, percentualReducaoSugerida: 16.6667 };
  const accepted = [];
  const challenges = harness({ data: { challenges: [], proposals: { baseline: { startDate: '2026-10-01', endDate: '2026-10-31' }, challengePeriod: { startDate: '2026-11-01', endDate: '2026-11-30' }, candidates: [candidate] } }, services: { '@/services/challenge.service': { getCandidates: () => {}, getChallenges: () => {}, acceptChallenge: async id => { accepted.push(id); return { id: 'accepted' }; } } } });
  let tree = challenges.mount('src/app/planejamento/desafios.tsx'); assert.equal(accepted.length, 0);
  assert.ok(!nodes(tree).some(n => n.props.label === 'Aceitar desafio'));
  find(tree, 'Action', 'Revisar proposta').props.onPress(); tree = challenges.render(); assert.ok(text(tree).includes('2026-11-01')); assert.equal(accepted.length, 0);
  await find(tree, 'Action', 'Aceitar desafio').props.onPress(); assert.deepEqual(accepted, ['cat']); assert.equal(challenges.navigation[0].params.id, 'accepted');
  console.log('PASS: US59 tela real exige revisão e aceite; consulta não cria desafio; navega para o ID confirmado.');

  const filters = [], budgetWrites = [];
  const budgets = harness({ data: { rows: [], original: null, catalog: { categories: [] } }, services: {
    '@/services/budget.service': { getBudgets: async query => { filters.push(query); return []; }, saveBudget: async body => { budgetWrites.push(body); } },
    '@/services/category.service': { getTransactionCatalog: async () => ({ categories: [] }) },
  } });
  tree = budgets.mount('src/app/planejamento/orcamentos.tsx');
  find(tree, 'Choices', 'Tipo de orçamento').props.onChange('EVENTO'); tree = budgets.render();
  find(tree, 'Choices', 'Situação').props.onChange('false'); tree = budgets.render();
  await budgets.loadResource(0); assert.deepEqual(filters.at(-1), { type: 'EVENTO', active: false });
  assert.ok(text(tree).includes('Nenhum orçamento para os filtros selecionados.'));
  find(tree, 'Action', 'Novo orçamento').props.onPress(); tree = budgets.render();
  find(tree, 'Action', 'Cancelar criação').props.onPress(); tree = budgets.render();
  assert.ok(nodes(tree).some(n => n.props.label === 'Novo orçamento')); assert.equal(budgetWrites.length, 0);
  assert.equal(find(tree, 'Choices', 'Tipo de orçamento').props.value, 'EVENTO');
  find(tree, 'Choices', 'Tipo de orçamento').props.onChange('ALL'); tree = budgets.render();
  find(tree, 'Choices', 'Situação').props.onChange('ALL'); tree = budgets.render();
  await budgets.loadResource(0); assert.deepEqual(filters.at(-1), { type: undefined, active: undefined });
  const editingBudget = harness({ params: { editId: 'budget' }, data: index => index === 0 ? { rows: [], original: { id: 'budget', nome: 'Viagem', tipo: 'EVENTO', dataInicio: '2026-10-01', dataFim: '2026-10-31', categorias: [] }, catalog: { categories: [] } } : null,
    services: { '@/services/budget.service': { saveBudget: async body => { budgetWrites.push(body); } } } });
  tree = editingBudget.mount('src/app/planejamento/orcamentos.tsx');
  assert.ok(text(tree).includes('Tipo: Evento')); assert.ok(!nodes(tree).some(n => n.type === 'Choices' && n.props.label === 'Tipo'));
  find(tree, 'Field', 'Nome (opcional)').props.onChange('Alteração descartada'); tree = editingBudget.render();
  find(tree, 'Action', 'Cancelar edição').props.onPress(); assert.equal(budgetWrites.length, 0);
  assert.deepEqual(editingBudget.navigation[0], { pathname: '/planejamento/orcamento', params: { id: 'budget' } });
  const stackedEdit = harness({ canGoBack: true, params: { editId: 'budget' }, data: index => index === 0 ? { rows: [], original: { id: 'budget', nome: 'Viagem', tipo: 'EVENTO', dataInicio: '2026-10-01', dataFim: '2026-10-31', categorias: [] }, catalog: { categories: [] } } : null });
  tree = stackedEdit.mount('src/app/planejamento/orcamentos.tsx'); find(tree, 'Action', 'Cancelar edição').props.onPress(); assert.deepEqual(stackedEdit.navigation, ['back']);
  console.log('PASS: US07 filtros usam tipo/situação da API, inclusive inativos; cancelar criação preserva filtros sem gravar.');

  const zero = harness({ params: { zero: 'true' }, data: index => index === 0 ? { rows: [], original: null, catalog: { categories: [{ id: 'cat', name: 'Alimentação', active: true }] } } : '1200.00' });
  tree = zero.mount('src/app/planejamento/orcamentos.tsx'); assert.ok(text(tree).includes('Diferença: 1200.00'));
  find(tree, 'Field', 'Alimentação').props.onChange('100,00'); tree = zero.render(); assert.ok(text(tree).includes('Diferença: 1100.00'));
  find(tree, 'Field', 'Alimentação').props.onChange('1300,00'); tree = zero.render(); assert.ok(text(tree).includes('Diferença: -100.00')); assert.equal(find(tree, 'Action', 'Salvar orçamento').props.disabled, false);
  console.log('PASS: US09 formulário real recalcula falta/excesso imediatamente e não proíbe salvar só por desequilíbrio.');

  const calls = []; const preview = { summary: { totalRows: 1, validRows: 1, rejectedRows: 0, withoutCategory: 1, possibleDuplicates: 1 }, rows: [{ rowNumber: 2, status: 'VALID', descricao: 'Despesa', valor: '1.05', dataHora: '2026-10-01T12:00:00Z', categoria: { resolved: false }, errors: [], possibleDuplicate: true }] };
  const importer = harness({ services: { '@/services/import.service': { pickImport: async () => ({ name: 'test.csv', preview }), confirmImport: async (p, consent) => { calls.push({ p, consent }); return { created: 1 }; } } } });
  tree = importer.mount('src/app/transacao/importar.tsx'); assert.ok(!nodes(tree).some(n => n.props.label === 'Confirmar importação'));
  await find(tree, 'Action', 'Selecionar arquivo').props.onPress(); tree = importer.render(); assert.equal(calls.length, 0); assert.ok(text(tree).includes('possíveis duplicatas'));
  assert.equal(find(tree, 'Choices', 'Autoriza importar possíveis duplicatas?').props.value, 'no');
  find(tree, 'Choices', 'Autoriza importar possíveis duplicatas?').props.onChange('yes'); tree = importer.render();
  await find(tree, 'Action', 'Confirmar importação').props.onPress(); assert.equal(calls[0].consent, true); tree = importer.render(); assert.ok(text(tree).includes('1 transações importadas.'));
  console.log('PASS: US42 tela real apresenta preview antes de confirmar e exige escolha explícita para autorizar duplicatas.');

  const automationWrites = [];
  const automations = harness({ data: { rules: [{ id: 'rule', categoriaId: 'cat', subcategoriaId: null, atributoAlvo: 'essencialidade', valorDestino: 'ESSENCIAL', ativa: false }], catalog: { categories: [{ id: 'cat', name: 'Alimentação', active: true }], subcategories: [] } }, services: { '@/services/planning-tools.service': { getAutomations: () => {}, saveAutomation: async (body, id) => { automationWrites.push({ body, id }); return {}; } } } });
  tree = automations.mount('src/app/configuracoes/automacoes.tsx'); find(tree, 'Action', 'Editar regra').props.onPress(); tree = automations.render();
  assert.equal(find(tree, 'Choices', 'Estado').props.value, 'false'); await find(tree, 'Action', 'Salvar regra').props.onPress(); assert.equal(automationWrites[0].body.ativa, false); assert.equal(automationWrites[0].body.subcategoriaId, null);
  console.log('PASS: US20 edição real preserva regra inativa e envia somente um escopo.');

  const insights = harness({ params: { mode: 'goals' }, data: { goals: { window: '6m', startDate: '2026-04-16', endDate: '2026-10-16', closedGoals: 0, completedGoals: 0, completionRate: null } } });
  tree = insights.mount('src/app/relatorios/analises.tsx'); assert.ok(text(tree).includes('Sem metas encerradas')); assert.ok(!text(tree).includes('0%'));
  find(tree, 'Choices', 'Janela histórica').props.onChange('12m'); tree = insights.render(); assert.equal(find(tree, 'Choices', 'Janela histórica').props.value, '12m');
  console.log('PASS: US58 tela real distingue ausência de base de 0% e permite alternar 6/12 meses.');
  let resolveSimulation; let simulation = new Promise(resolve => { resolveSimulation = resolve; });
  const simulator = harness({ data: { categories: [] }, services: { '@/services/planning-tools.service': { simulatePurchase: async () => simulation } } });
  tree = simulator.mount('src/app/planejamento/simuladores.tsx'); find(tree, 'Field', 'Valor (R$)').props.onChange('100,00'); tree = simulator.render();
  const oldSimulation = find(tree, 'Action', 'Simular').props.onPress(); find(tree, 'Field', 'Valor (R$)').props.onChange('200,00'); tree = simulator.render();
  resolveSimulation({ valorTotal: '100.00', quantidadeParcelas: 1, valorParcela: '100.00', criaTransacoes: false, meses: [] }); await oldSimulation; tree = simulator.render(); assert.ok(!text(tree).includes('Impacto projetado'));
  simulation = Promise.resolve({ valorTotal: '200.00', quantidadeParcelas: 3, valorParcela: '66.67', criaTransacoes: false, meses: [
    { competencia: '2026-10', valorParcela: '66.67', rendaProjetada: '0.00', percentualRendaComprometida: null, impactoOrcamentoCategoria: null },
    { competencia: '2026-11', valorParcela: '66.67', rendaProjetada: '1000.00', percentualRendaComprometida: 6.667, impactoOrcamentoCategoria: { valorPlanejado: '100.00', valorProjetadoComCompra: '116.67', percentualProjetado: 116.67 } },
    { competencia: '2026-12', valorParcela: '66.66', rendaProjetada: '1000.00', percentualRendaComprometida: 6.666, impactoOrcamentoCategoria: { valorPlanejado: '100.00', valorProjetadoComCompra: '66.66', percentualProjetado: 66.66 } },
  ] }); await find(tree, 'Action', 'Simular').props.onPress(); tree = simulator.render(); assert.ok(text(tree).includes('Impacto projetado'));
  for (const label of ['2026-10 · 66.67', '2026-12 · 66.66', '116.67% do orçamento da categoria', 'Comprometimento não calculável', 'Sem orçamento aplicável à categoria']) assert.ok(text(tree).includes(label), label);
  console.log('PASS: US27 resposta de simulação anterior é descartada quando o usuário altera os parâmetros durante a consulta.');
  const metricQueries = [];
  const metrics = harness({ data: { metrics: { period: { startDate: '2026-01-01', endDate: '2026-12-31' }, savingsRate: { value: null, calculable: false }, averageDailyBalance: '-2.01' } },
    services: { '@/services/insight.service': { getMetrics: async (...range) => { metricQueries.push(range); return {}; } } } });
  tree = metrics.mount('src/app/relatorios/analises.tsx');
  assert.ok(text(tree).includes('Não calculável')); assert.ok(text(tree).includes('-2.01'));
  find(tree, 'DateField', 'Início').props.onChange('01/02/2026'); find(tree, 'DateField', 'Fim').props.onChange('28/02/2026'); tree = metrics.render();
  await metrics.loadResource(0); assert.deepEqual(metricQueries.at(-1), [undefined, undefined]);
  find(tree, 'Action', 'Aplicar período').props.onPress(); tree = metrics.render();
  await metrics.loadResource(0); assert.deepEqual(metricQueries.at(-1), ['2026-02-01', '2026-02-28']);
  find(tree, 'DateField', 'Fim').props.onChange('01/01/2026'); tree = metrics.render(); find(tree, 'Action', 'Aplicar período').props.onPress(); tree = metrics.render();
  assert.ok(text(tree).includes('Revise o intervalo.'));
  await metrics.loadResource(0); assert.deepEqual(metricQueries.at(-1), ['2026-02-01', '2026-02-28']);
  find(tree, 'Action', 'Voltar ao ano atual').props.onPress(); tree = metrics.render();
  assert.ok(!text(tree).includes('Revise o intervalo.')); assert.match(find(tree, 'DateField', 'Início').props.value, /^01\/01\//);
  await metrics.loadResource(0); assert.deepEqual(metricQueries.at(-1), [undefined, undefined]);
  console.log('PASS: US25 período só é aplicado explicitamente, intervalo invertido não consulta e reset anual limpa erro; renda zero e saldo negativo preservados.');

  const trendData = { trends: { referenceQuarter: { startDate: '2026-07-01', endDate: '2026-09-30' }, currentMonth: { asOfDate: '2026-10-16T12:00:00Z', partial: true }, categories: [
    { categoriaId: null, categoriaNome: 'Sem categoria', currentMonthTotal: '10.00', referenceMonthlyAverage: '0.00', variationPercentage: null, trend: 'AUMENTANDO' },
    { categoriaId: 'cat', categoriaNome: 'Alimentação', currentMonthTotal: '110.00', referenceMonthlyAverage: '100.00', variationPercentage: 10, trend: 'ESTAVEL' },
    { categoriaId: 'other', categoriaNome: 'Moradia', currentMonthTotal: '90.00', referenceMonthlyAverage: '100.00', variationPercentage: -10, trend: 'ESTAVEL' },
  ] } };
  const trends = harness({ params: { mode: 'trends' }, data: () => trendData });
  tree = trends.mount('src/app/relatorios/analises.tsx');
  for (const label of ['(parcial)', 'Sem categoria', 'Variação não calculável', 'Estável · 10%', 'Estável · -10%']) assert.ok(text(tree).includes(label), label);
  trendData.trends.currentMonth.partial = false; tree = trends.render(); assert.ok(!text(tree).includes('(parcial)'));
  console.log('PASS: US35 usa média mensal/trimestre e statuses da API, incluindo ±10%, base zero, Sem categoria e partial.');

  const cash = harness({ params: { mode: 'cash' }, data: { cash: { saldoAtual: '100.00', saldoProjetadoFimMes: '350.00', next30Days: { startDate: '2026-10-16', endDate: '2026-11-14', entradasPrevistas: '300.00', saidasPrevistas: '50.00', saldoProjetadoFinal: '350.00', movimentos: [
    { data: '2026-10-20', tipo: 'RECEITA', valor: '300.00', descricao: 'Salário', origem: 'RECORRENCIA' },
    { data: '2026-10-20', tipo: 'DESPESA', valor: '50.00', descricao: 'Conta', origem: 'TRANSACAO_PREVISTA' },
  ] } } } });
  tree = cash.mount('src/app/relatorios/analises.tsx');
  assert.ok(text(tree).includes('Saldo atual: 100.00')); assert.ok(text(tree).includes('Estimativa no fim do mês: 350.00'));
  assert.ok(text(tree).includes('Previsto (recorrência)')); assert.ok(text(tree).includes('Previsto (lançamento registrado)'));
  assert.equal(nodes(tree).filter(n => n.type === 'Text' && text(n) === '20/10/2026').length, 1);
  console.log('PASS: US32 linha temporal agrupa por dia, identifica origem prevista e distingue saldo atual/fim do mês/próximos 30 dias.');

  const calculationCalls = [];
  const calculations = harness({ data: { categories: [] }, services: { '@/services/planning-tools.service': { calculate: async (...input) => { calculationCalls.push(input); return { valorFuturo: '90.00', jurosAcumulados: '-10.00' }; } } } });
  tree = calculations.mount('src/app/planejamento/simuladores.tsx');
  find(tree, 'Choices', 'Simulação').props.onChange('compound-interest'); tree = calculations.render();
  find(tree, 'Field', 'Valor (R$)').props.onChange('100,00'); find(tree, 'Field', 'Taxa percentual por período').props.onChange('-10'); tree = calculations.render();
  await find(tree, 'Action', 'Simular').props.onPress(); tree = calculations.render();
  assert.deepEqual(calculationCalls[0], ['compound-interest', '100.00', -10, 1]); assert.ok(text(tree).includes('Ganho ou perda: -10.00'));
  find(tree, 'Choices', 'Simulação').props.onChange('opportunity-cost'); tree = calculations.render(); assert.ok(!text(tree).includes('Valor futuro hipotético'));
  find(tree, 'Field', 'Taxa percentual por período').props.onChange('-100'); find(tree, 'Field', 'Quantidade de períodos').props.onChange('0'); tree = calculations.render();
  await find(tree, 'Action', 'Simular').props.onPress(); assert.deepEqual(calculationCalls[1], ['opportunity-cost', '100.00', -100, 0]);
  console.log('PASS: US31 alterna cálculo isolado, aceita perda/zero períodos e invalida resultado ao editar parâmetros.');

  const planWrites = [], plan = { id: 'plan', nome: 'Computador', valorTotal: '1000.00', valorMensalPlanejado: '100.00', quantidadeMesesEstimada: 10, dataInicio: '2026-11-01' };
  const plans = harness({ data: [plan], services: { '@/services/planning-tools.service': { savePurchasePlan: async (body, id) => { planWrites.push({ body, id }); return {}; } } } });
  tree = plans.mount('src/app/planejamento/grandes-compras.tsx'); find(tree, 'Action', 'Editar plano').props.onPress(); tree = plans.render();
  find(tree, 'Field', 'Valor mensal planejado (opcional)').props.onChange(''); tree = plans.render(); find(tree, 'Action', 'Salvar plano').props.onPress();
  assert.deepEqual(planWrites[0], { id: 'plan', body: { nome: 'Computador', valorTotal: '1000.00', valorMensalPlanejado: null, dataInicio: '2026-11-01' } });
  const noMonthly = harness({ data: [{ ...plan, valorMensalPlanejado: null, quantidadeMesesEstimada: null }] });
  tree = noMonthly.mount('src/app/planejamento/grandes-compras.tsx'); assert.ok(text(tree).includes('Não informado')); assert.ok(text(tree).includes('Prazo não calculado'));
  console.log('PASS: US51 editar plano remove mensal com null; prazo ausente não vira zero e não há criação de movimentação.');

  const rule = { id: 'rule', tipo: 'PERCENTUAL_RENDA', categoriaId: 'cat', periodo: 'MENSAL', ativa: true, canais: ['PUSH'], percentualLimite: 10, baseCalculo: 'RENDA_PLANEJADA', valorLimite: null, valorConsumido: '320.00', percentualConsumido: '64.00', limiteAtingido: false, alertaAtivo: false, inicio: '2026-10-01T00:00:00Z', fimExclusivo: '2026-11-01T00:00:00Z', avaliacaoAtual: { valorAtual: '320.00', limiteCalculado: '500.00', violada: false } };
  const ruleWrites = [];
  const rules = harness({ data: { rules: [rule], categories: [{ id: 'cat', name: 'Alimentação', active: true }] }, services: { '@/services/planning.service': { saveSpendingRule: async (body, id) => { ruleWrites.push({ body, id }); return {}; } } } });
  tree = rules.mount('src/app/planejamento/limites-alertas.tsx'); assert.ok(text(tree).includes('Limite no período: 500.00')); assert.ok(text(tree).includes('64.00% consumido'));
  nodes(tree).find(n => n.props.accessibilityLabel === 'Editar limite Alimentação').props.onPress(); tree = rules.render();
  assert.equal(find(tree, 'Choices', 'Base de renda').props.value, 'RENDA_PLANEJADA');
  nodes(tree).find(n => n.props.accessibilityLabel === 'Percentual da renda').props.onChangeText('150'); tree = rules.render();
  nodes(tree).find(n => n.type === 'Pressable' && text(n) === 'Salvar regra').props.onPress();
  assert.equal(ruleWrites[0].body.percentualLimite, 150); assert.equal(ruleWrites[0].body.baseCalculo, 'RENDA_PLANEJADA');
  rule.percentualConsumido = null; rule.avaliacaoAtual.limiteCalculado = '0.00'; tree = rules.render();
  assert.ok(text(tree).includes('Percentual consumido não calculável')); assert.ok(text(tree).includes('Limite no período: 0.00'));
  assert.ok(!/e-mail|email/i.test(text(tree)));
  assert.ok(!nodes(tree).some(n => /e-mail/i.test(n.props.accessibilityLabel ?? '')));
  const legacyRules = harness({ data: { rules: [{ ...rule, canais: ['EMAIL'] }], categories: [{ id: 'cat', name: 'Alimentação', active: true }] }, services: { '@/services/planning.service': { saveSpendingRule: async body => { ruleWrites.push({ body }); return {}; } } } });
  tree = legacyRules.mount('src/app/planejamento/limites-alertas.tsx');
  assert.ok(text(tree).includes('Push não ativado'));
  nodes(tree).find(n => n.props.accessibilityLabel === 'Editar limite Alimentação').props.onPress(); tree = legacyRules.render();
  assert.equal(nodes(tree).find(n => n.props.accessibilityLabel === 'Receber alertas por push').props.value, false);
  nodes(tree).find(n => n.props.accessibilityLabel === 'Receber alertas por push').props.onChange(true); tree = legacyRules.render();
  nodes(tree).find(n => n.type === 'Pressable' && text(n) === 'Salvar regra').props.onPress();
  assert.deepEqual(ruleWrites.at(-1).body.canais, ['PUSH']);
  console.log('PASS: US52 mostra avaliação monetária remota, zero não vira percentual fictício e percentual acima de 100 não é bloqueado.');

  const challengeState = { challenges: [{ id: 'active', nome: 'Desafio', categoriaNome: 'Alimentação', dataInicio: '2026-11-01', dataFim: '2026-11-30', status: 'EM_ANDAMENTO', valorMeta: '1000.00', valorGastoAtual: '0.00' }], proposals: { baseline: { startDate: '2026-10-01', endDate: '2026-10-31' }, challengePeriod: { startDate: '2026-11-01', endDate: '2026-11-30' }, candidates: [candidate] } };
  const activeChallenges = harness({ data: challengeState, services: { '@/services/challenge.service': { acceptChallenge: async () => { throw new Error('Não deve aceitar outro desafio'); } } } });
  tree = activeChallenges.mount('src/app/planejamento/desafios.tsx'); assert.ok(text(tree).includes('ativo ou reservado'));
  find(tree, 'Action', 'Revisar proposta').props.onPress(); tree = activeChallenges.render();
  assert.equal(find(tree, 'Action', 'Aceitar desafio').props.disabled, true); await find(tree, 'Action', 'Aceitar desafio').props.onPress();
  find(tree, 'Action', 'Cancelar revisão').props.onPress(); tree = activeChallenges.render(); assert.ok(!nodes(tree).some(n => n.props.label === 'Aceitar desafio'));
  const renames = [];
  const detail = harness({ params: { id: 'active' }, data: index => index === 0 ? { ...challengeState.challenges[0], valorReferencia: '1200.00', valorGastoAtual: '1100.00', valorDisponivelAteMeta: '-100.00', percentualPeriodoConsumido: 110, percentualReducao: 16.6667 } : { suggestions: [{ type: 'WEEKLY_TARGET', valorSemanalAproximado: '250.00' }] },
    services: { '@/services/challenge.service': { renameChallenge: async (id, nome) => { renames.push({ id, nome }); return {}; } } } });
  tree = detail.mount('src/app/planejamento/desafio.tsx'); assert.ok(text(tree).includes('Disponível: -100.00')); assert.ok(text(tree).includes('não um limite semanal'));
  find(tree, 'Field', 'Novo nome do desafio').props.onChange(' Novo nome '); tree = detail.render();
  await find(tree, 'Action', 'Renomear').props.onPress(); assert.deepEqual(renames[0], { id: 'active', nome: 'Novo nome' });
  detail.reloads.length = 0; nodes(tree).find(n => n.type === 'FinanceScreen').props.refresh(); assert.deepEqual(detail.reloads, [0, 1]);
  console.log('PASS: US59 ativo reservado impede novo aceite na UI; detalhe preserva excesso, sugestões aproximadas, PATCH de nome e refresh das duas seções.');
  let picks = 0;
  const uncertainImport = harness({ services: { '@/services/import.service': { pickImport: async () => { picks++; return { name: 'test.csv', preview }; }, confirmImport: async () => { throw Object.assign(new Error('Indisponível'), { status: 503 }); } } } });
  tree = uncertainImport.mount('src/app/transacao/importar.tsx'); await find(tree, 'Action', 'Selecionar arquivo').props.onPress(); tree = uncertainImport.render();
  assert.equal(find(tree, 'Action', 'Confirmar importação').props.disabled, true);
  find(tree, 'Choices', 'Autoriza importar possíveis duplicatas?').props.onChange('yes'); tree = uncertainImport.render();
  await assert.rejects(find(tree, 'Action', 'Confirmar importação').props.onPress(), e => e.status === 503); tree = uncertainImport.render();
  assert.ok(text(tree).includes('Consulte suas transações')); assert.ok(!nodes(tree).some(n => n.props.label === 'Confirmar importação'));
  assert.equal(find(tree, 'Action', 'Selecionar arquivo').props.disabled, true);
  await find(tree, 'Action', 'Selecionar arquivo').props.onPress(); assert.equal(picks, 1);
  find(tree, 'Action', 'Consultar transações').props.onPress(); assert.equal(uncertainImport.navigation[0], '/(tabs)/transacoes');
  console.log('PASS: US42 resposta incerta bloqueia confirmar e selecionar novamente; consulta de transações permanece acessível.');

  const confirmations = [], safePreview = { ...preview, summary: { ...preview.summary, possibleDuplicates: 0 } };
  const lateDuplicate = harness({ services: { '@/services/import.service': { pickImport: async () => ({ name: 'test.csv', preview: safePreview }), confirmImport: async (_, consent) => { confirmations.push(consent); if (!consent) throw Object.assign(new Error('Conflito'), { status: 409 }); return { created: 1 }; } } } });
  tree = lateDuplicate.mount('src/app/transacao/importar.tsx'); await find(tree, 'Action', 'Selecionar arquivo').props.onPress(); tree = lateDuplicate.render();
  await assert.rejects(find(tree, 'Action', 'Confirmar importação').props.onPress(), e => e.status === 409); tree = lateDuplicate.render();
  assert.ok(nodes(tree).some(n => n.props.label === 'Confirmar importação')); assert.equal(find(tree, 'Choices', 'Autoriza importar possíveis duplicatas?').props.value, 'no');
  find(tree, 'Choices', 'Autoriza importar possíveis duplicatas?').props.onChange('yes'); tree = lateDuplicate.render();
  await find(tree, 'Action', 'Confirmar importação').props.onPress(); assert.deepEqual(confirmations, [false, true]);
  console.log('PASS: US42 duplicata surgida após preview exige consentimento posterior; 409 não vira sucesso ou retry automático.');

  let deactivateResult = false, registrationFails = false;
  const notifications = harness({ services: {
    '@/contexts/AppSessionContext': { useAppSession: () => ({ account: { id: 'user' } }) },
    '@/services/push.service': { registerPush: async () => { if (registrationFails) throw new Error('Falha controlada'); return {}; }, deactivatePush: async () => deactivateResult },
  } });
  tree = notifications.mount('src/app/configuracoes/notificacoes.tsx');
  await find(tree, 'Action', 'Desativar neste aparelho').props.onPress(); tree = notifications.render(); assert.ok(text(tree).includes('Não há registro salvo')); assert.ok(!text(tree).includes('Registro desativado no serviço.'));
  deactivateResult = true; await find(tree, 'Action', 'Desativar neste aparelho').props.onPress(); tree = notifications.render(); assert.ok(text(tree).includes('Registro desativado no serviço.'));
  await find(tree, 'Action', 'Permitir e registrar este aparelho').props.onPress(); tree = notifications.render(); assert.ok(text(tree).includes('Aparelho registrado.'));
  registrationFails = true; await assert.rejects(find(tree, 'Action', 'Permitir e registrar este aparelho').props.onPress()); tree = notifications.render(); assert.ok(!text(tree).includes('Aparelho registrado.'));
  console.log('PASS: US16/54 configurações distinguem desativação confirmada de registro local ausente e limpam sucesso antigo antes de nova tentativa.');
  const auditData = { audits: [
    { id: 'one', transacaoId: null, operacao: 'EXCLUSAO', realizadoEm: '2026-10-01T12:00:00Z', estadoAnterior: { id: 'deleted', descricao: 'Compra antiga', valor: '20.00' }, estadoNovo: null },
    { id: 'two', transacaoId: 'new', operacao: 'CRIACAO', realizadoEm: '2026-10-02T12:00:00Z', estadoAnterior: null, estadoNovo: { id: 'new', descricao: 'Salário', valor: '100.00' } },
  ], catalog: { categories: [], subcategories: [] } };
  const history = harness({ data: auditData }); tree = history.mount('src/app/transacao/historico.tsx');
  find(tree, 'Field', 'Buscar transação no histórico').props.onChange(' ANTIGA '); tree = history.render();
  assert.ok(text(tree).includes('Compra antiga')); assert.ok(!text(tree).includes('Salário'));
  find(tree, 'Action', 'Ver alterações').props.onPress(); tree = history.render(); assert.ok(text(tree).includes('Antes: 20.00'));
  find(tree, 'Field', 'Buscar transação no histórico').props.onChange('Inexistente'); tree = history.render(); assert.ok(text(tree).includes('Nenhum evento encontrado.'));
  console.log('PASS: US04 busca no histórico mantém snapshot de transação excluída, antes/depois e estado vazio.');

  const activations = [], dialogs = [], detailRow = { id: 'budget', nome: 'Viagem', tipo: 'EVENTO', ativo: true, dataInicio: '2026-10-01', dataFim: '2026-10-31', categorias: [], transacoesVinculadas: [], resumo: { valorRealizado: '100.00', valorPlanejado: '200.00', percentualConsumido: 50, estado: 'NORMAL' } };
  const budgetDetail = harness({ params: { id: 'budget' }, data: index => index === 0 ? detailRow : index === 1 ? [] : { categories: [] }, services: {
    'react-native': { Text: 'Text', View: 'View', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Alert: { alert: (...args) => dialogs.push(args) } },
    '@/services/budget.service': { setBudgetActive: async (id, active) => { activations.push({ id, active }); return {}; } },
  } });
  tree = budgetDetail.mount('src/app/planejamento/orcamento.tsx'); find(tree, 'Action', 'Desativar orçamento').props.onPress();
  assert.equal(activations.length, 0); assert.equal(dialogs[0][0], 'Desativar orçamento?');
  dialogs[0][2].find(b => b.text === 'Desativar').onPress(); assert.deepEqual(activations[0], { id: 'budget', active: false });
  detailRow.ativo = false; tree = budgetDetail.render(); find(tree, 'Action', 'Ativar orçamento').props.onPress(); assert.deepEqual(activations[1], { id: 'budget', active: true });
  find(tree, 'Action', 'Vincular transação').props.onPress(); tree = budgetDetail.render(); assert.equal(nodes(tree).find(n => n.type === 'Modal').props.visible, true);
  assert.ok(text(tree).includes('Nenhuma despesa disponível'));
  console.log('PASS: US07 confirma desativação, reativa sem editar finanças e abre painel com estado vazio para vínculos.');
  let focused = false; const selected = [], entryNavigation = [];
  const entrySession = { account: { name: 'Ana' }, activeProfileId: null, profiles: [{ id: 'personal', nome: 'Meu perfil', moedaBase: 'BRL' }],
    refreshProfiles: async () => {}, setActiveProfile: id => selected.push(id) };
  const entry = harness({ services: {
    '@/contexts/AppSessionContext': { useAppSession: () => entrySession },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-router': { useRouter: () => ({ replace: route => entryNavigation.push(route), push: route => entryNavigation.push(route) }), useFocusEffect: fn => { if (!focused) { focused = true; fn(); } } },
  } });
  tree = entry.mount('src/app/selecionar-perfil.tsx'); assert.equal(selected.length, 0);
  let profileButton = nodes(tree).find(n => n.props.accessibilityLabel === 'Entrar no perfil Meu perfil');
  assert.equal(profileButton.props.disabled, true);
  await new Promise(resolve => setImmediate(resolve)); tree = entry.render();
  assert.ok(text(tree).includes('Quem vai usar?')); assert.ok(text(tree).includes('MP'));
  profileButton = nodes(tree).find(n => n.props.accessibilityLabel === 'Entrar no perfil Meu perfil');
  assert.equal(profileButton.props.disabled, false); assert.equal(selected.length, 0);
  profileButton.props.onPress(); assert.deepEqual(selected, ['personal']); assert.deepEqual(entryNavigation, ['/(tabs)']);
  nodes(tree).find(n => n.props.accessibilityLabel === 'Adicionar perfil').props.onPress(); assert.equal(entryNavigation.at(-1), '/configuracoes/perfis');
  console.log('PASS: US18 entrada mostra avatar/perfil único, aguarda atualização e só entra após toque explícito; adicionar reutiliza gerenciamento.');
  console.log('PASS: 21 grupos de interação + 1 de apresentação monetária; JSX/hooks controlados, validação visual Android separada.');
})().catch(e => { console.error(e); process.exitCode = 1; });
