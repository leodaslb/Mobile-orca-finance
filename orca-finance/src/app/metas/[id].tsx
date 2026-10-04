import {
  IconCalendar,
  IconChevronLeft,
  IconPigMoney,
  IconTargetArrow,
  IconX,
} from '@tabler/icons-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { useAppSession } from '@/contexts/AppSessionContext';
import { localDate } from '@/utils/date';
import { AppCard } from '@/components/common/AppCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import {
  addGoalContribution,
  getGoalDetail,
  updateGoalDeadline,
} from '@/services/goal.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency, parseCurrencyToCents } from '@/utils/currency';
import { formatDateInput, formatTransactionDate, parseBrazilianDateToISO } from '@/utils/date';

function isoToBrazilian(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeProfileId } = useAppSession();
  const resource = useProfileResource(useCallback(() => getGoalDetail(id ?? ''), [id]));
  const goal = resource.data?.goal;
  const [contributionOpen, setContributionOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  const mutation = useProfileMutation();
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/metas');

  if (!goal) {
    return <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.headerButton}>
          <IconChevronLeft size={25} color={colors.navInactive} />
        </Pressable>
        <Text style={styles.title}>Detalhes da meta</Text>
        <View style={styles.headerButton} />
      </View>
      <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={goBack} style={styles.headerButton}
        accessibilityRole="button" accessibilityLabel="Voltar">
        <IconChevronLeft size={25} color={colors.primary} />
      </Pressable>
      <Text style={styles.title}>Detalhes da meta</Text>
      <View style={styles.headerButton} />
    </View>
    <ScrollView refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.reload} />} contentContainerStyle={styles.content}>
      {!!resource.error && <AsyncState error={resource.error} onRetry={resource.reload} />}
      <AppCard style={styles.goalCard}>
        <View style={styles.goalTop}>
          <View style={styles.goalIcon}>
            <IconTargetArrow size={36} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.goalName}>{goal.name}</Text>
            <Text style={styles.current}>{formatCurrency(goal.currentCents)}</Text>
            <Text style={styles.target}>de {formatCurrency(goal.targetCents)}</Text>
            <Text style={styles.target}>{goal.achieved ? 'Meta atingida' : `Restante: ${formatCurrency(goal.remainingCents)}`}</Text>
          </View>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.flex}>
            <ProgressBar progress={goal.progress}
              accessibilityLabel={`Progresso da meta ${goal.name}`} />
          </View>
          <Text style={styles.percentage}>{Math.round(goal.progress * 100)}%</Text>
        </View>
        <View style={styles.deadline}>
          <IconCalendar size={24} color={colors.navInactive} />
          <View>
            <Text style={styles.metaLabel}>Data limite</Text>
            <Text style={styles.metaValue}>{formatTransactionDate(goal.deadline)}</Text>
          </View>
        </View>
      </AppCard>
      <AppCard style={styles.suggestionCard}>
        <View style={styles.suggestionIcon}>
          <IconPigMoney size={27} color={colors.positive} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.suggestionTitle}>
            {goal.suggestionCents === null
              ? 'Sugestão indisponível'
              : `Economize ${formatCurrency(goal.suggestionCents)} por ${
                goal.suggestionFrequency === 'daily' ? 'dia' : 'semana'
              }`}
          </Text>
          <Text style={styles.target}>Para atingir sua meta até a data limite.</Text>
        </View>
      </AppCard>
      {goal.isExpired && <AppCard style={styles.expiredCard}>
        <Text style={styles.expiredTitle}>Meta não cumprida no prazo</Text>
        <Text style={styles.target}>Faltaram {formatCurrency(goal.remainingCents)} para atingir o objetivo.</Text>
        <Pressable accessibilityRole="button" style={styles.deadlineButton}
          onPress={() => { setNewDeadline(isoToBrazilian(goal.deadline)); setDeadlineOpen(true); }}>
          <Text style={styles.deadlineButtonText}>Alterar data-limite</Text>
        </Pressable>
      </AppCard>}
      <AppCard>
        <Text style={styles.sectionTitle}>Histórico de aportes</Text>
        {!resource.data?.contributions.length && <Text style={styles.target}>Nenhum aporte registrado. Registre o primeiro para acompanhar sua meta.</Text>}
        {resource.data?.contributions.map(item => <View key={item.id} style={styles.historyRow}>
          <IconPigMoney size={22} color={colors.positive} />
          <View style={styles.flex}>
            <Text style={styles.metaValue}>{formatCurrency(item.amountCents)}</Text>
            <Text style={styles.target}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.timestamp))}</Text>
          </View>
        </View>)}
      </AppCard>
      <Pressable onPress={() => router.push({ pathname: '/metas/nova', params: { editId: goal.id } })} style={styles.deadlineButton}><Text style={styles.deadlineButtonText}>Editar meta</Text></Pressable>
      <Pressable onPress={() => setContributionOpen(true)}
        style={styles.primaryButton} accessibilityRole="button">
        <Text style={styles.primaryText}>Registrar aporte</Text>
      </Pressable>
    </ScrollView>
    <ContributionSheet key={`${activeProfileId}:${goal.id}`} visible={contributionOpen} goalId={goal.id}
      onClose={() => setContributionOpen(false)}
      onSaved={() => {
        setContributionOpen(false);
        resource.reload();
      }} />
    <Modal visible={deadlineOpen} transparent animationType="slide" onRequestClose={() => { if (!mutation.busy) setDeadlineOpen(false); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={() => { if (!mutation.busy) setDeadlineOpen(false); }} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sectionTitle}>Alterar data-limite</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => { if (!mutation.busy) setDeadlineOpen(false); }}>
              <IconX size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          {!!mutation.error && <Text accessibilityRole="alert" style={styles.target}>{mutation.error}</Text>}
          <Text style={styles.target}>Seus aportes serão preservados. A sugestão será recalculada.</Text>
          <TextInput style={styles.input} value={newDeadline} onChangeText={(text) => setNewDeadline(formatDateInput(text))}
            keyboardType="number-pad" maxLength={10} placeholder="dd/mm/aaaa" placeholderTextColor={colors.navInactive} />
          <Pressable accessibilityRole="button" style={styles.primaryButton} disabled={mutation.busy} onPress={() => {
            const date = parseBrazilianDateToISO(newDeadline);
            if (!date) { Alert.alert('Data inválida', 'Informe uma data válida.'); return; }
            void mutation.run(() => updateGoalDeadline(goal.id, date), () => { setDeadlineOpen(false); resource.reload(); });
          }}><Text style={styles.primaryText}>{mutation.busy ? 'Salvando…' : 'Salvar nova data'}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

function ContributionSheet(props: {
  visible: boolean; goalId: string; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(isoToBrazilian(localDate()));
  const mutation = useProfileMutation();
  const close = () => { if (!mutation.busy) props.onClose(); };
  const submit = () => {
    const amountCents = parseCurrencyToCents(amount);
    const isoDate = parseBrazilianDateToISO(date);
    if (!amountCents || !isoDate) {
      Alert.alert('Revise o aporte', 'Informe valor e data válidos.');
      return;
    }
    if (amountCents <= 0) { Alert.alert('Revise o aporte', 'Informe valor positivo.'); return; }
    void mutation.run(() => addGoalContribution({ goalId: props.goalId, amountCents, date: isoDate }), () => {
      setAmount(''); props.onSaved();
    });
  };
  return <Modal visible={props.visible} transparent animationType="slide"
    onRequestClose={close}>
    <KeyboardAvoidingView style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sectionTitle}>Registrar aporte</Text>
          <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Fechar aporte">
            <IconX size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        {!!mutation.error && <Text accessibilityRole="alert" style={styles.target}>{mutation.error}</Text>}
        <Text style={styles.inputLabel}>Valor</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
          placeholder="R$ 0,00" placeholderTextColor={colors.navInactive}
          style={styles.input} />
        <Text style={styles.inputLabel}>Data</Text>
        <TextInput value={date} onChangeText={(text) => setDate(formatDateInput(text))} keyboardType="number-pad"
          maxLength={10} style={styles.input} />
        <Pressable disabled={mutation.busy} onPress={submit} style={styles.primaryButton} accessibilityRole="button">
          <Text style={styles.primaryText}>{mutation.busy ? 'Registrando…' : 'Confirmar aporte'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.md },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.textPrimary },
  notFound: { padding: 20, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.lg },
  goalCard: { gap: spacing.lg, padding: 20 },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  goalIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  flex: { flex: 1 },
  goalName: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.textPrimary },
  current: { marginTop: spacing.xs, fontFamily: fontFamily.bold,
    fontSize: 26, color: colors.textPrimary },
  target: { fontFamily: fontFamily.regular, fontSize: fontSize.body,
    color: colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  percentage: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.primary },
  deadline: { paddingTop: spacing.lg, flexDirection: 'row', alignItems: 'center',
    gap: spacing.lg, borderTopWidth: 0.5, borderTopColor: colors.border },
  metaLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.caption,
    color: colors.textSecondary },
  metaValue: { marginTop: 2, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textPrimary },
  suggestionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  suggestionIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.positiveTint },
  suggestionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title,
    color: colors.textPrimary },
  expiredCard: { gap: spacing.md, borderColor: colors.warning },
  expiredTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.warning },
  deadlineButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.input },
  deadlineButtonText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title,
    color: colors.textPrimary },
  contributionsCard: { paddingVertical: 0 },
  contribution: { minHeight: 72, flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, paddingVertical: spacing.md },
  contributionDivider: { borderTopWidth: 0.5, borderTopColor: colors.border },
  contributionIcon: { width: 40, height: 40, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.positiveTint },
  contributionAmount: { fontFamily: fontFamily.bold, fontSize: fontSize.body,
    color: colors.textPrimary },
  contributionDate: { fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.input, backgroundColor: colors.primary },
  primaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16,32,46,0.35)' },
  sheet: { padding: 20, paddingBottom: 32, gap: spacing.md,
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surface },
  sheetHeader: { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textPrimary },
  input: { minHeight: 50, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textPrimary },
});
