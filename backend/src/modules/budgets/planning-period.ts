import { BadRequestException } from '@nestjs/common';
import { PeriodoRegra } from '../../generated/prisma/client';

function midnight(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function monthlyPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new BadRequestException('Ano deve estar entre 1 e 9999 e mês entre 1 e 12.');
  }
  return { start: midnight(year, month - 1, 1), end: midnight(year, month, 1) };
}

export function rulePeriod(periodo: PeriodoRegra, reference: Date) {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const start = midnight(year, month, reference.getUTCDate());
  if (periodo === PeriodoRegra.MENSAL) return monthlyPeriod(year, month + 1);
  if (periodo === PeriodoRegra.ANUAL) return { start: midnight(year, 0, 1), end: midnight(year + 1, 0, 1) };
  if (periodo === PeriodoRegra.SEMANAL) start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (periodo === PeriodoRegra.SEMANAL ? 7 : 1));
  return { start, end };
}
