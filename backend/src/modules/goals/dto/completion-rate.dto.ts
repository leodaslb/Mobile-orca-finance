import { IsIn } from 'class-validator';
export class CompletionRateQueryDto { @IsIn(['6m', '12m']) window!: '6m' | '12m'; }
