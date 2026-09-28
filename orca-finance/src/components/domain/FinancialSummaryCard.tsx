import {
    IconArrowDown,
    IconArrowUp,
    IconEye,
} from '@tabler/icons-react-native';

import {
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    colors,
    fontFamily,
    fontSize,
    radius,
    spacing,
} from '@/theme';

import { formatCurrency } from '@/utils/currency';

interface FinancialSummaryCardProps {
  balanceCents: number;
  currentMonthExpensesCents: number;
  monthComparisonCents: number;
}

export function FinancialSummaryCard({
  balanceCents,
  currentMonthExpensesCents,
  monthComparisonCents,
}: FinancialSummaryCardProps) {
  const comparisonAbsolute = Math.abs(
    monthComparisonCents
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>
            Saldo atual
          </Text>

          <IconEye
            size={24}
            color={colors.surface}
            strokeWidth={2}
          />
        </View>

        <Text style={styles.balance}>
          {formatCurrency(balanceCents)}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryIcon,
              styles.expenseIconBackground,
            ]}
          >
            <IconArrowUp
              size={22}
              color={colors.positive}
              strokeWidth={2.4}
            />
          </View>

          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>
              Gastos do mês
            </Text>

            <Text style={styles.summaryValue}>
              {formatCurrency(
                currentMonthExpensesCents
              )}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryIcon,
              styles.comparisonIconBackground,
            ]}
          >
            <IconArrowDown
              size={22}
              color={colors.negative}
              strokeWidth={2.4}
            />
          </View>

          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>
              Vs. mês anterior
            </Text>

            <Text style={styles.summaryValue}>
              {formatCurrency(
                comparisonAbsolute
              )}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },

  balanceCard: {
    minHeight: 132,
    padding: spacing.lg,
    paddingBottom: 38,

    borderRadius: radius.card,

    backgroundColor: colors.primary,
  },

  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  balanceLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.surface,
  },

  balance: {
    marginTop: spacing.md,

    fontFamily: fontFamily.bold,
    fontSize: fontSize.display,

    color: colors.surface,
  },

  summaryRow: {
    flexDirection: 'row',

    marginTop: -26,

    gap: spacing.sm,
  },

  summaryCard: {
    flex: 1,

    minHeight: 78,

    flexDirection: 'row',
    alignItems: 'center',

    padding: spacing.md,

    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,

    backgroundColor: colors.surface,
  },

  summaryIcon: {
    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: radius.icon,

    marginRight: spacing.sm,
  },

  expenseIconBackground: {
    backgroundColor: colors.positiveTint,
  },

  comparisonIconBackground: {
    backgroundColor: '#FDEAEA',
  },

  summaryContent: {
    flex: 1,
  },

  summaryLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },

  summaryValue: {
    marginTop: 2,

    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,

    color: colors.textPrimary,
  },
});