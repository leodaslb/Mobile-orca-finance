import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronLeft,
} from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/common/AppCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import {
  getAvailablePlanningPeriods,
  getPlannedVsActualData,
} from '@/services/planning.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';

function periodLabel(periodKey: string) {
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${periodKey}-01T00:00:00Z`));
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
}

export default function PlannedVsActualScreen() {
  const router = useRouter();
  const periods = useMemo(() => getAvailablePlanningPeriods(), []);
  const [period, setPeriod] = useState(periods[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const data = getPlannedVsActualData(period);
  const goBack = () => router.canGoBack()
    ? router.back()
    : router.replace('/(tabs)/planejamento');

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={goBack} style={styles.headerButton}
        accessibilityRole="button" accessibilityLabel="Voltar">
        <IconChevronLeft size={25} color={colors.navInactive} />
      </Pressable>
      <Text style={styles.title}>Planejado x realizado</Text>
      <View style={styles.headerButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => setPickerOpen(true)} style={styles.selector}
        accessibilityRole="button" accessibilityLabel="Selecionar período">
        <Text style={styles.selectorText}>{periodLabel(period)}</Text>
        <IconChevronDown size={22} color={colors.textSecondary} />
      </Pressable>
      <AppCard style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Resumo do período</Text>
        <View style={styles.summaryRow}>
          <SummaryValue label="Planejado" value={data.totalBudgetCents} />
          <View style={styles.divider} />
          <SummaryValue label="Realizado" value={data.totalSpentCents} />
          <View style={styles.divider} />
          <SummaryValue label="Diferença" value={data.differenceCents}
            color={data.differenceCents >= 0 ? colors.positive : colors.negative} />
        </View>
      </AppCard>
      <Text style={styles.sectionTitle}>Por categoria</Text>
      {data.categories.map((category) => {
        const differenceColor = category.differenceCents > 0
          ? colors.negative : colors.positive;
        const max = Math.max(category.limitCents, category.spentCents, 1);
        return <AppCard key={category.categoryId} style={styles.categoryCard}>
          <Text style={styles.categoryName}>{category.categoryName}</Text>
          <View style={styles.categoryValues}>
            <ComparisonValue label="Planejado" value={category.limitCents} />
            <ComparisonValue label="Realizado" value={category.spentCents} />
            <ComparisonValue label="Diferença" value={category.differenceCents}
              color={differenceColor} signed />
          </View>
          <View style={styles.bars}>
            <ProgressBar progress={category.limitCents / max} color={colors.primary}
              accessibilityLabel={`Planejado para ${category.categoryName}`} />
            <ProgressBar progress={category.spentCents / max} color={colors.warning}
              accessibilityLabel={`Realizado em ${category.categoryName}`} />
          </View>
        </AppCard>;
      })}
      {data.largestDeviation && <AppCard style={styles.deviationCard}>
        <View style={styles.alertIcon}>
          <IconAlertTriangle size={24} color={colors.negative} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.deviationLabel}>Maior desvio</Text>
          <Text style={styles.deviationValue}>
            {data.largestDeviation.categoryName}: {
              data.largestDeviation.differenceCents > 0 ? '+' : ''
            }{formatCurrency(data.largestDeviation.differenceCents)}
          </Text>
        </View>
      </AppCard>}
    </ScrollView>
    <Modal visible={pickerOpen} transparent animationType="fade"
      onRequestClose={() => setPickerOpen(false)}>
      <Pressable style={styles.overlay} onPress={() => setPickerOpen(false)}>
        <View style={styles.periodModal}>
          <Text style={styles.cardTitle}>Selecionar período</Text>
          {periods.map((item) => <Pressable key={item} style={styles.periodOption}
            onPress={() => { setPeriod(item); setPickerOpen(false); }}>
            <Text style={styles.selectorText}>{periodLabel(item)}</Text>
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </SafeAreaView>;
}

function SummaryValue(props: { label: string; value: number; color?: string }) {
  return <View style={styles.summaryValue}>
    <Text style={styles.valueLabel}>{props.label}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit
      style={[styles.valueAmount, props.color ? { color: props.color } : null]}>
      {formatCurrency(props.value)}
    </Text>
  </View>;
}

function ComparisonValue(props: {
  label: string; value: number; color?: string; signed?: boolean;
}) {
  return <View style={styles.comparisonValue}>
    <Text style={styles.valueLabel}>{props.label}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit
      style={[styles.comparisonAmount, props.color ? { color: props.color } : null]}>
      {props.signed && props.value > 0 ? '+' : ''}{formatCurrency(props.value)}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.md },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.medium, fontSize: 20, color: colors.textPrimary },
  content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.lg },
  selector: { minHeight: 50, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderWidth: 0.5,
    borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  selectorText: { fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textPrimary },
  summaryCard: { gap: spacing.lg, padding: 20 },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  summaryRow: { flexDirection: 'row' },
  summaryValue: { flex: 1, gap: spacing.xs },
  divider: { width: 1, marginHorizontal: spacing.sm, backgroundColor: colors.border },
  valueLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.caption,
    color: colors.textSecondary },
  valueAmount: { fontFamily: fontFamily.bold, fontSize: fontSize.title,
    color: colors.textPrimary },
  sectionTitle: { fontFamily: fontFamily.medium, fontSize: fontSize.title,
    color: colors.textSecondary },
  categoryCard: { gap: spacing.md, padding: spacing.lg },
  categoryName: { fontFamily: fontFamily.bold, fontSize: fontSize.body,
    color: colors.textPrimary },
  categoryValues: { flexDirection: 'row' },
  comparisonValue: { flex: 1, gap: 2 },
  comparisonAmount: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textPrimary },
  bars: { gap: spacing.xs },
  deviationCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  alertIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.icon, backgroundColor: colors.categories.leisure.background },
  flex: { flex: 1 },
  deviationLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.body,
    color: colors.textPrimary },
  deviationValue: { marginTop: 2, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.negative },
  overlay: { flex: 1, justifyContent: 'center', padding: 24,
    backgroundColor: 'rgba(16,32,46,0.35)' },
  periodModal: { padding: 20, gap: spacing.md, borderRadius: radius.sheet,
    backgroundColor: colors.surface },
  periodOption: { minHeight: 46, justifyContent: 'center',
    paddingHorizontal: spacing.lg, borderRadius: radius.input,
    backgroundColor: colors.primaryTint },
});
