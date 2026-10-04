import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { AsyncState } from '@/components/common/AsyncState';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { MonthSelector } from '@/components/common/MonthSelector';
import { categoryPresentation } from '@/utils/category-presentation';
import { formatCurrency } from '@/utils/currency';
import { localDate } from '@/utils/date';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props {
  items: { categoryId: string; categoryName: string; totalCents: number }[];
  period: string; onPeriodChange: (period: string) => void;
  loading?: boolean; refreshing?: boolean; error?: string; onRetry: () => void;
}

export function CategorySpendingCard({ items, period, onPeriodChange, loading, refreshing, error, onRetry }: Props) {
  const currentMonth = localDate().slice(0, 7);
  const maxValue = Math.max(...items.map(item => item.totalCents), 0);
  return <AppCard style={styles.card}>
    <Text style={styles.title}>Gastos por categoria</Text>
    <MonthSelector value={period} onChange={onPeriodChange} />
    {period !== currentMonth && <Pressable accessibilityRole="button" onPress={() => onPeriodChange(currentMonth)} style={styles.currentMonth}>
      <Text style={styles.link}>Voltar ao mês atual</Text>
    </Pressable>}
    {(loading || refreshing || error) && <AsyncState loading={loading || refreshing} error={error} onRetry={onRetry} />}
    {!loading && !items.length && !error && <Text style={styles.empty}>Sem despesas efetivadas neste mês.</Text>}
    {!loading && !!items.length && <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chart}>
        {items.map(item => <View key={item.categoryId} style={styles.column} accessibilityLabel={`${item.categoryName}: ${formatCurrency(item.totalCents)}`}>
          <Text numberOfLines={1} style={styles.value}>{formatCurrency(item.totalCents)}</Text>
          <View style={styles.barArea}><View style={[styles.bar, {
            height: `${maxValue ? Math.max(item.totalCents / maxValue * 100, 3) : 0}%`,
            backgroundColor: categoryPresentation(item.categoryName).chart,
          }]} /></View>
          <CategoryIcon name={item.categoryName} size={20} />
          <Text numberOfLines={2} style={styles.label}>{item.categoryName}</Text>
        </View>)}
      </View>
    </ScrollView>}
  </AppCard>;
}

const styles = StyleSheet.create({
  card: { paddingBottom: spacing.md, gap: spacing.sm },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  currentMonth: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: colors.primary },
  empty: { fontFamily: fontFamily.regular, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center' },
  chart: { height: 210, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingTop: spacing.sm },
  column: { width: 88, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  barArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 42, borderTopLeftRadius: radius.icon, borderTopRightRadius: radius.icon },
  label: { height: 36, width: '100%', textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textSecondary },
  value: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: colors.textPrimary },
});
