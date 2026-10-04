import { IconChevronDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react-native';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { shiftMonth } from '@/utils/date';
const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export function MonthSelector({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value.slice(0, 4));
  function move(offset: number) { try { onChange(shiftMonth(value, offset)); } catch { /* limite do calendário */ } }
  const validYear = /^\d{4}$/.test(year) && Number(year) > 0;
  return <View style={styles.row}>
    <Pressable accessibilityRole="button" onPress={() => move(-1)} accessibilityLabel="Mês anterior" style={styles.button}><IconChevronLeft size={20} color={colors.primary} /></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { setYear(value.slice(0,4)); setOpen(true); }} accessibilityLabel="Selecionar período" style={styles.period}><Text style={styles.text}>{months[Number(value.slice(5)) - 1]} {value.slice(0,4)}</Text><IconChevronDown size={17} color={colors.textSecondary} /></Pressable>
    <Pressable accessibilityRole="button" onPress={() => move(1)} accessibilityLabel="Próximo mês" style={styles.button}><IconChevronRight size={20} color={colors.primary} /></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.overlay}><View style={styles.modal}>
      <Text style={styles.title}>Selecionar período</Text><TextInput accessibilityLabel="Ano do período" keyboardType="number-pad" maxLength={4} value={year} onChangeText={setYear} style={styles.year} />
      <View style={styles.months}>{months.map((month, index) => <Pressable key={month} accessibilityRole="button" disabled={!validYear} onPress={() => { onChange(`${year}-${String(index + 1).padStart(2,'0')}`); setOpen(false); }} style={[styles.month, value === `${year}-${String(index+1).padStart(2,'0')}` && styles.selected]}><Text style={styles.text}>{month.slice(0,3)}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" style={styles.cancel} onPress={() => setOpen(false)}><Text style={styles.text}>Cancelar</Text></Pressable>
    </View></View></Modal>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  period: { flexDirection: 'row', minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  text: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  overlay: { flex: 1, padding: spacing.lg, justifyContent: 'center', backgroundColor: 'rgba(16,32,46,0.4)' },
  modal: { padding: spacing.lg, borderRadius: radius.sheet, backgroundColor: colors.surface, gap: spacing.md },
  year: { minHeight: 44, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.medium, color: colors.textPrimary },
  months: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  month: { width: '30%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input, borderWidth: 0.5, borderColor: colors.border },
  selected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
