export type GoalSuggestionFrequency =
  | 'daily'
  | 'weekly';

export interface Goal {
  id: string;
  profileId: string;

  name: string;
  targetCents: number;
  deadline: string;

  suggestionFrequency: GoalSuggestionFrequency;
}

export interface GoalContribution {
  id: string;
  profileId: string;
  goalId: string;

  amountCents: number;
  date: string;
}