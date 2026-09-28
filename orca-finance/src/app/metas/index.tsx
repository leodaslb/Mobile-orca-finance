import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconPigMoney,
  IconPlus,
  IconTargetArrow,
} from '@tabler/icons-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/common/ProgressBar';
import { getGoals } from '@/services/goal.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import { formatTransactionDate } from '@/utils/date';

export default function GoalsScreen() {
  const router = useRouter();
  const [, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    setRevision((current) => current + 1);
  }, []));
  const goals = getGoals();
  const goBack = () => router.canGoBack()
    ? router.back()
    : router.replace('/(tabs)/planejamento');

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={goBack} style={styles.backButton}
        accessibilityRole="button" accessibilityLabel="Voltar">
        <IconChevronLeft size={25} color={colors.navInactive} />
      </Pressable>
      <Text style={styles.title}>Metas</Text>
      <Pressable onPress={() => router.push('/metas/nova')} style={styles.newButton}
        accessibilityRole="button">
        <IconPlus size={22} color={colors.primary} />
        <Text style={styles.newText}>Nova meta</Text>
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {goals.length === 0 && <Text style={styles.empty}>Nenhuma meta cadastrada.</Text>}
      {goals.map((goal, index) => <Pressable key={goal.id}
        onPress={() => router.push({ pathname: '/metas/[id]', params: { id: goal.id } })}
        style={styles.card} accessibilityRole="button">
        <View style={[styles.goalIcon, index % 2 === 1 && styles.goalIconAlternative]}>
          {index % 2 === 0
            ? <IconTargetArrow size={28} color={colors.primary} />
            : <IconPigMoney size={28} color={colors.positive} />}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.goalName}>{goal.name}</Text>
            <IconChevronRight size={22} color={colors.navInactive} />
          </View>
          <Text style={styles.amount}>
            <Text style={styles.amountStrong}>{formatCurrency(goal.currentCents)}</Text>
            {' de '}{formatCurrency(goal.targetCents)}
          </Text>
          <View style={styles.progressRow}>
            <View style={styles.progress}>
              <ProgressBar progress={goal.progress}
                accessibilityLabel={`Progresso da meta ${goal.name}`} />
            </View>
            <Text style={styles.percentage}>{Math.round(goal.progress * 100)}%</Text>
          </View>
          <View style={styles.metaRow}>
            <IconCalendar size={18} color={colors.navInactive} />
            <Text style={styles.metaText}>{goal.isExpired ? `Prazo vencido em ${formatTransactionDate(goal.deadline)}` : `Até ${formatTransactionDate(goal.deadline)}`}</Text>
          </View>
          {goal.isExpired && <Text style={styles.expiredText}>Meta não cumprida. Faltaram {formatCurrency(goal.remainingCents)}.</Text>}
          <View style={styles.metaRow}>
            <IconPigMoney size={18} color={colors.navInactive} />
            <Text style={styles.metaText}>
              {goal.suggestionCents === null
                ? 'Sugestão indisponível'
                : `Economize ${formatCurrency(goal.suggestionCents)} por ${
                  goal.suggestionFrequency === 'daily' ? 'dia' : 'semana'
                }`}
            </Text>
          </View>
        </View>
      </Pressable>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 24, color: colors.textPrimary },
  newButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  newText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
  content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.lg },
  empty: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  card: { flexDirection: 'row', gap: spacing.lg, padding: 20,
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.card,
    backgroundColor: colors.surface },
  goalIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.primaryTint },
  goalIconAlternative: { backgroundColor: colors.positiveTint },
  cardContent: { flex: 1, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalName: { flex: 1, fontFamily: fontFamily.bold,
    fontSize: fontSize.title, color: colors.textPrimary },
  amount: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  amountStrong: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.textPrimary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  progress: { flex: 1 },
  percentage: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { flex: 1, fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  expiredText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.warning },
});
