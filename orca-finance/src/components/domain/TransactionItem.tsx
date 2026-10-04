import { categoryPresentation } from '@/utils/category-presentation';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { IconChevronRight } from '@tabler/icons-react-native';

import {
    Pressable,
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

interface TransactionItemProps {
  description: string;
  categoryId: string | null;
  categoryName: string;
  dateLabel?: string;
  variant?: 'dashboard' | 'list';
  status?: 'effective' | 'scheduled' | 'reflection';
  amountCents: number;
  type: 'income' | 'expense';
  showDivider?: boolean;
  onPress?: () => void;
}

export function TransactionItem({
  description,
  categoryId,
  categoryName,
  dateLabel,
  amountCents,
  type,
  variant = 'dashboard',
  status,
  showDivider = true,
  onPress,
}: TransactionItemProps) {
  const isExpense = type === 'expense';

  const appearance = categoryPresentation(categoryName);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.container,
        variant === 'dashboard' &&
          showDivider &&
          styles.divider,
        variant === 'list' &&
          styles.listCard,
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          variant === 'list' &&
            styles.listIcon,
          {
            backgroundColor:
              appearance.background,
          },
        ]}
      >
        <CategoryIcon name={categoryName} />
      </View>

      <View style={styles.info}>
        <Text
          style={[
            styles.description,
            variant === 'list' &&
              styles.listDescription,
          ]}
          numberOfLines={
            variant === 'list' ? 2 : 1
          }
        >
          {description}
        </Text>

        <Text
          style={styles.meta}
          numberOfLines={1}
        >
          {categoryName}
          {dateLabel
            ? ` • ${dateLabel}`
            : ''}
        </Text>

        {status === 'scheduled' && (
          <Text style={styles.meta}>
            Prevista
          </Text>
        )}
        {status === 'reflection' && (
          <Text style={styles.meta}>Em reflexão · não contabilizada</Text>
        )}
      </View>

      <Text
        style={[
          styles.amount,
          isExpense
            ? styles.expense
            : styles.income,
          status === 'reflection' && styles.reflectionAmount,
        ]}
      >
        {status === 'reflection' ? '' : isExpense ? '- ' : '+ '}
        {formatCurrency(amountCents)}
      </Text>

      {variant === 'list' && (
        <IconChevronRight
          size={16}
          color={colors.navInactive}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    marginRight: 0,
  },

  listDescription: {
    fontFamily: fontFamily.medium,
  },

  listCard: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  reflectionAmount: { color: colors.warning },

  container: {
    minHeight: 66,

    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: spacing.sm,
  },

  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },

  iconContainer: {
    width: 42,
    height: 42,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: spacing.md,

    borderRadius: radius.icon,
  },

  info: {
    flex: 1,

    paddingRight: spacing.sm,
  },

  description: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,

    color: colors.textPrimary,
  },

  meta: {
    marginTop: 2,

    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,

    color: colors.textSecondary,
  },

  amount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
  },

  expense: {
    color: colors.negative,
  },

  income: {
    color: colors.positive,
  },
});
