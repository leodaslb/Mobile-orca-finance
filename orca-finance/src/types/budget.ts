export interface MonthlyCategoryBudget {
  id: string;
  profileId: string;
  categoryId: string;

  year: number;
  month: number;

  limitCents: number;
}

export interface CategorySpendingLimit {
  categoryId: string;
  limitCents: number;
  period: 'monthly' | null;
}

export interface SpendingLimitsConfiguration {
  profileId: string;
  dailyEnabled: boolean;
  dailyLimitCents: number;
  categoryLimits: CategorySpendingLimit[];
  pushEnabled: boolean;
  emailEnabled: boolean;
}

export interface MonthlyFreeSpendingAllowance {
  id: string;
  profileId: string;
  year: number;
  month: number;
  limitCents: number;
}
