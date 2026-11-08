import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconArrowDownRight, IconArrowUpRight, IconEqual } from '@tabler/icons-react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Choices, DateField, Field, FinanceScreen, inputDate, money, moneyInput, Notice, ui } from '@/components/common/FinanceScreen';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { useAppSession } from '@/contexts/AppSessionContext';
import { getTransactionCatalog } from '@/services/category.service';
import { calculate, simulatePurchase, type Calculation, type PurchaseSimulation } from '@/services/planning-tools.service';
import { ApiError } from '@/services/api-client';
import { localDate } from '@/utils/date';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
export default function SimulatorsRoute() { const { activeProfileId } = useAppSession(); return <Simulators key={activeProfileId} />; }
function Simulators() {
  const [mode, setMode] = useState<'purchase' | 'compound-interest' | 'opportunity-cost'>('purchase');
  const [value, setValue] = useState(''); const [rate, setRate] = useState(''); const [periods, setPeriods] = useState('1');
  const [date, setDate] = useState(localDate().split('-').reverse().join('/')); const [category, setCategory] = useState('');
  const [result, setResult] = useState<Calculation | null>(null); const [purchase, setPurchase] = useState<PurchaseSimulation | null>(null);
  const formVersion = useRef(0);
  const invalidate = () => { formVersion.current++; setResult(null); setPurchase(null); };
  const mutation = useProfileMutation(); const resource = useProfileResource(useCallback(getTransactionCatalog, []));
  return <FinanceScreen title="Simuladores" subtitle="Explore possibilidades sem criar movimentações.">
    <Choices label="Simulação" value={mode} onChange={v => { invalidate(); setMode(v); }} options={[{ value: 'purchase', label: 'Compra' }, { value: 'compound-interest', label: 'Juros compostos' }, { value: 'opportunity-cost', label: 'Custo de oportunidade' }]} />
    {mode !== 'purchase' && <AppCard style={ui.card}><Text style={ui.heading}>{mode === 'compound-interest' ? 'Quanto seu capital pode render?' : 'E se você investisse em vez de gastar?'}</Text><Text style={ui.caption}>{mode === 'compound-interest' ? 'Simule a evolução de um capital com juros sobre o saldo acumulado a cada período.' : 'Compare um gasto hoje com o valor que esse dinheiro poderia alcançar em um investimento hipotético.'}</Text></AppCard>}
    <Field label={mode === 'purchase' ? 'Valor (R$)' : mode === 'compound-interest' ? 'Capital inicial (R$)' : 'Gasto que deseja comparar (R$)'} numeric value={value} onChange={v => { invalidate(); setValue(v); }} />
    <Field label={mode === 'purchase' ? 'Quantidade de parcelas' : 'Quantidade de períodos'} numeric value={periods} onChange={v => { invalidate(); setPeriods(v); }} />
    {mode === 'purchase' ? <><DateField label="Primeira parcela" value={date} onChange={v => { invalidate(); setDate(v); }} />{(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}<Choices label="Categoria para avaliar orçamento (opcional)" value={category} onChange={v => { invalidate(); setCategory(v); }} options={[{ value: '', label: 'Sem categoria' }, ...(resource.data?.categories.filter(c => c.active).map(c => ({ value: c.id, label: c.name })) ?? [])]} /></> : <><Field label={mode === 'compound-interest' ? 'Taxa de juros por período (%)' : 'Retorno hipotético por período (%)'} numeric value={rate} onChange={v => { invalidate(); setRate(v); }} /><Text style={ui.caption}>Use a mesma unidade para taxa e períodos. Exemplo: taxa mensal com quantidade de meses.</Text></>}
    <Action disabled={mutation.busy} label={mutation.busy ? 'Calculando…' : 'Simular'} onPress={() => { const sentVersion = formVersion.current; return mutation.run(async () => {
      const count = Number(periods); if (!periods.trim() || !Number.isSafeInteger(count) || count < (mode === 'purchase' ? 1 : 0) || (mode === 'purchase' && count > 1200)) throw new ApiError(400, 'Revise a quantidade de períodos.');
      if (mode === 'purchase') return { purchase: await simulatePurchase({ valor: moneyInput(value), parcelas: count, dataPrimeiraParcela: inputDate(date), ...(category && { categoriaId: category }) }) };
      const percentage = Number(rate.replace(',', '.')); if (!rate.trim() || !Number.isFinite(percentage) || percentage < -100) throw new ApiError(400, 'Informe uma taxa válida, a partir de -100%.');
      return { calculation: await calculate(mode, moneyInput(value, true), percentage, count) };
    }, r => { if (sentVersion !== formVersion.current) return; setPurchase(r.purchase ?? null); setResult(r.calculation ?? null); }); }} />
    {!!mutation.error && <Notice>{mutation.error}</Notice>}
    {result && mode !== 'purchase' && <CalculationResult mode={mode} result={result} initial={result.valorInicial ?? result.valorGastoHipotetico ?? moneyInput(value, true)} />}
    {purchase && <><Text style={ui.heading}>Impacto projetado · nenhuma transação criada</Text>
      <AppCard style={ui.card}><Text style={ui.amount}>{money(purchase.valorTotal)}</Text><Text style={ui.caption}>{purchase.quantidadeParcelas} parcelas mensais, sem juros. Os valores exatos de cada mês aparecem abaixo; centavos podem diferir entre parcelas.</Text></AppCard>
      {purchase.meses.map(m => <AppCard style={ui.card} key={m.competencia}><Text style={ui.heading}>{m.competencia} · {money(m.valorParcela)}</Text><Text style={ui.caption}>Renda projetada: {money(m.rendaProjetada)}</Text><Text style={ui.caption}>{m.percentualRendaComprometida === null ? 'Comprometimento não calculável: sem renda projetada no mês.' : `${m.percentualRendaComprometida}% da renda`}</Text>{m.impactoOrcamentoCategoria ? <><Text style={ui.caption}>Planejado: {money(m.impactoOrcamentoCategoria.valorPlanejado)} · Projetado com compra: {money(m.impactoOrcamentoCategoria.valorProjetadoComCompra)}</Text><Text style={ui.caption}>{m.impactoOrcamentoCategoria.percentualProjetado === null ? 'Percentual do orçamento não calculável.' : `${m.impactoOrcamentoCategoria.percentualProjetado}% do orçamento da categoria`}</Text></> : <Text style={ui.caption}>Sem orçamento aplicável à categoria.</Text>}</AppCard>)}</>}
  </FinanceScreen>;
}

function CalculationResult({ mode, result, initial }: { mode: 'compound-interest' | 'opportunity-cost'; result: Calculation; initial: string }) {
  const compound = mode === 'compound-interest';
  const rawDifference = result.jurosAcumulados ?? result.ganhoHipotetico ?? '0.00';
  const zero = /^-?0+(?:\.0+)?$/.test(rawDifference);
  const difference = zero ? '0.00' : rawDifference;
  const loss = !zero && difference.startsWith('-');
  const accent = zero ? colors.brand : loss ? colors.negative : colors.positive;
  const TrendIcon = zero ? IconEqual : loss ? IconArrowDownRight : IconArrowUpRight;
  const absoluteDifference = money(difference.replace(/^-/, ''));
  const explanation = zero ? 'Neste cenário, o valor inicial não teria ganho nem perda.'
    : loss ? `Com a taxa informada, a perda hipotética seria de ${absoluteDifference} no período.`
      : compound ? `Seu capital renderia ${absoluteDifference} além do valor inicial.`
        : `Ao investir em vez de gastar agora, o ganho hipotético seria de ${absoluteDifference} no período.`;
  return <View style={styles.result} accessibilityLiveRegion="polite">
    <Text accessibilityRole="header" style={ui.heading}>Resultado da simulação</Text>
    <AppCard style={[styles.differenceCard, { borderColor: accent, backgroundColor: !zero && !loss ? colors.positiveTint : colors.surface }]}>
      <View style={styles.resultHeader}>
        <Text style={[styles.stateLabel, { color: colors.textPrimary }]}>{zero ? 'Sem variação' : loss ? 'Perda simulada' : 'Ganho simulado'}</Text>
        <View style={styles.trendIcon}><TrendIcon size={25} color={accent} /></View>
      </View>
      <Text style={styles.differenceLabel}>{compound ? 'Rendimento acumulado' : 'Diferença em relação ao gasto hoje'}</Text>
      <Text style={[styles.differenceAmount, { color: accent }]}>{!zero && !loss ? '+' : ''}{money(difference)}</Text>
      <Text style={styles.explanation}>{explanation}</Text>
    </AppCard>
    <AppCard style={styles.comparisonCard}>
      <Text style={ui.heading}>{compound ? 'Do capital inicial ao saldo final' : 'Gastar hoje × investir no cenário'}</Text>
      <View style={styles.comparisonRow}><Text style={ui.caption}>{compound ? 'Capital inicial' : 'Gasto hoje · valor de referência'}</Text><Text style={styles.initialAmount}>{money(initial)}</Text></View>
      <View style={styles.divider} />
      <View style={styles.comparisonRow}><Text style={styles.finalLabel}>{compound ? 'Saldo final simulado' : 'Se o valor fosse investido'}</Text><Text style={styles.finalAmount}>{money(result.valorFuturo ?? result.valorFuturoHipotetico!)}</Text></View>
      <Text style={ui.caption}>O valor final inclui o principal e a diferença destacada acima.</Text>
    </AppCard>
    <Text style={ui.caption}>Simulação com taxa constante por período, sem movimentação financeira nem garantia de retorno.</Text>
  </View>;
}
const styles = StyleSheet.create({
  result: { gap: spacing.md, paddingTop: spacing.sm },
  differenceCard: { gap: spacing.sm, borderWidth: 1, borderLeftWidth: 5 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stateLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.body, flex: 1 },
  trendIcon: { width: 40, height: 40, borderRadius: radius.icon, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  differenceLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  differenceAmount: { fontFamily: fontFamily.bold, fontSize: fontSize.display, lineHeight: 44 },
  explanation: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 22, color: colors.textPrimary },
  comparisonCard: { gap: spacing.md },
  comparisonRow: { gap: spacing.xs },
  initialAmount: { fontFamily: fontFamily.medium, fontSize: 20, color: colors.textSecondary },
  finalLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  finalAmount: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 36, color: colors.brand },
  divider: { height: 1, backgroundColor: colors.border },
});
