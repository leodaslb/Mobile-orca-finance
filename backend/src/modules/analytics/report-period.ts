import { BadRequestException } from '@nestjs/common';

export function reportPeriod(start: string, end: string) {
  const date = (value: string) => {
    const result = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-') || !Number.isFinite(result.getTime())
      || result.toISOString().slice(0, 10) !== value) throw new BadRequestException('Data inválida.');
    return result;
  };
  const first = date(start);
  const last = date(end);
  if (first > last) throw new BadRequestException('startDate deve ser menor ou igual a endDate.');
  last.setUTCDate(last.getUTCDate() + 1);
  return { start: first, end: last };
}
