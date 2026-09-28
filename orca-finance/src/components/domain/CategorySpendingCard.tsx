import { IconChevronDown } from '@tabler/icons-react-native';

import {
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { AppCard } from '@/components/common/AppCard';

import {
    colors,
    fontFamily,
    fontSize,
    radius,
    spacing,
} from '@/theme';

interface CategorySpendingItem {
  categoryId: string;
  categoryName: string;
  totalCents: number;
}

interface CategorySpendingCardProps {
  items: CategorySpendingItem[];
}

function getCategoryColor(categoryId: string): string {
  switch (categoryId) {
    case 'category-food':
      return colors.chart.food;

    case 'category-housing':
      return colors.chart.housing;

    case 'category-transport':
      return colors.chart.transport;

    case 'category-leisure':
      return colors.chart.leisure;

    default:
      return colors.chart.other;
  }
}

export function CategorySpendingCard({
  items,
}: CategorySpendingCardProps) {
  const maxValue = Math.max(
    ...items.map((item) => item.totalCents),
    0
  );

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Gastos por categoria
        </Text>

        <View style={styles.period}>
          <Text style={styles.periodText}>
            Este mês
          </Text>

          <IconChevronDown
            size={15}
            color={colors.textSecondary}
            strokeWidth={2}
          />
        </View>
      </View>

      <View style={styles.chart}>
        {items.map((item) => {
          const ratio =
            maxValue === 0
              ? 0
              : item.totalCents / maxValue;

          const percentage = Math.max(
            ratio * 100,
            8
          );

          return (
            <View
              key={item.categoryId}
              style={styles.column}
            >
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${percentage}%`,
                      backgroundColor:
                        getCategoryColor(
                          item.categoryId
                        ),
                    },
                  ]}
                />
              </View>

              <Text
                numberOfLines={1}
                style={styles.label}
              >
                {item.categoryName}
              </Text>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.title,
    color: colors.textPrimary,
  },

  period: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  periodText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },

  chart: {
    height: 138,

    flexDirection: 'row',
    alignItems: 'flex-end',

    marginTop: spacing.lg,

    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },

  column: {
    flex: 1,

    height: '100%',

    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  barArea: {
    flex: 1,

    width: '100%',

    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  bar: {
    width: '62%',
    maxWidth: 42,

    borderTopLeftRadius: radius.icon,
    borderTopRightRadius: radius.icon,
  },

  label: {
    width: '100%',

    marginTop: spacing.sm,

    textAlign: 'center',

    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,

    color: colors.textSecondary,
  },
});