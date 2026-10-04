
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getTransactionCatalog } from '@/services/category.service';
import { saveMonthlyBudget } from '@/services/planning.service';
import { formatCurrency, parseCurrencyToCents } from '@/utils/currency';
import { colors, spacing, radius, fontFamily } from '@/theme';
export function BudgetSheet({ period, initial, onClose, onSaved }: { period: string; initial: { categoryId: string; limitCents: number }[]; onClose: () => void; onSaved: () => void }) {
  const resource = useProfileResource(useCallback(() => getTransactionCatalog(), []));
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(initial.map(c => [c.categoryId, formatCurrency(c.limitCents)])));
  const [validation, setValidation] = useState(''); const mutation = useProfileMutation();
  function save() {
    const rows = Object.entries(values).filter(([, value]) => value.trim());
    if (!rows.length || rows.some(([, value]) => (parseCurrencyToCents(value) ?? 0) <= 0)) { setValidation('Informe ao menos uma categoria com valor positivo. Campos vazios retiram a categoria do orçamento.'); return; }
    setValidation(''); void mutation.run(() => saveMonthlyBudget(period, rows.map(([categoryId, value]) => ({ categoryId, limitCents: parseCurrencyToCents(value)! }))), onSaved);
  }
  const close = () => { if (!mutation.busy) onClose(); };
  return <Modal visible transparent animationType="slide" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,32,46,0.35)' }}>
      <SafeAreaView edges={['bottom']} style={{ maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: spacing.lg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
          <Text style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }}>Orçamento mensal · {period}</Text>
          <Text style={{ color: colors.textSecondary }}>Informe valores nas categorias desejadas. Campo vazio retira a categoria.</Text>
          <Text style={{ color: colors.textSecondary }}>Assinaturas e serviços digitais entram no limite da categoria escolhida. Para identificá-los, crie subcategorias em Categorias.</Text>
          {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
          {resource.data && !resource.data.categories.length && <Text style={{ color: colors.textSecondary }}>Nenhuma categoria disponível para definir o orçamento. Tente novamente mais tarde.</Text>}
          {resource.data?.categories.filter(c => c.active || initial.some(i => i.categoryId === c.id)).map(c => <View key={c.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}><CategoryIcon name={c.name} /><Text style={{ color: colors.textPrimary }}>{c.name}</Text></View>
            <TextInput editable={!mutation.busy} accessibilityLabel={`Orçamento de ${c.name}`} value={values[c.id] ?? ''} onChangeText={value => setValues(v => ({ ...v, [c.id]: value }))} keyboardType="decimal-pad" placeholder="R$ 0,00" style={{ minHeight: 48, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, color: colors.textPrimary }} />
          </View>)}
          {!!(validation || mutation.error) && <Text accessibilityRole="alert" style={{ color: colors.negative }}>{validation || mutation.error}</Text>}
          <Pressable disabled={mutation.busy || !resource.data?.categories.length} onPress={save} style={{ padding: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.input }}><Text style={{ color: colors.surface, textAlign: 'center' }}>{mutation.busy ? 'Salvando…' : 'Salvar orçamento'}</Text></Pressable>
          <Pressable disabled={mutation.busy} onPress={close} style={{ padding: spacing.md }}><Text style={{ color: colors.primary, textAlign: 'center' }}>Cancelar</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
