
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { IconChevronLeft } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsyncState } from '@/components/common/AsyncState';
import { MonthSelector } from '@/components/common/MonthSelector';
import { useProfileResource } from '@/hooks/useProfileResource';
import { localDate } from '@/utils/date';
import { AppCard } from '@/components/common/AppCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import {
  getPlannedVsActualData,
} from '@/services/planning.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';

export default function PlannedVsActualScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState(localDate().slice(0, 7));
  const resource = useProfileResource(useCallback(() => getPlannedVsActualData(period), [period]));
  const data = resource.data;
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
    <ScrollView refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.reload} />} contentContainerStyle={styles.content}>
      <MonthSelector value={period} onChange={setPeriod} />
      {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
      {!resource.loading && !resource.error && !data && <Text style={styles.valueLabel}>Nenhum orçamento neste mês.</Text>}
      {data && <>
      <Text style={styles.valueLabel}>Realizado das categorias orçadas. Diferença = realizado menos planejado. Período em UTC.</Text>
      <AppCard style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Resumo do período</Text>
        <View style={styles.summaryRow}>
          <SummaryValue label="Planejado" value={data.totalBudgetCents} />
          <View style={styles.divider} />
          <SummaryValue label="Realizado" value={data.totalSpentCents} />
          <View style={styles.divider} />
          <SummaryValue label="Diferença" value={data.differenceCents}
            color={data.differenceCents <= 0 ? colors.positive : colors.negative} />
        </View>
      </AppCard>
      <Text style={styles.sectionTitle}>Por categoria</Text>
      {data.categories.map((category) => {
        const differenceColor = category.differenceCents > 0
          ? colors.negative : colors.positive;
        const max = Math.max(category.limitCents, category.spentCents, 1);
        return <AppCard key={category.categoryId} style={styles.categoryCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><CategoryIcon name={category.categoryName} /><Text style={styles.categoryName}>{category.categoryName}</Text></View>
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
      </>}
    </ScrollView>
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
