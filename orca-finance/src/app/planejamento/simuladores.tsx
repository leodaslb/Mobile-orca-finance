import { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
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
    <Field label="Valor (R$)" numeric value={value} onChange={v => { invalidate(); setValue(v); }} />
    <Field label={mode === 'purchase' ? 'Quantidade de parcelas' : 'Quantidade de períodos'} numeric value={periods} onChange={v => { invalidate(); setPeriods(v); }} />
    {mode === 'purchase' ? <><DateField label="Primeira parcela" value={date} onChange={v => { invalidate(); setDate(v); }} />{(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}<Choices label="Categoria para avaliar orçamento (opcional)" value={category} onChange={v => { invalidate(); setCategory(v); }} options={[{ value: '', label: 'Sem categoria' }, ...(resource.data?.categories.filter(c => c.active).map(c => ({ value: c.id, label: c.name })) ?? [])]} /></> : <Field label="Taxa percentual por período" numeric value={rate} onChange={v => { invalidate(); setRate(v); }} />}
    <Action disabled={mutation.busy} label={mutation.busy ? 'Calculando…' : 'Simular'} onPress={() => { const sentVersion = formVersion.current; return mutation.run(async () => {
      const count = Number(periods); if (!periods.trim() || !Number.isSafeInteger(count) || count < (mode === 'purchase' ? 1 : 0) || (mode === 'purchase' && count > 1200)) throw new ApiError(400, 'Revise a quantidade de períodos.');
      if (mode === 'purchase') return { purchase: await simulatePurchase({ valor: moneyInput(value), parcelas: count, dataPrimeiraParcela: inputDate(date), ...(category && { categoriaId: category }) }) };
      const percentage = Number(rate.replace(',', '.')); if (!rate.trim() || !Number.isFinite(percentage) || percentage < -100) throw new ApiError(400, 'Informe uma taxa válida, a partir de -100%.');
      return { calculation: await calculate(mode, moneyInput(value, true), percentage, count) };
    }, r => { if (sentVersion !== formVersion.current) return; setPurchase(r.purchase ?? null); setResult(r.calculation ?? null); }); }} />
    {!!mutation.error && <Notice>{mutation.error}</Notice>}
    {result && <AppCard style={ui.card}><Text style={ui.heading}>Valor futuro hipotético</Text><Text style={ui.amount}>{money(result.valorFuturo ?? result.valorFuturoHipotetico!)}</Text><Text style={ui.caption}>Ganho ou perda: {money(result.jurosAcumulados ?? result.ganhoHipotetico!)}</Text><Text style={ui.caption}>Resultado hipotético com a taxa por período informada, sem movimentação financeira.</Text></AppCard>}
    {purchase && <><Text style={ui.heading}>Impacto projetado · nenhuma transação criada</Text>
      <AppCard style={ui.card}><Text style={ui.amount}>{money(purchase.valorTotal)}</Text><Text style={ui.caption}>{purchase.quantidadeParcelas} parcelas mensais, sem juros. Os valores exatos de cada mês aparecem abaixo; centavos podem diferir entre parcelas.</Text></AppCard>
      {purchase.meses.map(m => <AppCard style={ui.card} key={m.competencia}><Text style={ui.heading}>{m.competencia} · {money(m.valorParcela)}</Text><Text style={ui.caption}>Renda projetada: {money(m.rendaProjetada)}</Text><Text style={ui.caption}>{m.percentualRendaComprometida === null ? 'Comprometimento não calculável: sem renda projetada no mês.' : `${m.percentualRendaComprometida}% da renda`}</Text>{m.impactoOrcamentoCategoria ? <><Text style={ui.caption}>Planejado: {money(m.impactoOrcamentoCategoria.valorPlanejado)} · Projetado com compra: {money(m.impactoOrcamentoCategoria.valorProjetadoComCompra)}</Text><Text style={ui.caption}>{m.impactoOrcamentoCategoria.percentualProjetado === null ? 'Percentual do orçamento não calculável.' : `${m.impactoOrcamentoCategoria.percentualProjetado}% do orçamento da categoria`}</Text></> : <Text style={ui.caption}>Sem orçamento aplicável à categoria.</Text>}</AppCard>)}</>}
  </FinanceScreen>;
}
