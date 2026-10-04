const assert = require('node:assert/strict');
process.env.EXPO_PUBLIC_API_URL = 'http://unit.test';
const load = require('./ts-loader.cjs')();
const client = load('src/services/api-client.ts');
const planning = load('src/services/planning.service.ts');
const goals = load('src/services/goal.service.ts');
const reports = load('src/services/report.service.ts');
const dates = load('src/utils/date.ts');
let calls = []; let response;
function reply(body, status = 200, headers) { response = new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }); }
global.fetch = async (url, options) => { calls.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined }); return response.clone(); };
client.setApiSession('fixture', 'profile-a');
async function check(name, fn) { await fn(); console.log('PASS: ' + name); }
const metric = { valorPlanejado: '100.00', valorRealizado: '75.00', desvio: '-25.00', percentualConsumido: '75.00', estado: 'PROXIMO_LIMITE' };
const goal = { id: 'goal-uuid', perfilId: 'profile-a', nome: 'Meta', valorAlvo: '1000.10', dataLimite: '2027-02-28', frequenciaSugestao: 'SEMANAL', valorAcumulado: '25.20', valorRestante: '974.90', percentualProgresso: '2.52', atingida: false, vencida: false, periodosRestantes: 20, sugestaoAtual: '48.75' };
(async () => {
 await check('US06/40 usa estados, percentuais e desvio oficiais sem refazer agregação', async () => {
  for (const [state, percent, status] of [['NORMAL','74.99','normal'],['PROXIMO_LIMITE','75.00','warning'],['PROXIMO_LIMITE','100.00','warning'],['EXCEDIDO','100.01','exceeded'],[null,null,null]]) {
   const m = { ...metric, estado: state, percentualConsumido: percent };
   reply({ id: 'budget-uuid', perfilId: 'profile-a', totais: m, categorias: [{ categoria: { id: 'category-uuid', nome: 'Categoria' }, ...m }] });
   const result = await planning.getMonthlyPlanningData('2026-10'); assert.equal(result.status, status); assert.equal(result.categories[0].categoryId, 'category-uuid'); assert.equal(result.differenceCents, -2500); assert.equal(result.percentage, percent);
  }
  reply({}, 404); assert.equal(await planning.getMonthlyPlanningData('2026-09'), null);
  reply({}, 403); await assert.rejects(planning.getMonthlyPlanningData('2026-09'), e => e.status === 403);
  reply({}, 500); await assert.rejects(planning.getMonthlyPlanningData('2026-09'), e => e.status === 500);
  reply({}); await planning.saveMonthlyBudget('2026-10',[{ categoryId: 'real-uuid', limitCents: 1010 }]);
  assert.deepEqual(calls.at(-1).body, { categorias: [{ categoriaId: 'real-uuid', valorPlanejado: '10.10' }] });
  assert.match(calls.at(-1).url, /profiles\/profile-a\/budgets\/monthly\/2026\/10$/); assert.equal(calls.at(-1).options.method,'PUT');
 });
 await check('US45 cota mensal mantém utilizado/restante da API, inclusive negativo', async () => {
  reply({ id: 'quota-uuid', perfilId: 'profile-a', valorLimite: '10.00', valorConsumido: '11.25', valorRestante: '-1.25' });
  const q=await planning.getFreeSpendingAllowance('2026-02'); assert.equal(q.usedCents,1125); assert.equal(q.remainingCents,-125);
  reply({}); await planning.saveFreeSpendingAllowance(999,'2026-02'); assert.deepEqual(calls.at(-1).body,{valorLimite:'9.99'}); assert.match(calls.at(-1).url,/2026\/2$/);
 });
 await check('US29 payload condicional, quatro períodos, PUSH/EMAIL por regra', async () => {
  reply({}); for (const period of ['DIARIO','SEMANAL','MENSAL','ANUAL']) {
   await planning.saveSpendingRule({tipo:'LIMITE_CATEGORIA',categoriaId:'category-uuid',limitCents:4321,periodo:period,canais:['PUSH','EMAIL'],ativa:true},'rule-uuid');
   assert.deepEqual(calls.at(-1).body,{tipo:'LIMITE_CATEGORIA',categoriaId:'category-uuid',valorLimite:'43.21',periodo:period,canais:['PUSH','EMAIL'],ativa:true}); assert.equal(calls.at(-1).options.method,'PATCH');
  }
  await planning.saveSpendingRule({tipo:'LIMITE_DIARIO',categoriaId:'ignored',limitCents:100,periodo:'ANUAL',canais:['EMAIL'],ativa:false});
  assert.deepEqual(calls.at(-1).body,{tipo:'LIMITE_DIARIO',categoriaId:null,valorLimite:'1.00',periodo:'DIARIO',canais:['EMAIL'],ativa:false});
  reply({},400); await assert.rejects(planning.saveSpendingRule({tipo:'LIMITE_DIARIO',limitCents:100,periodo:'DIARIO',categoriaId:null,canais:[],ativa:true}),e=>e.status===400);
 });
 await check('US10 mapper oficial, UUID, DATE, frequência, edição e aporte sem transação', async () => {
  reply(goal); const g=await goals.createGoal({name:' Meta ',targetCents:100010,deadline:'2027-02-28',suggestionFrequency:'weekly'});
  assert.equal(g.id,'goal-uuid'); assert.equal(g.currentCents,2520); assert.equal(g.remainingCents,97490); assert.equal(g.suggestionCents,4875);
  assert.deepEqual(calls.at(-1).body,{nome:'Meta',valorAlvo:'1000.10',dataLimite:'2027-02-28',frequenciaSugestao:'SEMANAL'});
  reply({...goal,vencida:true,sugestaoAtual:null}); assert.equal((await goals.getGoalById('goal-uuid')).isExpired,true);
  await goals.updateGoalDeadline('goal-uuid','2027-03-31'); assert.deepEqual(calls.at(-1).body,{dataLimite:'2027-03-31'});
  reply({}); const before=calls.length; await goals.addGoalContribution({goalId:'goal-uuid',amountCents:101,date:'2026-10-02'});
  assert.equal(calls.length,before+1); assert.match(calls.at(-1).url,/goals\/goal-uuid\/contributions$/); assert.deepEqual(calls.at(-1).body,{valor:'1.01',dataHora:dates.localDateTimeToISO('2026-10-02','00:00')});
 });
 await check('US13 períodos DATE, virada de ano, fevereiro bissexto e gráficos adaptados', async () => {
  assert.deepEqual(dates.calendarPeriod('2024-02'),{year:2024,month:2,startDate:'2024-02-01',endDate:'2024-02-29'});
  assert.equal(dates.calendarPeriod('2026-01',3).startDate,'2025-11-01'); assert.equal(dates.shiftMonth('2026-01',-1),'2025-12');
  reply({periodo:{startDate:'2026-10-01',endDate:'2026-10-31'},totalGasto:'12.34',categorias:[{categoriaId:null,nome:'Sem categoria',valor:'12.34',percentualDoTotal:'100.00'}]});
  const r=await reports.getReportData('2026-10',1); assert.equal(r.totalCents,1234); assert.equal(r.categories[0].percentage,1); assert.equal(r.categories[0].categoryId,'uncategorized');
  assert.match(calls.at(-1).url,/startDate=2026-10-01&endDate=2026-10-31/);
 });
 await check('US14 resposta binária CSV/XLSX intacta, MIME e assinatura validados',async()=>{
  const bytes=new Uint8Array([80,75,3,4,0,255]); response=new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
  const f=await reports.generateFinancialExport('excel','2026-10',1); assert.deepEqual(f.bytes,bytes); assert.match(f.fileName,/\.xlsx$/); assert.match(calls.at(-1).url,/format=xlsx/);
  response=new Response('CSV Data,Descricao',{headers:{'Content-Type':'text/csv; charset=utf-8'}}); const csv=await reports.generateFinancialExport('csv','2026-10',1); assert.ok(new TextDecoder().decode(csv.bytes).includes('Descricao'));
  reply({},200,{'Content-Type':'application/json'}); await assert.rejects(reports.generateFinancialExport('excel','2026-10',1));
 });
 await check('sessão/perfil durante download, 401 e rede sem fallback mock',async()=>{
  let release; global.fetch=async()=>new Promise(resolve=>{release=resolve}); const pending=reports.generateFinancialExport('csv','2026-10',1);
  client.setApiSession('fixture','profile-b'); release(new Response('csv',{headers:{'Content-Type':'text/csv'}})); await assert.rejects(pending,e=>e instanceof client.SessionChangedError);
  global.fetch=async()=>new Response('{}',{status:401}); await assert.rejects(goals.getGoals(),e=>e.status===401); assert.equal(client.getApiSession().token,null);
  client.setApiSession('fixture','profile-a'); global.fetch=async()=>{throw new Error('network')}; await assert.rejects(planning.getSpendingRules(),e=>e.status===0);
 });
 console.log('PASS: 7 grupos do Bloco 2.');
})().catch(e=>{console.error(e);process.exitCode=1});

