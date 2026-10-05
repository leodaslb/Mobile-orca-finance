const assert = require('node:assert/strict');
const createLoader = require('./ts-loader.cjs');
const originalFetch = global.fetch;
const tick = () => new Promise(resolve => setImmediate(resolve));
const jsx = (type, props) => ({ type, props: props ?? {} });
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? ''); }
function button(tree, label) { const result = nodes(tree).find(n => n.type === 'Pressable' && text(n).endsWith(label)); assert.ok(result, label); return result; }
function harness(extra = {}) {
  let cursor = 0; const slots = []; let render; const opened = []; let dismissed = 0;
  const ref = initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); };
  const state = initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; };
  const load = createLoader({
    react: { useState: state, useRef: ref, useEffect: fn => { const i = cursor++; if (!slots[i]) slots[i] = { cleanup: fn() }; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Platform: { OS: 'android' }, Keyboard: { dismiss: () => dismissed++ },
      StyleSheet: { create: value => value }, ...Object.fromEntries(['Pressable','Text','TextInput','View','ScrollView','Modal','KeyboardAvoidingView'].map(key => [key,key])) },
    '@react-native-community/datetimepicker': { default: 'NativePicker', DateTimePickerAndroid: { open: options => opened.push(options) } },
    '@tabler/icons-react-native': new Proxy({}, { get: (_, name) => name }),
    '@/components/common/CategoryIcon': { CategoryIcon: 'CategoryIcon' },
    '@/components/common/AppSwitch': { AppSwitch: 'AppSwitch' },
    '@/components/domain/ReceiptPicker': { ReceiptPicker: 'ReceiptPicker' },
    '@/components/domain/PurchaseReflectionModal': { PurchaseReflectionModal: 'PurchaseReflectionModal' },
    '@/components/domain/RecurrenceConfigurationModal': { RecurrenceConfigurationModal: 'RecurrenceConfigurationModal' },
    ...extra,
  });
  return { load, opened, dismissed: () => dismissed, mount: fn => { render = fn; cursor = 0; return fn(); },
    render: () => { cursor = 0; return render(); }, unmount: () => slots.forEach(slot => slot?.cleanup?.()) };
}
const categories = [{ id: 'category', name: 'Moradia', active: true }];
const initial = { type: 'expense', amountCents: 1250, date: '2026-10-04', time: '19:30',
  description: 'Conta de energia', notes: 'Conferir vencimento', tags: ['casa'], categoryId: 'category', subcategoryId: null };
const nativeDate = (year, month, day, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute);
(async () => {
  const pickerUi = harness(); const Field = pickerUi.load('src/components/common/DateTimeField.tsx').DateTimeField;
  const changes = []; let props = { mode: 'date', value: '04/10/2026', onChange: value => changes.push(value) };
  let tree = pickerUi.mount(() => Field(props)); nodes(tree).find(n => n.type === 'Pressable').props.onPress();
  assert.equal(pickerUi.opened[0].value.getFullYear(), 2026); assert.equal(pickerUi.opened[0].value.getMonth(), 9);
  assert.equal(pickerUi.opened[0].value.getDate(), 4); assert.equal(pickerUi.dismissed(), 1);
  pickerUi.opened[0].onDismiss(); assert.deepEqual(changes, []);
  pickerUi.opened[0].onValueChange({}, nativeDate(2027, 2, 21)); assert.deepEqual(changes, ['21/02/2027']);
  props = { ...props, value: '' }; tree = pickerUi.render(); nodes(tree).find(n => n.type === 'Pressable').props.onPress();
  assert.equal(pickerUi.opened.at(-1).value.toDateString(), new Date().toDateString());
  props = { ...props, mode: 'time', value: '19:30' }; tree = pickerUi.render(); nodes(tree).find(n => n.type === 'Pressable').props.onPress();
  const time = pickerUi.opened.at(-1); assert.equal(time.mode, 'time'); assert.equal(time.is24Hour, true);
  assert.equal(time.value.getHours(), 19); assert.equal(time.value.getMinutes(), 30);
  time.onDismiss(); assert.equal(changes.length, 1);
  time.onValueChange({}, nativeDate(2026,10,4,7,5)); assert.equal(changes.at(-1), '07:05');
  props = { ...props, disabled: true }; tree = pickerUi.render(); const count = pickerUi.opened.length;
  nodes(tree).find(n => n.type === 'Pressable').props.onPress(); assert.equal(pickerUi.opened.length,count);
  console.log('PASS: seletor nativo abre com data/hora existentes, usa hoje se vazio, cancela sem alterar e confirma formatos locais.');

  const formUi = harness({ '@/components/common/DateTimeField': { DateTimeField: 'DateTimeField' },
    '@/components/common/KeyboardLayout': { FormScrollView: 'FormScrollView' },
    '@/components/domain/CreateSubcategoryModal': { CreateSubcategoryModal: 'CreateSubcategoryModal' } });
  const Form = formUi.load('src/components/domain/TransactionForm.tsx').TransactionForm; const saved = [];
  const formProps = { categories, subcategories: [], initialValues: initial, onSubmit: value => saved.push(value) };
  tree = formUi.mount(() => Form(formProps));
  button(tree,'Selecione a subcategoria').props.onPress(); tree = formUi.render();
  button(tree,'+ Nova subcategoria').props.onPress(); tree = formUi.render();
  let modal = nodes(tree).find(n => n.type === 'CreateSubcategoryModal'); assert.equal(modal.props.category.id,'category');
  const before = nodes(tree).filter(n => n.type === 'TextInput').map(n => n.props.value);
  modal.props.onClose(); tree = formUi.render(); assert.deepEqual(nodes(tree).filter(n => n.type === 'TextInput').map(n => n.props.value),before);
  button(tree,'Selecione a subcategoria').props.onPress(); tree = formUi.render(); button(tree,'+ Nova subcategoria').props.onPress(); tree = formUi.render();
  modal = nodes(tree).find(n => n.type === 'CreateSubcategoryModal');
  modal.props.onCreated({ id:'subcategory', name:'Energia', categoryId:'category', active:true }); tree = formUi.render();
  assert.ok(text(tree).includes('Energia')); assert.equal(nodes(tree).find(n => n.type === 'CreateSubcategoryModal'),undefined);
  assert.deepEqual(nodes(tree).filter(n => n.type === 'TextInput').map(n => n.props.value),before);
  nodes(tree).find(n => n.type === 'DateTimeField' && n.props.mode === 'date').props.onChange('21/02/2027');
  nodes(tree).find(n => n.type === 'DateTimeField' && n.props.mode === 'time').props.onChange('07:05'); tree=formUi.render();
  button(tree,'Salvar transação').props.onPress(); assert.equal(saved[0].date,'2027-02-21'); assert.equal(saved[0].time,'07:05');
  assert.equal(saved[0].subcategoryId,'subcategory'); assert.equal(saved[0].amountCents,initial.amountCents);
  assert.equal(saved[0].notes,initial.notes); assert.deepEqual(saved[0].tags,initial.tags);
  console.log('PASS: criação contextual preserva formulário, cancelar não altera, atualiza opções/seleção e envia data/hora/subcategoria corretas.');
  const emptyUi=harness({ '@/components/common/DateTimeField':{ DateTimeField:'DateTimeField' }, '@/components/common/KeyboardLayout':{ FormScrollView:'FormScrollView' }, '@/components/domain/CreateSubcategoryModal':{ CreateSubcategoryModal:'CreateSubcategoryModal' } });
  const Empty=emptyUi.load('src/components/domain/TransactionForm.tsx').TransactionForm;
  assert.ok(!text(emptyUi.mount(()=>Empty({categories,subcategories:[]}))).includes('Nova subcategoria'));
  const editUi=harness({ '@/components/common/DateTimeField':{ DateTimeField:'DateTimeField' }, '@/components/common/KeyboardLayout':{ FormScrollView:'FormScrollView' }, '@/components/domain/CreateSubcategoryModal':{ CreateSubcategoryModal:'CreateSubcategoryModal' } });
  const Edit=editUi.load('src/components/domain/TransactionForm.tsx').TransactionForm; const edits=[];
  tree=editUi.mount(()=>Edit({...formProps,editing:true,onSubmit:value=>edits.push(value)}));
  button(tree,'Selecione a subcategoria').props.onPress(); tree=editUi.render(); button(tree,'+ Nova subcategoria').props.onPress(); tree=editUi.render();
  nodes(tree).find(n=>n.type==='CreateSubcategoryModal').props.onCreated({id:'edit-sub',name:'Condomínio',categoryId:'category',active:true}); tree=editUi.render();
  button(tree,'Salvar alterações').props.onPress(); assert.equal(edits[0].subcategoryId,'edit-sub'); assert.equal(edits[0].date,initial.date);
  console.log('PASS: edição reutiliza criação contextual; sem categoria não oferece criação de categoria principal.');

  const createUi=harness({ '@/components/domain/SubcategoryModal':{SubcategoryModal:'SubcategoryModal'} });
  const api=createUi.load('src/services/api-client.ts'); process.env.EXPO_PUBLIC_API_URL='http://ux.test'; api.setApiSession('token','profile');
  const Create=createUi.load('src/components/domain/CreateSubcategoryModal.tsx').CreateSubcategoryModal; const created=[];
  const calls=[]; let resolve; global.fetch=async(url,options)=>{ calls.push({url,options}); return new Promise(done=>resolve=done); };
  tree=createUi.mount(()=>Create({category:categories[0],onCreated:item=>created.push(item),onClose:()=>{}}));
  tree.props.onSave(); tree=createUi.render(); assert.ok(tree.props.error); assert.equal(calls.length,0);
  tree.props.onNameChange(' Energia '); tree=createUi.render(); tree.props.onSave(); tree.props.onSave();
  assert.equal(calls.length,1); assert.ok(calls[0].url.endsWith('/profiles/profile/subcategories'));
  assert.deepEqual(JSON.parse(calls[0].options.body),{categoriaId:'category',nome:'Energia'});
  resolve(new Response(JSON.stringify({}),{status:409,headers:{'Content-Type':'application/json'}})); await tick(); tree=createUi.render();
  assert.equal(tree.props.name,' Energia '); assert.ok(tree.props.error); assert.equal(created.length,0);
  tree.props.onSave(); resolve(new Response(JSON.stringify({id:'persisted',nome:'Energia',categoriaId:'category',ativa:true}),{status:201,headers:{'Content-Type':'application/json'}})); await tick();
  assert.deepEqual(created,[{id:'persisted',name:'Energia',categoryId:'category',active:true}]);
  tree=createUi.render(); tree.props.onSave(); api.setApiSession(null,null);
  resolve(new Response(JSON.stringify({id:'old',nome:'Energia',categoriaId:'category',ativa:true}),{status:201})); await tick(); assert.equal(created.length,1);
  console.log('PASS: POST real do service no perfil ativo, nome em branco, duplo toque, erro/retry sem perder nome e descarte após logout.');

  const txUi=harness({ '@/services/category.service': { getTransactionCatalog: async () => ({categories,subcategories:[]}) } }); const txApi=txUi.load('src/services/api-client.ts'); txApi.setApiSession('token','profile');
  const txService=txUi.load('src/services/transaction.service.ts'); const dates=txUi.load('src/utils/date.ts'); const requests=[];
  global.fetch=async(url,options)=>{ requests.push({url,options}); return new Response(JSON.stringify({id:'tx',tipo:'DESPESA',valor:'12.50',dataHora:'2099-02-21T10:05:00Z',descricao:'Energia',status:'PREVISTA',tags:[],recibos:[]}),{status:options.method==='POST'?201:200,headers:{'Content-Type':'application/json'}}); };
  await txService.createTransaction({...initial,date:'2099-02-21',time:'07:05',tags:[]});
  const payload=JSON.parse(requests.find(r=>r.options.method==='POST').options.body);
  assert.equal(payload.status,'PREVISTA'); assert.equal(payload.dataHora,dates.localDateTimeToISO('2099-02-21','07:05'));
  console.log('PASS: data futura mantém PREVISTA e conversão existente de horário local para timestamp da API.');

  const layoutUi=harness(); const layout=layoutUi.load('src/components/common/KeyboardLayout.tsx');
  const scroll=layout.FormScrollView({children:'conteúdo'}); const nativeScroll=nodes(scroll).find(n=>n.type==='ScrollView');
  assert.equal(nativeScroll.props.keyboardShouldPersistTaps,'handled'); assert.equal(nativeScroll.props.keyboardDismissMode,'on-drag');
  assert.equal(nativeScroll.props.contentContainerStyle[0].flexGrow,1); assert.equal(layout.KeyboardLayout({children:null}).props.behavior,'height');
  const Modal=layoutUi.load('src/components/domain/SubcategoryModal.tsx').SubcategoryModal;
  const modalTree=Modal({visible:true,name:'Energia',categoryName:'Moradia',editing:false,active:true,error:'',busy:false,onNameChange:()=>{},onClose:()=>{},onSave:()=>{}});
  assert.ok(nodes(modalTree).some(n=>n.type==='ScrollView')); assert.ok(nodes(modalTree).some(n=>n.props.accessibilityLabel==='Nome da subcategoria'));
  console.log('PASS: containers e modal usam rolagem com teclado e preservam campo/ações acessíveis na estrutura. Validação física é separada.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;});
