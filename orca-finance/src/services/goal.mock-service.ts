import {
  goalContributionsMock,
  goalsMock,
} from '@/data/mocks/goals.mock';
import { mockScenario } from '@/data/mocks/scenario.mock';
import type {
  Goal,
  GoalContribution,
  GoalSuggestionFrequency,
} from '@/types';

export interface CreateGoalInput {
  name: string;
  targetCents: number;
  deadline: string;
  suggestionFrequency: GoalSuggestionFrequency;
}

export interface AddGoalContributionInput {
  goalId: string;
  amountCents: number;
  date: string;
}

function isValidISODate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function nextStableId(prefix: string, ids: string[]) {
  const highest = ids.reduce((result, id) => {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(result, Number(match[1])) : result;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
}

export function calculateGoalSuggestion(input: {
  targetCents: number;
  currentCents: number;
  deadline: string;
  frequency: GoalSuggestionFrequency;
  referenceDate?: string;
}) {
  if (!isValidISODate(input.deadline)) return null;
  const remainingCents = Math.max(input.targetCents - input.currentCents, 0);
  if (remainingCents === 0) return 0;
  const reference = input.referenceDate ?? mockScenario.referenceDate;
  const milliseconds = Date.parse(`${input.deadline}T00:00:00Z`) -
    Date.parse(`${reference}T00:00:00Z`);
  const daysRemaining = Math.ceil(milliseconds / 86400000);
  if (daysRemaining <= 0) return null;
  const periodsRemaining = input.frequency === 'daily'
    ? daysRemaining
    : Math.ceil(daysRemaining / 7);
  return Math.ceil(remainingCents / periodsRemaining);
}

function enrichGoal(goal: Goal) {
  const contributions = goalContributionsMock
    .filter((item) =>
      item.profileId === mockScenario.activeProfileId && item.goalId === goal.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((item) => ({ ...item }));
  const currentCents = contributions.reduce((total, item) => total + item.amountCents, 0);
  return {
    ...goal,
    currentCents,
    progress: goal.targetCents === 0 ? 0 : currentCents / goal.targetCents,
    isExpired: goal.deadline < mockScenario.referenceDate && currentCents < goal.targetCents,
    remainingCents: Math.max(goal.targetCents - currentCents, 0),
    suggestionCents: calculateGoalSuggestion({
      targetCents: goal.targetCents,
      currentCents,
      deadline: goal.deadline,
      frequency: goal.suggestionFrequency,
    }),
    contributions,
  };
}

export function getGoals() {
  return goalsMock
    .filter((goal) => goal.profileId === mockScenario.activeProfileId)
    .map(enrichGoal);
}

export function getGoalReferenceDate() {
  return mockScenario.referenceDate;
}

export function getGoalById(id: string) {
  const goal = goalsMock.find((item) =>
    item.id === id && item.profileId === mockScenario.activeProfileId);
  return goal ? enrichGoal(goal) : undefined;
}

export function updateGoalDeadline(id: string, deadline: string) {
  const goal = goalsMock.find((item) => item.id === id && item.profileId === mockScenario.activeProfileId);
  if (!goal) throw new Error('Meta não encontrada.');
  if (!isValidISODate(deadline) || deadline <= mockScenario.referenceDate) {
    throw new Error('Informe uma nova data-limite futura.');
  }
  goal.deadline = deadline;
  return enrichGoal(goal);
}

export function createGoal(input: CreateGoalInput) {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Informe o nome da meta.');
  if (!Number.isSafeInteger(input.targetCents) || input.targetCents <= 0) {
    throw new Error('Informe um valor-alvo válido.');
  }
  if (!isValidISODate(input.deadline) || input.deadline <= mockScenario.referenceDate) {
    throw new Error('Informe uma data-limite futura válida.');
  }
  if (input.suggestionFrequency !== 'daily' && input.suggestionFrequency !== 'weekly') {
    throw new Error('Frequência da sugestão inválida.');
  }
  const goal: Goal = {
    id: nextStableId('goal', goalsMock.map((item) => item.id)),
    profileId: mockScenario.activeProfileId,
    name,
    targetCents: input.targetCents,
    deadline: input.deadline,
    suggestionFrequency: input.suggestionFrequency,
  };
  goalsMock.push(goal);
  return enrichGoal(goal);
}

export function addGoalContribution(input: AddGoalContributionInput) {
  if (!getGoalById(input.goalId)) throw new Error('Meta não encontrada.');
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('Informe um valor de aporte válido.');
  }
  if (!isValidISODate(input.date)) throw new Error('Informe uma data válida.');
  const contribution: GoalContribution = {
    id: nextStableId('contribution', goalContributionsMock.map((item) => item.id)),
    profileId: mockScenario.activeProfileId,
    goalId: input.goalId,
    amountCents: input.amountCents,
    date: input.date,
  };
  goalContributionsMock.push(contribution);
  return { ...contribution };
}
