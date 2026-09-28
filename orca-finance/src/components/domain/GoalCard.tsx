import { IconTargetArrow } from '@tabler/icons-react-native';

import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { AppCard } from '@/components/common/AppCard';
import { ProgressBar } from '@/components/common/ProgressBar';

import {
    colors,
    fontFamily,
    fontSize,
    radius,
    spacing,
} from '@/theme';

import { formatCurrency } from '@/utils/currency';

interface GoalCardProps {
  name: string;
  currentCents: number;
  targetCents: number;
  progress: number;
  onPress?: () => void;
}

export function GoalCard({
  name,
  currentCents,
  targetCents,
  progress,
  onPress,
}: GoalCardProps) {
  const percentage = Math.round(
    progress * 100
  );

  return (
    <Pressable onPress={onPress}>
      <AppCard style={styles.card}>
        <View style={styles.iconContainer}>
          <IconTargetArrow
            size={26}
            color={colors.primary}
            strokeWidth={2}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Meta: {name.toLowerCase()}
            </Text>

            <Text style={styles.percentage}>
              {percentage}%
            </Text>
          </View>

          <Text style={styles.amount}>
            {formatCurrency(currentCents)} de{' '}
            {formatCurrency(targetCents)}
          </Text>

          <View style={styles.progress}>
            <ProgressBar
              progress={progress}
              accessibilityLabel={`Progresso da meta ${name}`}
            />
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',

    padding: spacing.md,
  },

  iconContainer: {
    width: 44,
    height: 44,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: spacing.md,

    borderRadius: radius.icon,

    backgroundColor: colors.primaryTint,
  },

  content: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    flex: 1,

    fontFamily: fontFamily.bold,
    fontSize: fontSize.title,

    color: colors.textPrimary,
  },

  percentage: {
    marginLeft: spacing.sm,

    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,

    color: colors.primary,
  },

  amount: {
    marginTop: 2,

    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,

    color: colors.textSecondary,
  },

  progress: {
    marginTop: spacing.sm,
  },
});