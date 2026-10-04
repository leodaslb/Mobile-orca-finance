
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { paymentLabels, type TransactionFilters } from '@/services/transaction.service';
import { formatDateInput, parseBrazilianDateToISO } from '@/utils/date';
import { centsToDecimal, parseCurrencyToCents } from '@/utils/currency';
import type { PaymentMethod } from '@/types/transaction';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onApply: (filters: TransactionFilters) => void;
  onClear: () => void;
  value: TransactionFilters;
  categories: { id: string; name: string }[];
}

export function TransactionFiltersSheet({ visible, value, categories, onCancel, onApply, onClear }: Props) {
  const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [categoryId, setCategory] = useState<string | undefined>();
  const [paymentMethod, setPayment] = useState<PaymentMethod | undefined>();
  const [amount, setAmount] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    const display = (day?: string) => day ? day.split('-').reverse().join('/') : '';
    setStart(display(value.startDate)); setEnd(display(value.endDate));
    setCategory(value.categoryId); setPayment(value.paymentMethod);
    setAmount(value.amountCents === undefined ? '' : centsToDecimal(value.amountCents).replace('.', ',')); setError('');
  }, [visible, value]);
  function apply() {
    const startDate = start ? parseBrazilianDateToISO(start) : undefined;
    const endDate = end ? parseBrazilianDateToISO(end) : undefined;
    const amountCents = amount ? parseCurrencyToCents(amount) : undefined;
    if (startDate === null || endDate === null || amountCents === null ||
      (startDate && endDate && startDate > endDate) || (amountCents !== undefined && amountCents < 0)) {
      setError('Confira as datas e o valor informado.'); return;
    }
    onApply({ startDate, endDate, categoryId, paymentMethod, amountCents });
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel}
          accessibilityRole="button" accessibilityLabel="Fechar filtros" />
        <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.handle} />
            <Text style={styles.title}>Filtros de transações</Text>
            <Text style={styles.text}>Data</Text>
            <View style={styles.row}>
              <TextInput accessibilityLabel="Data inicial" placeholder="Inicial dd/mm/aaaa" keyboardType="numeric" value={start} onChangeText={v => setStart(formatDateInput(v))} style={styles.input} />
              <TextInput accessibilityLabel="Data final" placeholder="Final dd/mm/aaaa" keyboardType="numeric" value={end} onChangeText={v => setEnd(formatDateInput(v))} style={styles.input} />
            </View>
            <Text style={styles.text}>Categoria</Text>
            <View style={styles.row}>
              {[{ id: '', name: 'Todas' }, ...categories].map(c => <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ selected: (categoryId ?? '') === c.id }} onPress={() => setCategory(c.id || undefined)} style={[styles.chip, (categoryId ?? '') === c.id && styles.selected]}><CategoryIcon name={c.name} size={16} /><Text style={styles.link}>{c.name}</Text></Pressable>)}
            </View>
            <Text style={styles.text}>Valor exato</Text>
            <TextInput accessibilityLabel="Valor exato" placeholder="R$ 0,00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} style={styles.input} />
            <Text style={styles.text}>Método de pagamento</Text>
            <View style={styles.row}>
              <Pressable onPress={() => setPayment(undefined)} style={[styles.chip, !paymentMethod && styles.selected]} accessibilityRole="radio" accessibilityState={{ selected: !paymentMethod }}><Text style={styles.link}>Todos</Text></Pressable>
              {(Object.keys(paymentLabels) as PaymentMethod[]).map(method => <Pressable key={method} onPress={() => setPayment(method)} style={[styles.chip, paymentMethod === method && styles.selected]} accessibilityRole="radio" accessibilityState={{ selected: paymentMethod === method }}><Text style={styles.link}>{paymentLabels[method]}</Text></Pressable>)}
            </View>
            {!!error && <Text accessibilityRole="alert" style={styles.text}>{error}</Text>}
            <Pressable accessibilityRole="button" onPress={apply} style={[styles.button, { backgroundColor: colors.primary }]}>
              <Text style={styles.buttonText}>Aplicar filtros</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              onPress={onClear} style={styles.button}>
              <Text style={styles.text}>Limpar filtros</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: { flexGrow: 1, minHeight: 48, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.regular, color: colors.textPrimary },
  chip: { minHeight: 44, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, justifyContent: 'center' },
  selected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 32, 46, 0.4)' },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  content: { padding: spacing.lg, gap: spacing.lg },
  handle: { width: 60, height: 5, borderRadius: radius.pill, backgroundColor: colors.border, alignSelf: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input },
  disabled: { backgroundColor: colors.primary, opacity: 0.45 },
  buttonText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  link: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary },
});
