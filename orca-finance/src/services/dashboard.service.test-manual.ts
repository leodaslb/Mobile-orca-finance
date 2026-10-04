import { getDashboardData } from './dashboard.mock-service';

const data = getDashboardData();

console.log({
  balanceCents: data.balanceCents,
  currentMonthExpensesCents: data.currentMonthExpensesCents,
  previousMonthExpensesCents: data.previousMonthExpensesCents,
  monthComparisonCents: data.monthComparisonCents,
  goalCurrentCents: data.goal?.currentCents ?? 0,
  goalProgress: data.goal?.progress ?? 0,
});
