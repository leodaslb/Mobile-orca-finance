// Services mobile -> fetch HTTP real -> Nest/Fastify -> Neon. Não usa a conta Leonardo.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const backend = path.resolve(__dirname, '../../backend');
require(path.join(backend, 'node_modules/dotenv')).config({ path: path.join(backend, '.env'), quiet: true });
require(path.join(backend, 'node_modules/reflect-metadata'));
process.env.NODE_ENV = 'test'; // nenhum scheduler gera ocorrências fora das fixtures.
process.env.TZ = 'America/Sao_Paulo';
const { NestFactory } = require(path.join(backend, 'node_modules/@nestjs/core'));
const { FastifyAdapter } = require(path.join(backend, 'node_modules/@nestjs/platform-fastify'));
const { AppModule } = require(path.join(backend, 'dist/app.module'));
const { configureApp } = require(path.join(backend, 'dist/common/configure-app'));
const { PrismaService } = require(path.join(backend, 'dist/database/prisma.service'));
const load = require('./ts-loader.cjs')();
const client = load('src/services/api-client.ts');
const auth = load('src/services/auth.service.ts');
const transactions = load('src/services/transaction.service.ts');
const categories = load('src/services/category.service.ts');
const recurrence = load('src/services/recurrence.service.ts');
const dashboard = load('src/services/dashboard.service.ts');
const dates = load('src/utils/date.ts');
const planning = load('src/services/planning.service.ts');
const goals = load('src/services/goal.service.ts');
const reports = load('src/services/report.service.ts');

const emails=[`block2-a-${randomUUID()}@example.test`,`block2-b-${randomUUID()}@example.test`];
const password='block2-test-password'; let app, prisma; let groups=0;
async function check(name,fn){await fn();groups++;console.log('PASS: '+name)}
function activate(s,profile=s.activeProfileId){client.setApiSession(s.accessToken,profile)}
async function cleanup(){
 if(!prisma)return;
 const users=await prisma.usuario.findMany({where:{email:{in:emails}},select:{id:true}});
 const ids=users.map(u=>u.id); const profiles=await prisma.perfilFinanceiro.findMany({where:{usuarioId:{in:ids}},select:{id:true}});
 const where={perfilId:{in:profiles.map(p=>p.id)}};
 await prisma.$transaction(async tx=>{
  await tx.aporteMeta.deleteMany({where:{meta:where}});
  await tx.regraGastoCanal.deleteMany({where:{regraGasto:where}});
  await tx.orcamentoCategoria.deleteMany({where:{orcamento:where}});
  await tx.transacaoOrcamento.deleteMany({where:{orcamento:where}});
  for(const m of ['transacao','auditoriaTransacao','tag','subcategoria','meta','regraGasto','orcamento','cotaGastoLivre'])await tx[m].deleteMany({where});
  await tx.perfilFinanceiro.deleteMany({where:{usuarioId:{in:ids}}});await tx.usuario.deleteMany({where:{id:{in:ids}}});
 });
}
async function leonardo(){
 const user=await prisma.usuario.findUnique({where:{id:'5c7d6752-8916-47bb-9895-0c719b239918'}});
 const profiles=await prisma.perfilFinanceiro.findMany({where:{usuarioId:user?.id ?? randomUUID()},orderBy:{id:'asc'}});
 const where={perfilId:{in:profiles.map(p=>p.id)}}; const rows={user,profiles};
 for(const m of ['transacao','auditoriaTransacao','meta','regraGasto','orcamento','cotaGastoLivre'])rows[m]=await prisma[m].findMany({where,orderBy:{id:'asc'}});
 rows.aportes=await prisma.aporteMeta.findMany({where:{meta:where},orderBy:{id:'asc'}});return JSON.stringify(rows);
}
(async()=>{
 app=await NestFactory.create(AppModule,new FastifyAdapter(),{logger:false});configureApp(app);await app.listen(0,'127.0.0.1');
 prisma=app.get(PrismaService);process.env.EXPO_PUBLIC_API_URL=`http://127.0.0.1:${app.getHttpAdapter().getInstance().server.address().port}`;
 const baseline=await leonardo();let a,b,catalog,goal,rule,second;
 try{
  a=await auth.signUp('Block2 A',emails[0],password);activate(a);catalog=await categories.getTransactionCatalog();if(!catalog.categories.length)throw new Error('Catálogo global vazio: configure o seed oficial antes do teste.');
  await check('US06/40 orçamento ausente, criação UUID, 74/75/100/101%, comparação e edição',async()=>{
   assert.equal(await planning.getMonthlyPlanningData('2026-09'),null);
   await planning.saveMonthlyBudget('2026-09',[{categoryId:catalog.categories[0].id,limitCents:10000}]);
   const tx=await client.apiRequest(client.profilePath('transactions'),{method:'POST',body:{tipo:'DESPESA',valor:'74.00',dataHora:'2026-09-15T12:00:00Z',descricao:'block2 thresholds',categoriaId:catalog.categories[0].id,status:'EFETIVADA'}});
   for(const [value,state] of [['74.00','normal'],['75.00','warning'],['100.00','warning'],['101.00','exceeded']]){
    await client.apiRequest(client.profilePath(`transactions/${tx.id}`),{method:'PATCH',body:{valor:value}});
    const budget=await planning.getMonthlyPlanningData('2026-09');assert.equal(budget.status,state);assert.equal(budget.categories[0].categoryId,catalog.categories[0].id);
    const comp=await planning.getPlannedVsActualData('2026-09');assert.equal(comp.differenceCents,Number(value)*100-10000);
   }
   await planning.saveMonthlyBudget('2026-09',[{categoryId:catalog.categories[0].id,limitCents:20000}]);assert.equal((await planning.getMonthlyPlanningData('2026-09')).totalBudgetCents,20000);
  });
  await check('US45 cota separada, gasto livre explícito, sem categoria comum excluído, saldo e mês',async()=>{
   assert.equal(await planning.getFreeSpendingAllowance('2026-09'),null);await planning.saveFreeSpendingAllowance(5000,'2026-09');
   await client.apiRequest(client.profilePath('transactions'),{method:'POST',body:{tipo:'DESPESA',valor:'12.34',dataHora:'2026-09-16T12:00:00Z',descricao:'block2 free',ehGastoLivre:true,status:'EFETIVADA'}});
   // Fixture importada: schema admite categoria nula, fora do cadastro manual comum.
   await prisma.transacao.create({data:{perfilId:a.activeProfileId,tipo:'DESPESA',valor:'7.00',dataHora:new Date('2026-09-17T12:00:00Z'),descricao:'block2 uncategorized import fixture',ehGastoLivre:false,status:'EFETIVADA'}});
   let q=await planning.getFreeSpendingAllowance('2026-09');assert.equal(q.usedCents,1234);assert.equal(q.remainingCents,3766);
   await planning.saveFreeSpendingAllowance(1000,'2026-09');q=await planning.getFreeSpendingAllowance('2026-09');assert.equal(q.remainingCents,-234);
   assert.equal(await planning.getFreeSpendingAllowance('2026-10'),null);
   const dash=await client.apiRequest(`${client.profilePath('dashboard')}?year=2026&month=9`);assert.equal(dash.saldoAtual,'-120.34');
  });
  await check('US29 regras UUID, diário, categoria, períodos/canais, edição e rejeições',async()=>{
   rule=await planning.saveSpendingRule({tipo:'LIMITE_DIARIO',categoriaId:null,limitCents:1500,periodo:'DIARIO',canais:['PUSH'],ativa:true});assert.match(rule.id,/^[a-f0-9-]{36}$/);
   for(const period of ['DIARIO','SEMANAL','MENSAL','ANUAL']){
    const row=await planning.saveSpendingRule({tipo:'LIMITE_CATEGORIA',categoriaId:catalog.categories[0].id,limitCents:5000,periodo:period,canais:['PUSH','EMAIL'],ativa:true});assert.equal(row.periodo,period);assert.deepEqual(row.canais,['EMAIL','PUSH']);
   }
   rule=await planning.saveSpendingRule({tipo:'LIMITE_DIARIO',categoriaId:null,limitCents:2500,periodo:'DIARIO',canais:['EMAIL'],ativa:false},rule.id);assert.equal(rule.valorLimite,'25.00');assert.equal(rule.ativa,false);
   await assert.rejects(planning.saveSpendingRule({tipo:'LIMITE_DIARIO',categoriaId:null,limitCents:1,periodo:'DIARIO',canais:[],ativa:true}),e=>e.status===400);
   await assert.rejects(client.apiRequest(client.profilePath('spending-rules'),{method:'POST',body:{tipo:'PERCENTUAL_RENDA',percentualLimite:'10',baseCalculo:'RENDA_EFETIVADA',periodo:'MENSAL',canais:['PUSH']}}),e=>e.status===400);
  });
  await check('US10 criar/listar/detalhar/editar, vencida, prorrogação e aporte sem despesa',async()=>{
   goal=await goals.createGoal({name:'Meta block2',targetCents:100000,deadline:'2020-01-01',suggestionFrequency:'weekly'});assert.ok(goal.isExpired);assert.equal(goal.suggestionCents,null);
   const balance=await client.apiRequest(`${client.profilePath('dashboard')}?year=2026&month=9`);const txCount=await prisma.transacao.count({where:{perfilId:a.activeProfileId}});
   await goals.addGoalContribution({goalId:goal.id,amountCents:2550,date:'2026-09-20'});goal=await goals.getGoalById(goal.id);assert.equal(goal.currentCents,2550);assert.equal(goal.remainingCents,97450);
   assert.equal((await prisma.transacao.count({where:{perfilId:a.activeProfileId}})),txCount);assert.equal((await client.apiRequest(`${client.profilePath('dashboard')}?year=2026&month=9`)).saldoAtual,balance.saldoAtual);
   goal=await goals.updateGoalDeadline(goal.id,'2027-12-31');assert.equal(goal.isExpired,false);assert.ok(goal.suggestionCents>0);assert.equal(goal.currentCents,2550);
   goal=await goals.createGoal({name:'Meta editada',targetCents:150000,deadline:'2027-12-31',suggestionFrequency:'daily'},goal.id);assert.equal(goal.name,'Meta editada');assert.equal(goal.suggestionFrequency,'daily');assert.equal((await goals.getGoals()).length,1);
  });
  await check('US13 dados agregados reais, sem categoria, zero e fronteiras UTC',async()=>{
   const r=await reports.getReportData('2026-09',1);assert.equal(r.totalCents,12034);assert.equal(r.categories.find(c=>c.categoryId==='uncategorized').amountCents,1934);
   await prisma.transacao.create({data:{perfilId:a.activeProfileId,tipo:'DESPESA',valor:'1.01',dataHora:new Date('2026-09-30T23:59:59.999Z'),descricao:'block2 UTC last millisecond',categoriaId:catalog.categories[0].id,status:'EFETIVADA'}});
   await prisma.transacao.create({data:{perfilId:a.activeProfileId,tipo:'DESPESA',valor:'9.99',dataHora:new Date('2026-10-01T00:00:00.000Z'),descricao:'block2 UTC next day',categoriaId:catalog.categories[0].id,status:'EFETIVADA'}});
   assert.equal((await reports.getReportData('2026-09',1)).totalCents,12135);assert.equal((await reports.getReportData('2026-10',1)).totalCents,999);assert.equal((await reports.getReportData('2026-08',1)).totalCents,0);
  });
  await check('US14 CSV UTF8 e XLSX real abertos sem corrupção; período correto',async()=>{
   const csv=await reports.generateFinancialExport('csv','2026-09',1);const text=new TextDecoder().decode(csv.bytes);assert.ok(text.includes('block2 free'));assert.ok(!text.includes('UTC next day'));assert.ok(text.includes('Descrição'));
   const file=await reports.generateFinancialExport('excel','2026-09',1);const {unzipSync,strFromU8}=require(path.join(backend,'node_modules/fflate'));const zip=unzipSync(file.bytes);assert.ok(zip['xl/workbook.xml']);assert.ok(Object.entries(zip).filter(([name])=>name.endsWith('.xml')).map(([,bytes])=>strFromU8(bytes)).join(' ').includes('block2 free'));
  });
  await check('todas as áreas trocam perfil sem mocks e ownership rejeita usuário B',async()=>{
   second=await client.apiRequest('/profiles',{method:'POST',body:{nome:'Block2 outro perfil'}});activate(a,second.id);
   assert.equal(await planning.getMonthlyPlanningData('2026-09'),null);assert.equal(await planning.getFreeSpendingAllowance('2026-09'),null);assert.deepEqual(await planning.getSpendingRules(),[]);assert.deepEqual(await goals.getGoals(),[]);assert.equal((await reports.getReportData('2026-09',1)).totalCents,0);
   await assert.rejects(goals.getGoalById(goal.id),e=>e.status===404);
   b=await auth.signUp('Block2 B',emails[1],password);activate(b,a.activeProfileId);
   for(const action of [()=>planning.getMonthlyPlanningData('2026-09'),()=>planning.getFreeSpendingAllowance('2026-09'),()=>planning.getSpendingRules(),()=>goals.getGoals(),()=>reports.getReportData('2026-09',1),()=>reports.generateFinancialExport('csv','2026-09',1)])await assert.rejects(action(),e=>e.status===403);
  });
 }finally{await cleanup();assert.equal(await prisma.usuario.count({where:{email:{in:emails}}}),0);assert.equal(await leonardo(),baseline);console.log('PASS: fixtures removidas; todos os dados verificados de Leonardo preservados.');await app.close();}
 console.log(`PASS: ${groups} grupos HTTP mobile → Neon do Bloco 2.`);
})().catch(async error=>{console.error(error.message);await cleanup().catch(()=>{});if(app)await app.close().catch(()=>{});process.exitCode=1});
