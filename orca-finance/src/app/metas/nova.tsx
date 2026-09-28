import {
  IconCalendar,
  IconChevronLeft,
  IconPigMoney,
  IconSun,
} from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  calculateGoalSuggestion,
  createGoal,
} from '@/services/goal.service';
import type { GoalSuggestionFrequency } from '@/types';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency, parseCurrencyToCents } from '@/utils/currency';
import { formatDateInput, parseBrazilianDateToISO } from '@/utils/date';

export default function NewGoalScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [frequency, setFrequency] = useState<GoalSuggestionFrequency>('daily');
  const parsedTarget = parseCurrencyToCents(target);
  const parsedDeadline = parseBrazilianDateToISO(deadline);
  const suggestion = useMemo(() => parsedTarget && parsedDeadline
    ? calculateGoalSuggestion({
      targetCents: parsedTarget,
      currentCents: 0,
      deadline: parsedDeadline,
      frequency,
    })
    : null, [frequency, parsedDeadline, parsedTarget]);
  const goBack = () => router.canGoBack()
    ? router.back()
    : router.replace('/metas');

  const submit = () => {
    if (!parsedTarget || !parsedDeadline) {
      Alert.alert('Revise a meta', 'Informe valor-alvo e data-limite válidos.');
      return;
    }
    try {
      const goal = createGoal({
        name,
        targetCents: parsedTarget,
        deadline: parsedDeadline,
        suggestionFrequency: frequency,
      });
      router.replace({ pathname: '/metas/[id]', params: { id: goal.id } });
    } catch (error) {
      Alert.alert('Não foi possível criar',
        error instanceof Error ? error.message : 'Tente novamente.');
    }
  };

  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.headerButton}
          accessibilityRole="button" accessibilityLabel="Voltar">
          <IconChevronLeft size={25} color={colors.navInactive} />
        </Pressable>
        <Text style={styles.title}>Nova meta</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nome da meta</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Ex.: Viagem"
          placeholderTextColor={colors.navInactive} style={styles.input} />
        <Text style={styles.label}>Valor alvo</Text>
        <TextInput value={target} onChangeText={setTarget} placeholder="R$ 0,00"
          placeholderTextColor={colors.navInactive} keyboardType="decimal-pad"
          style={styles.input} />
        <Text style={styles.label}>Data limite</Text>
        <View style={styles.inputWithIcon}>
          <IconCalendar size={22} color={colors.navInactive} />
          <TextInput value={deadline} onChangeText={(text) => setDeadline(formatDateInput(text))}
            placeholder="DD/MM/AAAA" placeholderTextColor={colors.navInactive}
            keyboardType="number-pad" maxLength={10} style={styles.iconInput} />
        </View>
        <View>
          <Text style={styles.label}>Frequência da sugestão</Text>
          <Text style={styles.helper}>Como você quer ver a sugestão de economia?</Text>
        </View>
        <View style={styles.frequencyRow}>
          <FrequencyButton label="Diária" selected={frequency === 'daily'}
            icon={<IconSun size={22} color={frequency === 'daily'
              ? colors.primary : colors.textSecondary} />}
            onPress={() => setFrequency('daily')} />
          <FrequencyButton label="Semanal" selected={frequency === 'weekly'}
            icon={<IconCalendar size={22} color={frequency === 'weekly'
              ? colors.primary : colors.textSecondary} />}
            onPress={() => setFrequency('weekly')} />
        </View>
        <View style={styles.suggestionCard}>
          <View style={styles.suggestionIcon}>
            <IconPigMoney size={25} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.suggestionTitle}>Sugestão de economia</Text>
            <Text style={styles.suggestionValue}>
              {suggestion === null
                ? 'Preencha valor e data'
                : `${formatCurrency(suggestion)} por ${
                  frequency === 'daily' ? 'dia' : 'semana'
                }`}
            </Text>
            <Text style={styles.helper}>Calculada pelo valor restante e pela data limite.</Text>
          </View>
        </View>
        <Pressable onPress={submit} style={styles.primaryButton} accessibilityRole="button">
          <Text style={styles.primaryText}>Criar meta</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function FrequencyButton(props: {
  label: string; selected: boolean; icon: React.ReactNode; onPress: () => void;
}) {
  return <Pressable onPress={props.onPress} accessibilityRole="radio"
    accessibilityState={{ selected: props.selected }}
    style={[styles.frequencyButton, props.selected && styles.frequencySelected]}>
    {props.icon}
    <Text style={[styles.frequencyText, props.selected && styles.frequencyTextSelected]}>
      {props.label}
    </Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.md },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.medium, fontSize: 20, color: colors.textPrimary },
  content: { padding: 20, paddingBottom: 32, gap: spacing.md },
  label: { marginTop: spacing.sm, fontFamily: fontFamily.bold,
    fontSize: fontSize.body, color: colors.textPrimary },
  helper: { marginTop: 2, fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  input: { minHeight: 52, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textPrimary, backgroundColor: colors.surface },
  inputWithIcon: { minHeight: 52, flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.input, backgroundColor: colors.surface },
  iconInput: { flex: 1, minHeight: 50, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textPrimary },
  frequencyRow: { flexDirection: 'row', gap: spacing.md },
  frequencyButton: { flex: 1, minHeight: 52, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    backgroundColor: colors.surface },
  frequencySelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  frequencyText: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textPrimary },
  frequencyTextSelected: { color: colors.primary },
  suggestionCard: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.lg,
    padding: 20, borderRadius: radius.card, backgroundColor: colors.primaryTint },
  suggestionIcon: { width: 44, height: 44, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.icon, backgroundColor: colors.surface },
  suggestionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body,
    color: colors.textPrimary },
  suggestionValue: { marginTop: spacing.xs, fontFamily: fontFamily.bold,
    fontSize: 20, color: colors.primary },
  primaryButton: { minHeight: 52, marginTop: 24, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  primaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.surface },
});
