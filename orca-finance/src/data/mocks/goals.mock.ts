import {
    Goal,
    GoalContribution,
} from '@/types';

export const goalsMock: Goal[] = [
  {
    id: 'goal-001',
    profileId: 'profile-001',

    name: 'Viagem',

    targetCents: 500000,

    deadline: '2026-12-20',

    suggestionFrequency: 'daily',
  },
];

export const goalContributionsMock: GoalContribution[] = [
  {
    id: 'contribution-001',
    profileId: 'profile-001',
    goalId: 'goal-001',
    amountCents: 120000,
    date: '2026-06-15',
  },

  {
    id: 'contribution-002',
    profileId: 'profile-001',
    goalId: 'goal-001',
    amountCents: 30000,
    date: '2026-08-15',
  },

  {
    id: 'contribution-003',
    profileId: 'profile-001',
    goalId: 'goal-001',
    amountCents: 50000,
    date: '2026-09-01',
  },

  {
    id: 'contribution-004',
    profileId: 'profile-001',
    goalId: 'goal-001',
    amountCents: 25000,
    date: '2026-09-13',
  },
];