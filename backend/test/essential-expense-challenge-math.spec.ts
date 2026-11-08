import { Prisma } from '../src/generated/prisma/client';
import { challengeProposal, challengeProgress, rankChallengeCandidates } from '../src/modules/essential-expense-challenges/challenge-math';
import { challengeSuggestions } from '../src/modules/essential-expense-challenges/challenge-suggestions';
const D = (v: string | number) => new Prisma.Decimal(v);

describe('RF65 → US59 → RN-DES-02: redução progressiva', () => {
  it.each([['1000', '900'], ['1000', '1000'], ['1000', '1049.99'], ['0', '100']])('não oferece candidato para planejado=%s, realizado=%s', (planned, actual) => {
    expect(challengeProposal(D(planned), D(actual))).toBeNull();
  });
  it.each([['1050', '1000.00', '4.7619'], ['1200', '1000.00', '16.6667'], ['1250', '1000.00', '20.0000'], ['2000', '1600.00', '20.0000'], ['5000', '4000.00', '20.0000']])('realizado=%s gera meta=%s e redução=%s', (actual, target, reduction) => {
    const result = challengeProposal(D(1000), D(actual))!;
    expect(result.target.toFixed(2)).toBe(target); expect(result.suggested.toFixed(4)).toBe(reduction);
  });
  it('não arredonda o estouro antes do limiar e calcula meta em centavos', () => {
    expect(challengeProposal(D(10000), D('10499.99'))).toBeNull();
    expect(challengeProposal(D(1), D('2.03'))!.target.toFixed(2)).toBe('1.62');
  });
  it('mantém status durante todo o último dia; igualdade final cumpre meta e excesso não', () => {
    const end = new Date('2026-11-30Z');
    expect(challengeProgress(D(1400), D(1120), D(700), end, new Date('2026-11-30T23:59:59.999Z'))).toEqual({
      valorReferencia: '1400.00', valorMeta: '1120.00', valorGastoAtual: '700.00', valorDisponivelAteMeta: '420.00', percentualPeriodoConsumido: 62.5, status: 'EM_ANDAMENTO' });
    expect(challengeProgress(D(1400), D(1120), D(1120), end, new Date('2026-12-01Z')).status).toBe('CONCLUIDO');
    expect(challengeProgress(D(1400), D(1120), D('1120.01'), end, new Date('2026-12-01Z'))).toMatchObject({ status: 'NAO_ATINGIDO', valorDisponivelAteMeta: '-0.01' });
  });
  it('sugestões de semana aproximada, média e descrição de maior peso usam somente histórico fornecido', () => {
    const result = challengeSuggestions(D(1000), D(800), [{ descricao: ' Delivery ', valor: D(400) }, { descricao: 'delivery', valor: D(300) }, { descricao: 'Mercado', valor: D(300) }]);
    expect(result).toHaveLength(3); expect(result[0]).toMatchObject({ type: 'WEEKLY_TARGET', valorSemanalAproximado: '200.00' });
    expect(result[1]).toMatchObject({ type: 'AVERAGE_TRANSACTION', valorMedioHistorico: '333.33', valorMedioSugerido: '266.67' });
    expect(result[2]).toMatchObject({ type: 'HIGH_IMPACT_DESCRIPTION', valorTotal: '700.00', quantidadeTransacoes: 2, participacaoPercentual: 70 });
  });
  it('sem histórico atual disponível mantém somente orientação semanal da meta aceita', () => {
    expect(challengeSuggestions(D(1000), D(800), [])).toEqual([{ type: 'WEEKLY_TARGET', valorSemanalAproximado: '200.00', semanasAproximadas: 4 }]);
  });
  it('limita três candidatos por percentual, excedente e id determinístico sem alterar a entrada', () => {
    const candidates = [
      { categoriaId: 'c', overspend: D(20), excess: D(40) }, { categoriaId: 'b', overspend: D(30), excess: D(30) },
      { categoriaId: 'a', overspend: D(30), excess: D(30) }, { categoriaId: 'd', overspend: D(30), excess: D(40) },
    ];
    expect(rankChallengeCandidates(candidates).map(c => c.categoriaId)).toEqual(['d', 'a', 'b']);
    expect(candidates.map(c => c.categoriaId)).toEqual(['c', 'b', 'a', 'd']);
  });
});
