import { IconChevronLeft, IconPlus, IconPencil, IconBell, IconX } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSwitch } from '@/components/common/AppSwitch';
import { Badge, Choices, money } from '@/components/common/FinanceScreen';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { useAppSession } from '@/contexts/AppSessionContext';
import { getTransactionCatalog, type CatalogCategory } from '@/services/category.service';
import { getSpendingRules, saveSpendingRule, type SpendingRule, type SpendingRuleInput, type RulePeriod, type RuleChannel } from '@/services/planning.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { decimalToCents, formatCurrency, parseCurrencyToCents } from '@/utils/currency';
const periods = { DIARIO: 'Diário', SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual' };
export default function SpendingLimitsScreen() {
  const { activeProfileId } = useAppSession();
  return <SpendingLimitsContent key={activeProfileId} />;
}
function SpendingLimitsContent() {
  const router = useRouter();
  const resource = useProfileResource(useCallback(async () => {
    const [rules, catalog] = await Promise.all([getSpendingRules(), getTransactionCatalog()]); return { rules, categories: catalog.categories };
  }, []));
  const [editing, setEditing] = useState<SpendingRule | 'new' | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  function group(title: string, rules: SpendingRule[]) {
    return <View style={styles.card}><Text style={styles.sectionTitle}>{title}</Text>
      {!rules.length && <Text style={styles.caption}>Nenhum limite configurado.</Text>}
      {rules.map(rule => <Pressable key={rule.id} accessibilityRole="button" accessibilityLabel={`Editar limite ${resource.data?.categories.find(c => c.id === rule.categoriaId)?.name ?? 'diário'}`} onPress={() => setEditing(rule)} style={styles.ruleRow}>
        <View style={styles.categoryIcon}><IconBell size={22} color={colors.primary} /></View>
        <View style={[styles.flex, { gap: 6 }]}><Text style={styles.label}>{resource.data?.categories.find(c => c.id === rule.categoriaId)?.name ?? 'Limite diário'}</Text><Badge label={rule.ativa ? 'Ativo' : 'Inativo'} tone={rule.ativa ? 'positive' : 'neutral'} /><Text style={styles.amount}>{rule.tipo === 'PERCENTUAL_RENDA' ? `${rule.percentualLimite}% · ${rule.baseCalculo === 'RENDA_PLANEJADA' ? 'renda planejada' : 'renda efetivada'}` : rule.valorLimite ? formatCurrency(decimalToCents(rule.valorLimite)) : '—'}</Text><Text style={styles.caption}>{periods[rule.periodo]} · {rule.canais.includes('PUSH') ? 'Push' : 'Push não ativado'}</Text><RuleEvaluation rule={rule} /></View>
        <IconPencil size={20} color={colors.textSecondary} />
      </Pressable>)}
    </View>;
  }
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/planejamento')}><IconChevronLeft color={colors.primary} /></Pressable><Text style={styles.title}>Limites e alertas</Text><View style={styles.iconButton} /></View>
    <ScrollView refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.reload} />} contentContainerStyle={styles.content}>
      {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
      {resource.data && <>
        {group('Limite diário', resource.data.rules.filter(rule => rule.tipo === 'LIMITE_DIARIO'))}
        {group('Limites por categoria', resource.data.rules.filter(rule => rule.tipo === 'LIMITE_CATEGORIA'))}
        {group('Regras percentuais de renda', resource.data.rules.filter(rule => rule.tipo === 'PERCENTUAL_RENDA'))}
        <Pressable style={styles.addLimit} onPress={() => setEditing('new')} accessibilityRole="button" accessibilityLabel="Adicionar limite"><IconPlus color={colors.primary} /><Text style={styles.label}>Adicionar limite</Text></Pressable>
        <View style={styles.card}><Text style={styles.sectionTitle}>Alertas por push</Text><Text style={styles.caption}>Ative Push na regra e registre seu aparelho em Notificações. Uma nova violação pode gerar outro aviso após o consumo sair da condição de alerta.</Text></View>
      </>}
      <Text style={styles.caption}>Cada regra possui seu período, com calendário UTC.</Text>
    </ScrollView>
    <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => { if (!formBusy) setEditing(null); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}><SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
          {editing && resource.data && <RuleForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} categories={resource.data.categories} onBusyChange={setFormBusy} onSaved={() => { setEditing(null); resource.reload(); }} onCancel={() => setEditing(null)} />}
        </ScrollView>
      </SafeAreaView></KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}
function RuleEvaluation({ rule }: { rule: SpendingRule }) {
  const limit = rule.avaliacaoAtual?.limiteCalculado ?? rule.valorLimite;
  return <>
    <Text style={styles.caption}>Utilizado: {money(rule.avaliacaoAtual?.valorAtual ?? rule.valorConsumido)}</Text>
    <Text style={styles.caption}>Limite no período: {limit === null ? 'Não calculável' : money(limit)}</Text>
    <Text style={styles.caption}>{rule.percentualConsumido === null ? 'Percentual consumido não calculável' : `${rule.percentualConsumido}% consumido`}{rule.alertaAtivo ? ' · Alerta ativo na avaliação atual' : rule.limiteAtingido ? ' · Limite atingido; regra inativa' : ''}</Text>
    <Text style={styles.caption}>Período UTC: {rule.inicio.slice(0, 10)} a {new Date(new Date(rule.fimExclusivo).getTime() - 1).toISOString().slice(0, 10)}</Text>
  </>;
}
function RuleForm({ initial, categories, onSaved, onCancel, onBusyChange }: { initial?: SpendingRule; categories: CatalogCategory[]; onSaved: () => void; onCancel?: () => void; onBusyChange: (busy: boolean) => void }) {
  const [type, setType] = useState<SpendingRuleInput['tipo']>(initial?.tipo ?? 'LIMITE_DIARIO');
  const [percentage, setPercentage] = useState(initial?.percentualLimite?.toString() ?? '');
  const [base, setBase] = useState<'RENDA_EFETIVADA' | 'RENDA_PLANEJADA'>(initial?.baseCalculo ?? 'RENDA_EFETIVADA');
  const [category, setCategory] = useState(initial?.categoriaId ?? null);
  const [period, setPeriod] = useState<RulePeriod>(initial?.periodo ?? 'DIARIO');
  const [active, setActive] = useState(initial?.ativa ?? true);
  const [channels, setChannels] = useState<RuleChannel[]>(initial ? initial.canais.filter((channel): channel is RuleChannel => channel === 'PUSH') : ['PUSH']);
  const [value, setValue] = useState(initial?.valorLimite ? formatCurrency(decimalToCents(initial.valorLimite)) : '');
  const [validation, setValidation] = useState(''); const mutation = useProfileMutation();
  useEffect(() => { onBusyChange(mutation.busy); return () => onBusyChange(false); }, [mutation.busy, onBusyChange]);
  function channel(name: RuleChannel, checked: boolean) { setChannels(c => checked ? [...new Set([...c, name])] : c.filter(v => v !== name)); }
  function save() {
    const limitCents = parseCurrencyToCents(value);
    const percent = Number(percentage.replace(',', '.'));
    if (!channels.length || (type !== 'LIMITE_DIARIO' && !category) || (type === 'PERCENTUAL_RENDA' ? !percentage.trim() || !Number.isFinite(percent) || percent <= 0 || percent > 999.9999 : !limitCents || limitCents <= 0)) { setValidation('Informe valor ou percentual positivo, categoria quando aplicável e ative os alertas por push.'); return; }
    setValidation(''); void mutation.run(() => saveSpendingRule({ tipo: type, categoriaId: category, periodo: period, limitCents: limitCents ?? 0, percentualLimite: percent, baseCalculo: base, canais: channels, ativa: active }, initial?.id), onSaved);
  }
  return <View style={styles.form} pointerEvents={mutation.busy ? 'none' : 'auto'}>
    <View style={styles.row}><Text style={styles.sectionTitle}>{initial ? 'Editar limite' : 'Novo limite'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar edição de limite" disabled={mutation.busy} onPress={onCancel}><IconX color={colors.textSecondary} /></Pressable></View>
    <Choices label="Tipo de regra" value={type} onChange={setType} options={[{ value: 'LIMITE_DIARIO', label: 'Diário' }, { value: 'LIMITE_CATEGORIA', label: 'Por categoria' }, { value: 'PERCENTUAL_RENDA', label: '% da renda' }]} />
    {type !== 'LIMITE_DIARIO' && <>
      <Text style={styles.label}>Categoria</Text>
      {categories.filter(c => c.active || c.id === initial?.categoriaId).map(c => <Pressable key={c.id} onPress={() => setCategory(c.id)} accessibilityRole="radio" accessibilityState={{ selected: c.id === category }} style={{ paddingVertical: spacing.sm }}><Text style={[styles.caption, { color: c.id === category ? colors.primary : colors.textSecondary }]}>{c.id === category ? '● ' : '○ '}{c.name}</Text></Pressable>)}
      <Choices label="Período" value={period} onChange={setPeriod} options={(['DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL'] as const).map(value => ({ value, label: periods[value] }))} />
    </>}
    {type === 'PERCENTUAL_RENDA' ? <><TextInput accessibilityLabel="Percentual da renda" style={styles.input} value={percentage} onChangeText={setPercentage} keyboardType="decimal-pad" placeholder="Percentual" /><Choices label="Base de renda" value={base} onChange={setBase} options={[{ value: 'RENDA_EFETIVADA', label: 'Efetivada' }, { value: 'RENDA_PLANEJADA', label: 'Efetivada + prevista registrada' }]} /><Text style={styles.caption}>A API calcula o limite usando a renda do período. A renda planejada inclui receitas efetivadas e previstas registradas, sem expandir recorrências futuras.</Text></> : <TextInput accessibilityLabel="Valor do limite" style={styles.input} value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="R$ 0,00" />}
    <View style={styles.row}><Text style={styles.label}>Ativar regra</Text><AppSwitch value={active} onChange={setActive} accessibilityLabel="Ativar regra" /></View>
    <Text style={styles.label}>Notificações</Text>
    <View style={styles.row}><Text style={styles.label}>Push</Text><AppSwitch value={channels.includes('PUSH')} onChange={v => channel('PUSH', v)} accessibilityLabel="Receber alertas por push" /></View>
    {initial && <><Text style={styles.caption}>Avaliação da última consulta da regra salva. Alterações acima serão reavaliadas ao salvar.</Text><RuleEvaluation rule={initial} /></>}
    {!!(validation || mutation.error) && <Text accessibilityRole="alert" style={styles.pending}>{validation || mutation.error}</Text>}
    <Pressable accessibilityRole="button" disabled={mutation.busy} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{mutation.busy ? 'Salvando…' : 'Salvar regra'}</Text></Pressable>
    {onCancel && <Pressable onPress={onCancel}><Text style={styles.caption}>Cancelar</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.border },
  amount: { flexShrink: 1, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textSecondary },
  categoryIcon: { width: 36, height: 36, borderRadius: radius.icon, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryTint },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,32,46,0.4)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.surface },
  sheetContent: { padding: spacing.lg },
  handle: { width: 42, height: 4, borderRadius: radius.pill, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.md },
  form: { gap: spacing.md },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.md },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.md },
  sectionTitle: { marginTop: spacing.sm, fontFamily: fontFamily.bold,
    fontSize: fontSize.title, color: colors.textPrimary },
  card: { padding: spacing.lg, gap: spacing.md, borderWidth: 0.5,
    borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.md },
  flex: { flex: 1 },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  caption: { marginTop: 2, fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  input: { minHeight: 46, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textPrimary, backgroundColor: colors.surface },
  pending: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.warning },
  disabled: { opacity: 0.55 },
  addLimit: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.border, borderRadius: radius.card },
  addTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textSecondary },
  divider: { paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.border },
  saveButton: { minHeight: 50, marginTop: spacing.md, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  saveText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
});
