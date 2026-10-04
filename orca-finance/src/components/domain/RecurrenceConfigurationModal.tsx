import {
  IconArrowLeft,
  IconCalendar,
  IconChevronDown,
  IconInfoCircle,
} from '@tabler/icons-react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSwitch } from '@/components/common/AppSwitch';
import { recurrenceLabels } from '@/services/recurrence.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatDateInput, isValidTime, parseBrazilianDateToISO } from '@/utils/date';
import { formatCurrency, parseCurrencyToCents } from '@/utils/currency';
import type { RecurrenceConfiguration } from '@/types/transaction';

export type { RecurrenceConfiguration } from '@/types/transaction';

interface RecurrenceConfigurationModalProps {
  visible: boolean;
  value: RecurrenceConfiguration;
  onCancel: () => void;
  onSave: (value: RecurrenceConfiguration) => void;
  remindersAvailable?: boolean;
  busy?: boolean;
  error?: string;
}

function formatISODate(value: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function RecurrenceConfigurationModal({
  visible,
  value,
  onCancel,
  onSave,
  remindersAvailable = true, busy = false, error,
}: RecurrenceConfigurationModalProps) {
  const [recurring, setRecurring] = useState(value.recurring);
  const [frequency, setFrequency] = useState(value.frequency);
  const [endEnabled, setEndEnabled] = useState(!!value.endDate);
  const [endInput, setEndInput] = useState(formatISODate(value.endDate ?? null));
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [nextOccurrenceInput, setNextOccurrenceInput] = useState(
    formatISODate(value.nextOccurrence),
  );
  const [reminder, setReminder] = useState(value.reminder);
  const [dueDateInput, setDueDateInput] = useState(formatISODate(value.dueDate));
  const [reminderTime, setReminderTime] = useState(value.reminderTime ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [description, setDescription] = useState(value.description ?? '');
  const [amount, setAmount] = useState(value.amountCents === undefined ? '' : formatCurrency(value.amountCents));

  useEffect(() => {
    if (!visible) return;

    setRecurring(value.recurring);
    setFrequency(value.frequency); setEndEnabled(!!value.endDate); setEndInput(formatISODate(value.endDate ?? null)); setFrequencyOpen(false);
    setNextOccurrenceInput(formatISODate(value.nextOccurrence));
    setReminder(value.reminder);
    setDueDateInput(formatISODate(value.dueDate));
    setReminderTime(value.reminderTime ?? '');
    setShowErrors(false);
    setDescription(value.description ?? ''); setAmount(value.amountCents === undefined ? '' : formatCurrency(value.amountCents));
  }, [value, visible]);

  const nextOccurrence = parseBrazilianDateToISO(nextOccurrenceInput);
  const dueDate = parseBrazilianDateToISO(dueDateInput);
  const endDate = endEnabled ? parseBrazilianDateToISO(endInput) : null;

  function handleSave() {
    setShowErrors(true);
    const amountCents = parseCurrencyToCents(amount);
    if (value.description !== undefined && (!description.trim() || !amountCents || amountCents <= 0)) return;

    if (busy || (recurring && (!nextOccurrence || (endEnabled && (!endDate || endDate < nextOccurrence)))) || (reminder && (!dueDate || !isValidTime(reminderTime)))) return;

    onSave({
      recurring,
      frequency,
      nextOccurrence: recurring ? nextOccurrence : null,
      endDate,
      ...(value.description !== undefined && { description: description.trim(), amountCents: amountCents! }),
      reminder,
      dueDate: reminder ? dueDate : null,
      reminderTime: reminder ? reminderTime : null,
    });
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => { if (!busy) onCancel(); }}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Voltar ao cadastro"
            accessibilityRole="button"
            disabled={busy} onPress={onCancel}
            style={styles.iconButton}
          >
            <IconArrowLeft size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>Configurar recorrência</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
          {value.description !== undefined && <View style={styles.card}>
            <Text style={styles.cardTitle}>Próximas ocorrências</Text>
            <TextInput accessibilityLabel="Descrição da recorrência" editable={!busy} value={description} onChangeText={setDescription} style={styles.field} />
            <TextInput accessibilityLabel="Valor da recorrência" editable={!busy} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.field} />
            {showErrors && (!description.trim() || !parseCurrencyToCents(amount) || parseCurrencyToCents(amount)! <= 0) && <Text accessibilityRole="alert" style={styles.error}>Informe descrição e valor positivo.</Text>}
          </View>}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recorrência</Text>
            <View style={styles.body}>
              <View style={styles.switchRow}>
                <Text style={styles.rowTitle}>Transação recorrente</Text>
                <AppSwitch
                  accessibilityLabel="Ativar transação recorrente"
                  disabled={busy}
                  value={recurring}
                  onChange={setRecurring}
                />
              </View>

              <Pressable accessibilityRole="button" accessibilityLabel="Selecionar frequência" disabled={!recurring || busy} onPress={() => setFrequencyOpen(v => !v)} style={[styles.field, !recurring && styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Frequência</Text>
                  <Text style={styles.value}>{recurrenceLabels[frequency]}</Text>
                </View>
                <IconChevronDown size={22} color={colors.navInactive} />
              </Pressable>
              {frequencyOpen && recurring && <View style={styles.frequencyOptions}>{(Object.keys(recurrenceLabels) as (keyof typeof recurrenceLabels)[]).map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: option === frequency }} onPress={() => { setFrequency(option); setFrequencyOpen(false); }} style={styles.frequencyOption}><Text style={[styles.value, option === frequency && { color: colors.primary }]}>{recurrenceLabels[option]}</Text></Pressable>)}</View>}

              <View style={[styles.field, !recurring && styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Próxima ocorrência</Text>
                  <TextInput
                    editable={recurring && !busy}
                    accessibilityLabel="Próxima ocorrência"
                    keyboardType="numeric"
                    maxLength={10}
                    onChangeText={(text) =>
                      setNextOccurrenceInput(formatDateInput(text))
                    }
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={colors.navInactive}
                    style={styles.input}
                    value={nextOccurrenceInput}
                  />
                </View>
                <IconCalendar size={23} color={colors.textSecondary} />
              </View>
              {showErrors && recurring && !nextOccurrence && (
                <Text style={styles.error}>Informe a próxima ocorrência.</Text>
              )}

              <View style={styles.switchRow}><Text style={styles.rowTitle}>Definir data de término</Text><AppSwitch disabled={!recurring || busy} value={endEnabled} onChange={setEndEnabled} accessibilityLabel="Definir data de término" /></View>
              {endEnabled ? <View style={styles.field}><View style={styles.fieldText}><Text style={styles.label}>Data de término</Text><TextInput accessibilityLabel="Data de término" editable={recurring && !busy} keyboardType="numeric" maxLength={10} placeholder="dd/mm/aaaa" value={endInput} onChangeText={text => setEndInput(formatDateInput(text))} style={styles.input} /></View><IconCalendar size={23} color={colors.textSecondary} /></View> : <Text style={styles.label}>Sem data de término</Text>}
              {showErrors && recurring && endEnabled && (!endDate || (!!nextOccurrence && endDate < nextOccurrence)) && <Text accessibilityRole="alert" style={styles.error}>O término deve ser uma data válida a partir da próxima ocorrência.</Text>}
            </View>
          </View>

          {remindersAvailable && <View style={styles.card}>
            <Text style={styles.cardTitle}>Lembrete</Text>
            <View style={styles.body}>
              <View style={styles.switchRow}>
                <Text style={styles.rowTitle}>Lembrete de vencimento</Text>
                <AppSwitch
                  accessibilityLabel="Ativar lembrete de vencimento"
                  disabled={busy}
                  value={reminder}
                  onChange={setReminder}
                />
              </View>

              <View style={[styles.field, !reminder && styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Data de vencimento</Text>
                  <TextInput
                    editable={reminder && !busy}
                    accessibilityLabel="Data de vencimento"
                    keyboardType="numeric"
                    maxLength={10}
                    onChangeText={(text) => setDueDateInput(formatDateInput(text))}
                    placeholder="dd/mm/aaaa"
                    placeholderTextColor={colors.navInactive}
                    style={styles.input}
                    value={dueDateInput}
                  />
                </View>
                <IconCalendar size={23} color={colors.textSecondary} />
              </View>
              {showErrors && reminder && !dueDate && (
                <Text style={styles.error}>Informe a data de vencimento.</Text>
              )}

              <View style={[styles.field, !reminder && styles.disabled]}>
                <View style={styles.fieldText}><Text style={styles.label}>Horário do lembrete (local)</Text>
                  <TextInput editable={reminder} value={reminderTime} onChangeText={setReminderTime} placeholder="hh:mm" maxLength={5} style={styles.input} />
                </View>
              </View>
              {showErrors && reminder && !isValidTime(reminderTime) && <Text style={styles.error}>Informe um horário válido.</Text>}
            </View>
          </View>}
          <View style={styles.infoCard}>
            <IconInfoCircle size={24} color={colors.textSecondary} />
            <View style={styles.fieldText}>
              <Text style={styles.infoTitle}>
                Esta transação será lançada automaticamente nas datas configuradas.
              </Text>
              <Text style={styles.infoText}>
                Ocorrências futuras não afetam o saldo atual antes da data prevista.
              </Text>
            </View>
          </View>
        </ScrollView>

        {!!error && <Text accessibilityRole="alert" style={[styles.error, { padding: spacing.md }]}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={handleSave}
          style={styles.saveButton}
        >
          <Text style={styles.saveText}>{busy ? 'Salvando…' : 'Salvar configuração'}</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frequencyOptions: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.input, overflow: 'hidden' },
  frequencyOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: fontSize.title,
    color: colors.textPrimary,
  },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.lg },
  card: {
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    padding: spacing.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.title,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  body: { padding: spacing.md, gap: spacing.md },
  switchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  field: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  fieldText: { flex: 1 },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textSecondary },
  value: { marginTop: 3, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  input: { minHeight: 34, paddingVertical: 0, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  disabled: { opacity: 0.5 },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.negative },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  infoTitle: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  infoText: { marginTop: spacing.sm, fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textSecondary },
  saveButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.input,
    backgroundColor: colors.primary,
  },
  saveText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
});
