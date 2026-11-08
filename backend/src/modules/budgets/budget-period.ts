import { BadRequestException } from '@nestjs/common';

export function budgetDate(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime())
    || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Data de orçamento inválida.');
  return date;
}

export function budgetPeriod(start: string, end: string) {
  const first = budgetDate(start);
  const last = budgetDate(end);
  if (first > last) throw new BadRequestException('dataInicio deve ser menor ou igual a dataFim.');
  // DATE inclusivo no contrato; consultas de timestamps usam [início, próximo dia).
  return { start: first, end: new Date(last.getTime() + 86400000) };
}
