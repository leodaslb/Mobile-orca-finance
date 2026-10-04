import { categoryPresentation } from '@/utils/category-presentation';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { IconAlertTriangle, IconCalendar, IconChartBar, IconChevronLeft, IconPlus, IconSettings, IconTargetArrow, IconWallet } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsyncState } from '@/components/common/AsyncState';
import { MonthSelector } from '@/components/common/MonthSelector';
import { BudgetSheet } from '@/components/domain/BudgetSheet';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useAppSession } from '@/contexts/AppSessionContext';
import { decimalToCents } from '@/utils/currency';
import { localDate } from '@/utils/date';
import { AppCard } from '@/components/common/AppCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import {
  getSpendingRules,
  getFreeSpendingAllowance,
  getMonthlyPlanningData,
  type BudgetVisualStatus,
} from '@/services/planning.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';

function statusColor(status: BudgetVisualStatus) {
  if (status === null) return colors.border;
  if (status === 'exceeded') return colors.negative;
  if (status === 'warning') return colors.warning;
  return colors.positive;
}

export default function PlanejamentoScreen() {
  const router = useRouter();
  const { activeProfileId } = useAppSession();
  const [period, setPeriod] = useState(localDate().slice(0, 7));
  const [budgetOpen, setBudgetOpen] = useState(false);
  const resource = useProfileResource(useCallback(async () => {
    const [planning, quota, rules] = await Promise.all([getMonthlyPlanningData(period), getFreeSpendingAllowance(period), getSpendingRules()]);
    return { planning, quota, rules };
  }, [period]));
  const planning = resource.data?.planning;
  const freeSpending = resource.data?.quota;
  const dailyRules = resource.data?.rules.filter(r => r.tipo === 'LIMITE_DIARIO') ?? [];
  const goBack = () => router.canGoBack()
    ? router.back()
    : router.replace('/(tabs)');

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.reload} />} contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.headerButton}
          accessibilityRole="button" accessibilityLabel="Voltar">
          <IconChevronLeft size={25} color={colors.navInactive} />
        </Pressable>
        <Text style={styles.monthTitle}>Planejamento</Text>
        <Pressable onPress={() => router.push('/planejamento/limites-alertas')}
          style={styles.headerButton} accessibilityRole="button"
          accessibilityLabel="Abrir limites e alertas">
          <IconSettings size={25} color={colors.primary} />
        </Pressable>
      </View>

      <MonthSelector value={period} onChange={setPeriod} />
      {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
      {resource.data && <>
      {planning ? <AppCard style={styles.summaryCard}>
        <View style={styles.summaryColumns}>
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>Gasto no mês</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>
              {formatCurrency(planning.totalSpentCents)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryColumn}>
            <Text style={styles.summaryLabel}>Orçamento total</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>
              {formatCurrency(planning.totalBudgetCents)}
            </Text>
          </View>
        </View>
        <ProgressBar progress={planning.progress} color={statusColor(planning.status)}
          accessibilityLabel="Uso do orçamento mensal" />
        <Text style={styles.summaryCaption}>
          {planning.percentage === null ? 'Percentual indisponível' : `${planning.percentage}% do orçamento utilizado`}
        </Text>
      </AppCard> : <AppCard><Text style={styles.summaryCaption}>Nenhum orçamento configurado para este mês.</Text></AppCard>}
      <Text style={styles.summaryCaption}>Realizado nas categorias orçadas · período em UTC.</Text>
      <View style={styles.quickCards}>
        <Pressable onPress={() => router.push('/planejamento/limites-alertas')}
          style={styles.quickCard} accessibilityRole="button">
          <View style={styles.quickHeader}>
            <View style={styles.quickIcon}>
              <IconCalendar size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Limite diário</Text>
          </View>
          {dailyRules.length === 0 && <Text style={styles.quickCaption}>Não configurado</Text>}
          {dailyRules.map(rule => <View key={rule.id}>
            <Text style={styles.quickValue}>{formatCurrency(decimalToCents(rule.valorConsumido))} / {rule.valorLimite ? formatCurrency(decimalToCents(rule.valorLimite)) : '—'}</Text>
            <ProgressBar progress={rule.percentualConsumido === null ? 0 : Number(rule.percentualConsumido) / 100} color={rule.alertaAtivo ? colors.negative : colors.primary} />
            <Text style={styles.quickCaption}>{rule.ativa ? 'Hoje (UTC)' : 'Inativo'}</Text>
          </View>)}
        </Pressable>

        <Pressable onPress={() => router.push('/planejamento/gastos-livres')}
          style={styles.quickCard} accessibilityRole="button">
          <View style={styles.quickHeader}>
            <View style={[styles.quickIcon, styles.freeIcon]}>
              <IconWallet size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Gastos livres</Text>
          </View>
          {freeSpending ? <>
          <Text style={styles.freePending}>{formatCurrency(freeSpending.usedCents)} / {formatCurrency(freeSpending.limitCents)}</Text>
          <ProgressBar progress={freeSpending.limitCents === 0 ? 0 : freeSpending.usedCents / freeSpending.limitCents} />
          <Text style={styles.quickCaption}>Restante: {formatCurrency(freeSpending.remainingCents)}</Text>
          </> : <Text style={styles.quickCaption}>Não configurado</Text>}
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>POR CATEGORIA</Text>
        <Pressable style={styles.addBudget} accessibilityLabel="Configurar orçamento" onPress={() => setBudgetOpen(true)}>
          <IconPlus size={25} color={colors.primary} />
        </Pressable>
      </View>

      {planning?.categories.map((category) => {
        const appearance = categoryPresentation(category.categoryName);
        const Icon = appearance.icon;
        const exceeded = category.status === 'exceeded';
        return <AppCard key={category.categoryId}
          style={[styles.categoryCard, exceeded && styles.categoryCardExceeded]}>
          <View style={[styles.categoryIcon, { backgroundColor: appearance.background }]}>
            <Icon size={25} color={appearance.color} />
          </View>
          <View style={styles.categoryContent}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryName}>{category.categoryName}</Text>
              <View style={styles.categoryAmountRow}>
                {exceeded && <IconAlertTriangle size={18} color={colors.negative} />}
                <Text style={[styles.categoryValues, exceeded && styles.exceededText]}>
                  {formatCurrency(category.spentCents)} / {formatCurrency(category.limitCents)}
                </Text>
              </View>
            </View>
            <ProgressBar progress={category.progress} color={statusColor(category.status)}
              accessibilityLabel={`Uso do orçamento de ${category.categoryName}`} />
            <Text style={styles.quickCaption}>{category.percentage === null ? 'Percentual indisponível' : `${category.percentage}% utilizado`} · {category.status === 'warning' ? 'Próximo do limite' : category.status === 'exceeded' ? 'Excedido' : category.status === 'normal' ? 'Normal' : 'Estado indisponível'}</Text>
            {exceeded && <Text style={styles.exceededCaption}>
              Limite ultrapassado em {formatCurrency(category.differenceCents)}
            </Text>}
          </View>
        </AppCard>;
      })}

      </>}
      <Text style={styles.resourcesTitle}>OUTROS RECURSOS</Text>
      <View style={styles.resourceLinks}>
        <Pressable onPress={() => router.push('/metas')}
          style={styles.resourceLink} accessibilityRole="button">
          <IconTargetArrow size={20} color={colors.primary} />
          <Text style={styles.resourceText}>Metas</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/planejamento/planejado-realizado')}
          style={styles.resourceLink} accessibilityRole="button">
          <IconChartBar size={20} color={colors.textSecondary} />
          <Text style={styles.resourceText}>Planejado x realizado</Text>
        </Pressable>
      </View>
    </ScrollView>
    {budgetOpen && resource.data && <BudgetSheet key={`${activeProfileId}:${period}`} period={period} initial={planning?.categories ?? []}
      onClose={() => setBudgetOpen(false)} onSaved={() => { setBudgetOpen(false); resource.reload(); }} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 32, gap: spacing.lg },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: fontFamily.medium,
    fontSize: 20, color: colors.textPrimary },
  summaryCard: { gap: spacing.lg, padding: 20 },
  summaryColumns: { flexDirection: 'row', alignItems: 'stretch' },
  summaryColumn: { flex: 1 },
  summaryDivider: { width: 1, marginHorizontal: spacing.lg, backgroundColor: colors.border },
  summaryLabel: { marginBottom: spacing.xs, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  summaryValue: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.textPrimary },
  summaryCaption: { fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  quickCards: { flexDirection: 'row', gap: spacing.sm },
  quickCard: { flex: 1, minWidth: 0, padding: spacing.lg, gap: spacing.md,
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.card,
    backgroundColor: colors.surface },
  quickHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quickIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.icon, backgroundColor: colors.primaryTint },
  freeIcon: { backgroundColor: colors.primaryTint },
  quickLabel: { flex: 1, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textSecondary },
  quickValueRow: { minHeight: 22, flexDirection: 'row', alignItems: 'baseline' },
  quickValue: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  quickLimit: { flexShrink: 1, fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  freePending: { minHeight: 22, fontFamily: fontFamily.bold,
    fontSize: fontSize.body, color: colors.textPrimary },
  quickCaption: { fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  sectionHeader: { minHeight: 38, marginTop: spacing.sm, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textSecondary },
  addBudget: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  categoryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    paddingHorizontal: spacing.lg, paddingVertical: 16 },
  categoryCardExceeded: { borderWidth: 1, borderColor: colors.negative },
  categoryIcon: { width: 48, height: 48, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.card },
  categoryContent: { flex: 1, gap: spacing.md },
  categoryHeader: { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.sm },
  categoryName: { flexShrink: 1, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textPrimary },
  categoryAmountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  categoryValues: { fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  exceededText: { color: colors.negative },
  exceededCaption: { fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.negative },
  resourcesTitle: { marginTop: spacing.sm, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textSecondary },
  resourceLinks: { flexDirection: 'row', gap: spacing.sm },
  resourceLink: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm,
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.card,
    backgroundColor: colors.surface },
  resourceText: { fontFamily: fontFamily.medium,
    fontSize: fontSize.caption, color: colors.textPrimary },
});
