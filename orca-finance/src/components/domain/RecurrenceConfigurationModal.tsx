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
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatDateInput, parseBrazilianDateToISO } from '@/utils/date';
import type { RecurrenceConfiguration } from '@/types/transaction';

export type { RecurrenceConfiguration } from '@/types/transaction';

interface RecurrenceConfigurationModalProps {
  visible: boolean;
  value: RecurrenceConfiguration;
  onCancel: () => void;
  onSave: (value: RecurrenceConfiguration) => void;
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
}: RecurrenceConfigurationModalProps) {
  const [recurring, setRecurring] = useState(value.recurring);
  const [nextOccurrenceInput, setNextOccurrenceInput] = useState(
    formatISODate(value.nextOccurrence),
  );
  const [reminder, setReminder] = useState(value.reminder);
  const [dueDateInput, setDueDateInput] = useState(formatISODate(value.dueDate));
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!visible) return;

    setRecurring(value.recurring);
    setNextOccurrenceInput(formatISODate(value.nextOccurrence));
    setReminder(value.reminder);
    setDueDateInput(formatISODate(value.dueDate));
    setShowErrors(false);
  }, [value, visible]);

  const nextOccurrence = parseBrazilianDateToISO(nextOccurrenceInput);
  const dueDate = parseBrazilianDateToISO(dueDateInput);

  function handleSave() {
    setShowErrors(true);

    if ((recurring && !nextOccurrence) || (reminder && !dueDate)) return;

    onSave({
      recurring,
      frequency: 'monthly',
      nextOccurrence: recurring ? nextOccurrence : null,
      reminder,
      dueDate: reminder ? dueDate : null,
    });
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Voltar ao cadastro"
            accessibilityRole="button"
            onPress={onCancel}
            style={styles.iconButton}
          >
            <IconArrowLeft size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>Configurar recorrência</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recorrência</Text>
            <View style={styles.body}>
              <View style={styles.switchRow}>
                <Text style={styles.rowTitle}>Transação recorrente</Text>
                <AppSwitch
                  accessibilityLabel="Ativar transação recorrente"
                  value={recurring}
                  onChange={setRecurring}
                />
              </View>

              <View style={[styles.field, !recurring && styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Frequência</Text>
                  <Text style={styles.value}>Mensal</Text>
                </View>
                <IconChevronDown size={22} color={colors.navInactive} />
              </View>

              <View style={[styles.field, !recurring && styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Próxima ocorrência</Text>
                  <TextInput
                    editable={recurring}
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

              <View style={[styles.field, !recurring && styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Data de término</Text>
                  <Text style={styles.value}>Sem data de término</Text>
                </View>
                <IconChevronDown size={22} color={colors.navInactive} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lembrete</Text>
            <View style={styles.body}>
              <View style={styles.switchRow}>
                <Text style={styles.rowTitle}>Lembrete de vencimento</Text>
                <AppSwitch
                  accessibilityLabel="Ativar lembrete de vencimento"
                  value={reminder}
                  onChange={setReminder}
                />
              </View>

              <View style={[styles.field, !reminder && styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Data de vencimento</Text>
                  <TextInput
                    editable={reminder}
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

              <View style={[styles.field, styles.disabled]}>
                <View style={styles.fieldText}>
                  <Text style={styles.label}>Lembrar-me antes</Text>
                  <Text style={styles.value}>Selecionar</Text>
                </View>
                <IconChevronDown size={22} color={colors.navInactive} />
              </View>
            </View>
          </View>

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

        <Pressable
          accessibilityRole="button"
          onPress={handleSave}
          style={styles.saveButton}
        >
          <Text style={styles.saveText}>Salvar configuração</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
