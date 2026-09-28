import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/common/AppCard';

import { CategorySpendingCard } from '@/components/domain/CategorySpendingCard';
import { FinancialSummaryCard } from '@/components/domain/FinancialSummaryCard';
import { GoalCard } from '@/components/domain/GoalCard';
import { TransactionItem } from '@/components/domain/TransactionItem';

import { getDashboardData } from '@/services/dashboard.service';

import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '@/theme';

import {
  formatDashboardDate,
  formatTransactionDateTime,
} from '@/utils/date';

export default function DashboardScreen() {
  const router = useRouter();
  const [dataRevision, setDataRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setDataRevision((current) => current + 1);
    }, []),
  );

  const data = useMemo(
    () => getDashboardData(),
    [dataRevision],
  );
  const goal = data.goal;
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>
              {formatDashboardDate(
                data.referenceDate
              )}
            </Text>

            <Text style={styles.greeting}>
              Olá, {data.profile.name}
            </Text>

            <Text style={styles.subtitle}>
              Veja seu resumo financeiro
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil e configurações"
            onPress={() => router.push('/configuracoes')}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {data.profile.initials}
            </Text>
          </Pressable>
        </View>

        <FinancialSummaryCard
          balanceCents={data.balanceCents}
          currentMonthExpensesCents={
            data.currentMonthExpensesCents
          }
          monthComparisonCents={
            data.monthComparisonCents
          }
        />

        <CategorySpendingCard
          items={data.expensesByCategory}
        />

        {goal ? <GoalCard
          name={goal.name}
          currentCents={goal.currentCents}
          targetCents={goal.targetCents}
          progress={goal.progress}
          onPress={() =>
            router.push({
              pathname: '/metas/[id]',
              params: {
                id: goal.id,
              },
            })
          }
        /> : <AppCard><Text style={styles.emptyText}>Você ainda não criou metas para este perfil.</Text></AppCard>}

        <AppCard style={styles.transactionsCard}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsTitle}>
              Últimas transações
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  '/(tabs)/transacoes'
                )
              }
            >
              <Text style={styles.seeAll}>
                Ver todas
              </Text>
            </Pressable>
          </View>

          <View style={styles.transactionsList}>
            {data.recentTransactions.length === 0 && <Text style={styles.emptyText}>Nenhuma transação neste perfil.</Text>}
            {data.recentTransactions.map(
              (transaction, index) => (
                <TransactionItem
                  key={transaction.id}
                  description={
                    transaction.description
                  }
                  categoryId={
                    transaction.categoryId
                  }
                  categoryName={
                    transaction.categoryName
                  }
                  dateLabel={formatTransactionDateTime(
                    transaction.date,
                    transaction.time,
                    data.referenceDate
                  )}
                  amountCents={
                    transaction.amountCents
                  }
                  type={transaction.type}
                  showDivider={
                    index <
                    data.recentTransactions
                      .length -
                      1
                  }
                  onPress={() =>
                    router.push({
                      pathname:
                        '/transacao/[id]',
                      params: {
                        id: transaction.id,
                      },
                    })
                  }
                />
              )
            )}
          </View>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: colors.background,
  },

  screen: {
    flex: 1,

    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 24,

    gap: spacing.md,
  },

  header: {
    minHeight: 78,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: 2,
  },

  headerText: {
    flex: 1,
  },

  date: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,

    color: colors.textSecondary,
  },

  greeting: {
    marginTop: spacing.sm,

    fontFamily: fontFamily.bold,
    fontSize: 24,

    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: 2,

    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,

    color: colors.textSecondary,
  },

  avatar: {
    width: 46,
    height: 46,

    marginLeft: spacing.md,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: radius.pill,

    backgroundColor: colors.primary,
  },

  avatarText: {
    fontFamily: fontFamily.medium,
    fontSize: 16,

    color: colors.surface,
  },

  transactionsCard: {
    paddingTop: spacing.md,
  },

  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginBottom: spacing.xs,
  },

  transactionsTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.title,

    color: colors.textPrimary,
  },

  seeAll: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,

    color: colors.primary,
  },

  transactionsList: {
    marginTop: spacing.xs,
  },

  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },
});
