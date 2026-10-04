import { IconChevronLeft, IconPlus, IconPencil, IconBell, IconX } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSwitch } from '@/components/common/AppSwitch';
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
        <View style={styles.flex}><Text style={styles.label}>{resource.data?.categories.find(c => c.id === rule.categoriaId)?.name ?? 'Limite diário'}</Text><Text style={styles.caption}>{periods[rule.periodo]} · {rule.ativa ? 'Ativo' : 'Inativo'} · {rule.canais.map(c => c === 'EMAIL' ? 'E-mail' : 'Push').join(' e ')}</Text><Text style={styles.caption}>Utilizado: {formatCurrency(decimalToCents(rule.valorConsumido))}{rule.alertaAtivo ? ' · Limite atingido' : ''}</Text></View>
        <Text style={styles.amount}>{rule.valorLimite ? formatCurrency(decimalToCents(rule.valorLimite)) : '—'}</Text><IconPencil size={20} color={colors.textSecondary} />
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
        {resource.data.rules.filter(rule => rule.tipo === 'PERCENTUAL_RENDA').map(rule => <View key={rule.id} style={styles.card}><Text style={styles.label}>Regra percentual de renda existente</Text><Text style={styles.caption}>{rule.ativa ? 'Ativo' : 'Inativo'} · edição indisponível no contrato atual.</Text></View>)}
        <Pressable style={styles.addLimit} onPress={() => setEditing('new')} accessibilityRole="button" accessibilityLabel="Adicionar limite"><IconPlus color={colors.primary} /><Text style={styles.label}>Adicionar limite</Text></Pressable>
        <View style={styles.card}><Text style={styles.sectionTitle}>Receber alertas por</Text><Text style={styles.caption}>Push e e-mail são configurados ao editar cada limite. A entrega de notificações ainda não está disponível.</Text></View>
      </>}
      <Text style={styles.caption}>Limites por percentual de renda ainda não estão disponíveis. Cada período utiliza o calendário UTC.</Text>
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
function RuleForm({ initial, categories, onSaved, onCancel, onBusyChange }: { initial?: SpendingRule; categories: CatalogCategory[]; onSaved: () => void; onCancel?: () => void; onBusyChange: (busy: boolean) => void }) {
  const [type, setType] = useState<SpendingRuleInput['tipo']>(initial?.tipo === 'LIMITE_CATEGORIA' ? 'LIMITE_CATEGORIA' : 'LIMITE_DIARIO');
  const [category, setCategory] = useState(initial?.categoriaId ?? null);
  const [period, setPeriod] = useState<RulePeriod>(initial?.periodo ?? 'DIARIO');
  const [active, setActive] = useState(initial?.ativa ?? true);
  const [channels, setChannels] = useState<RuleChannel[]>(initial?.canais ?? []);
  const [value, setValue] = useState(initial?.valorLimite ? formatCurrency(decimalToCents(initial.valorLimite)) : '');
  const [validation, setValidation] = useState(''); const mutation = useProfileMutation();
  useEffect(() => { onBusyChange(mutation.busy); return () => onBusyChange(false); }, [mutation.busy, onBusyChange]);
  function channel(name: RuleChannel, checked: boolean) { setChannels(c => checked ? [...new Set([...c, name])] : c.filter(v => v !== name)); }
  function save() {
    const limitCents = parseCurrencyToCents(value);
    if (!limitCents || limitCents <= 0 || !channels.length || (type === 'LIMITE_CATEGORIA' && !category)) { setValidation('Informe limite positivo, categoria quando aplicável e ao menos um canal.'); return; }
    setValidation(''); void mutation.run(() => saveSpendingRule({ tipo: type, categoriaId: category, periodo: period, limitCents, canais: channels, ativa: active }, initial?.id), onSaved);
  }
  if (initial?.tipo === 'PERCENTUAL_RENDA') return <View style={styles.card}><Text style={styles.pending}>Regra percentual existente: edição indisponível no contrato atual.</Text></View>;
  return <View style={styles.form} pointerEvents={mutation.busy ? 'none' : 'auto'}>
    <View style={styles.row}><Text style={styles.sectionTitle}>{initial ? 'Editar limite' : 'Novo limite'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar edição de limite" disabled={mutation.busy} onPress={onCancel}><IconX color={colors.textSecondary} /></Pressable></View>
    <View style={styles.row}>{(['LIMITE_DIARIO', 'LIMITE_CATEGORIA'] as const).map(v => <Pressable key={v} accessibilityRole="radio" accessibilityState={{ selected: type === v }} onPress={() => setType(v)}><Text style={[styles.label, { color: type === v ? colors.primary : colors.textSecondary }]}>{v === 'LIMITE_DIARIO' ? 'Diário' : 'Por categoria'}</Text></Pressable>)}</View>
    {type === 'LIMITE_CATEGORIA' && <>
      <Text style={styles.label}>Categoria</Text>
      {categories.filter(c => c.active || c.id === initial?.categoriaId).map(c => <Pressable key={c.id} onPress={() => setCategory(c.id)} accessibilityRole="radio" accessibilityState={{ selected: c.id === category }} style={{ paddingVertical: spacing.sm }}><Text style={[styles.caption, { color: c.id === category ? colors.primary : colors.textSecondary }]}>{c.id === category ? '● ' : '○ '}{c.name}</Text></Pressable>)}
      <Text style={styles.label}>Período</Text><View style={styles.row}>{(['DIARIO','SEMANAL','MENSAL','ANUAL'] as const).map(v => <Pressable key={v} onPress={() => setPeriod(v)} accessibilityRole="radio" accessibilityState={{ selected: period === v }}><Text style={[styles.caption, { color: period === v ? colors.primary : colors.textSecondary }]}>{({ DIARIO: 'Diário', SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual' })[v]}</Text></Pressable>)}</View>
    </>}
    <TextInput accessibilityLabel="Valor do limite" style={styles.input} value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="R$ 0,00" />
    <View style={styles.row}><Text style={styles.label}>Ativar regra</Text><AppSwitch value={active} onChange={setActive} accessibilityLabel="Ativar regra" /></View>
    <Text style={styles.label}>Receber alertas por</Text>
    <View style={styles.row}><Text style={styles.label}>Push</Text><AppSwitch value={channels.includes('PUSH')} onChange={v => channel('PUSH', v)} accessibilityLabel="Receber alertas por push" /></View>
    <View style={styles.row}><Text style={styles.label}>E-mail</Text><AppSwitch value={channels.includes('EMAIL')} onChange={v => channel('EMAIL', v)} accessibilityLabel="Receber alertas por e-mail" /></View>
    {initial && <Text style={styles.caption}>Utilizado: {formatCurrency(decimalToCents(initial.valorConsumido))} · {initial.percentualConsumido ?? '—'}%{initial.alertaAtivo ? ' · Limite atingido' : ''}</Text>}
    {!!(validation || mutation.error) && <Text accessibilityRole="alert" style={styles.pending}>{validation || mutation.error}</Text>}
    <Pressable disabled={mutation.busy} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{mutation.busy ? 'Salvando…' : 'Salvar regra'}</Text></Pressable>
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
