import { detectTransactionReminders, rankTransactionReminders, ReminderMovement } from '../src/modules/notifications/transaction-reminder-detector';
const day = new Date('2026-10-15T00:00:00Z');
function past(weeks: number[], hour = 10, category = 'c'): ReminderMovement[] {
  return weeks.map(w => ({ dataHora: new Date(day.getTime() - w * 7 * 86400000 + hour * 3600000), categoria: { id: category, nome: category } }));
}
describe('RF09 → US16 → RN-NOT-03: detector sem persistir padrões', () => {
  it('três semanas distintas qualificam; muitas transações em uma ou duas não', () => {
    expect(detectTransactionReminders('p', past([1, 2, 3]), day, new Date('2026-10-15T11:00:00Z'))).toMatchObject([{ recurringWeeks: 3, hour: 10, profileId: 'p', referenceDate: '2026-10-15' }]);
    expect(detectTransactionReminders('p', past(Array(100).fill(1).concat([2])), day, new Date('2026-10-15T12:00:00Z'))).toEqual([]);
  });
  it('conta oito semanas no máximo, inclui limite de 56 dias e exclui semana nove', () => {
    const result = detectTransactionReminders('p', past([1, 8, 9]), day, new Date('2026-10-15T11:00:00Z')); expect(result).toEqual([]);
    expect(detectTransactionReminders('p', past([1, 7, 8]), day, new Date('2026-10-15T11:00:00Z'))[0].recurringWeeks).toBe(3);
  });
  it('categoria e dia da semana não são somados entre si; sem categoria é ignorada', () => {
    const rows = [...past([1, 2]), ...past([3], 10, 'other'), { ...past([3])[0], dataHora: new Date('2026-09-23T10:00:00Z') }, { ...past([4])[0], categoria: null }];
    expect(detectTransactionReminders('p', rows, day, new Date('2026-10-15T11:00:00Z'))).toEqual([]);
  });
  it('não usa o dia atual para aprender um padrão nem avisa antes do fim da faixa', () => {
    expect(detectTransactionReminders('p', [...past([1, 2]), ...past([0])], day, new Date('2026-10-15T12:00:00Z'))).toEqual([]);
    expect(detectTransactionReminders('p', past([1, 2, 3]), day, new Date('2026-10-15T10:59:59.999Z'))).toEqual([]);
    expect(detectTransactionReminders('p', past([1, 2, 3]), day, new Date('2026-10-15T11:00:00Z'))).toHaveLength(1);
  });
  it('movimento correspondente satisfaz janela; outra categoria ou outra hora não', () => {
    const history = past([1, 2, 3]);
    expect(detectTransactionReminders('p', [...history, ...past([0])], day, new Date('2026-10-15T12:00:00Z'))).toEqual([]);
    expect(detectTransactionReminders('p', [...history, ...past([0], 9), ...past([0], 10, 'other')], day, new Date('2026-10-15T12:00:00Z'))).toHaveLength(1);
  });
  it('sem horário recorrente, só avalia após fechar o dia e qualquer hora da categoria o satisfaz', () => {
    const history = [...past([1], 8), ...past([2], 12), ...past([3], 16)];
    expect(detectTransactionReminders('p', history, day, new Date('2026-10-15T23:59:59.999Z'))).toEqual([]);
    expect(detectTransactionReminders('p', history, day, new Date('2026-10-16T00:00:00Z'))).toMatchObject([{ recurringWeeks: 3, hour: null }]);
    expect(detectTransactionReminders('p', [...history, ...past([0], 23)], day, new Date('2026-10-16T00:00:00Z'))).toEqual([]);
  });
  it('escolhe faixa mais recorrente e, no empate, mais recente; um evento por categoria/dia', () => {
    const rows = [...past([1, 2, 3], 10), ...past([1, 2, 3, 4], 14)];
    const result = detectTransactionReminders('p', rows, day, new Date('2026-10-15T15:00:00Z')); expect(result).toHaveLength(1); expect(result[0].hour).toBe(14);
    const tied = detectTransactionReminders('p', [...past([1, 2, 3], 10), ...past([1, 2, 3], 14)], day, new Date('2026-10-15T15:00:00Z'));
    expect(tied[0].hour).toBe(14); expect(tied[0].eventKey).toBe(result[0].eventKey);
  });
  it('prioriza semanas, depois data recente e desempate determinístico, sem alterar entrada', () => {
    const weak = detectTransactionReminders('a', past([1, 2, 3]), day, new Date('2026-10-15T11:00:00Z'))[0];
    const strong = detectTransactionReminders('b', past([1, 2, 3, 4]), day, new Date('2026-10-15T11:00:00Z'))[0];
    const stale = { ...weak, profileId: 'c', mostRecent: new Date('2026-10-01T10:00:00Z') };
    const input = [stale, weak, strong]; expect(rankTransactionReminders(input)).toEqual([strong, weak, stale]); expect(input[0]).toBe(stale);
  });
  it('faixa orienta o momento, sem perder as semanas do padrão categoria/dia na prioridade', () => {
    const rows = [...past([1, 2, 3], 10), ...past([4, 5, 6], 14)];
    expect(detectTransactionReminders('p', rows, day, new Date('2026-10-15T15:00:00Z'))).toMatchObject([{ recurringWeeks: 6, hour: 10, mostRecent: new Date('2026-10-08T10:00:00Z') }]);
  });
});
