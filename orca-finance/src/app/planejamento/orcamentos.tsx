import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, Choices, DateField, EmptyState, Field, FinanceScreen, inputDate, money, moneyInput, Notice, ui } from '@/components/common/FinanceScreen';
import { ProgressBar } from '@/components/common/ProgressBar';
import { budgetTypeLabels, displayDate } from '@/utils/planning-presentation';
import { AsyncState } from '@/components/common/AsyncState';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getTransactionCatalog } from '@/services/category.service';
import { getBudgets, getBudget, getRegisteredBudgetIncome, saveBudget, type BudgetType } from '@/services/budget.service';
import { calendarPeriod, localDate, parseBrazilianDateToISO } from '@/utils/date';
import { decimalToCents, centsToDecimal, parseCurrencyToCents } from '@/utils/currency';
import { ApiError } from '@/services/api-client';
import { colors } from '@/theme';

export default function BudgetsRoute() { const { activeProfileId } = useAppSession(); return <Budgets key={activeProfileId} />; }
function Budgets() {
  const { editId, zero } = useLocalSearchParams<{ editId?: string; zero?: string }>();
  const router = useRouter(); const mutation = useProfileMutation();
  const [creating, setCreating] = useState(!!editId || !!zero);
  const [typeFilter, setTypeFilter] = useState<BudgetType | 'ALL'>('ALL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'true' | 'false'>('ALL');
  const resource = useProfileResource(useCallback(async () => ({ rows: await getBudgets({ type: typeFilter === 'ALL' ? undefined : typeFilter, active: activeFilter === 'ALL' ? undefined : activeFilter === 'true' }), catalog: await getTransactionCatalog(), original: editId ? await getBudget(editId) : null }), [editId, typeFilter, activeFilter]));
  return <FinanceScreen title="Orçamentos" subtitle="Planeje por período, evento ou distribua sua renda." refresh={resource.reload} refreshing={resource.refreshing}>
    {!creating && <><Choices label="Tipo de orçamento" value={typeFilter} onChange={setTypeFilter} options={[{ value: 'ALL', label: 'Todos' }, { value: 'MENSAL', label: 'Mensal' }, { value: 'PERIODO', label: 'Período' }, { value: 'TEMPORARIO', label: 'Temporário' }, { value: 'EVENTO', label: 'Evento' }, { value: 'ZERO_BASED', label: 'Orçamento zero' }]} />
      <Choices label="Situação" value={activeFilter} onChange={setActiveFilter} options={[{ value: 'ALL', label: 'Todas' }, { value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]} /></>}
    {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
    {resource.data && (creating ? <BudgetForm key={editId ?? zero ?? 'new'} original={resource.data.original} categories={resource.data.catalog.categories.filter(c => c.active || resource.data?.original?.categorias.some(r => r.categoriaId === c.id))}
      initialType={zero ? 'ZERO_BASED' : 'PERIODO'} busy={mutation.busy} onCancel={() => { if (editId) { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/planejamento/orcamento', params: { id: editId } }); } else setCreating(false); }} onSave={body => mutation.run(() => saveBudget(body, editId), saved => { setCreating(false); if (editId && router.canGoBack()) router.back(); else router.replace({ pathname: '/planejamento/orcamento', params: { id: saved.id } }); })} />
      : <><Action label="Novo orçamento" onPress={() => setCreating(true)} />
        {!resource.data.rows.length && <EmptyState title={typeFilter === 'ALL' && activeFilter === 'ALL' ? 'Nenhum orçamento. Comece seu planejamento.' : 'Nenhum orçamento para os filtros selecionados.'} description="Crie um planejamento ou ajuste os filtros para acompanhar seus gastos." />}
        {resource.data.rows.map(row => <AppCard key={row.id} style={ui.card}><View style={ui.split}><View style={{ flex: 1, gap: 4 }}><Text style={ui.heading}>{row.nome ?? budgetTypeLabels[row.tipo]}</Text><Text style={ui.caption}>{budgetTypeLabels[row.tipo]}</Text></View><Badge label={row.ativo ? 'Ativo' : 'Inativo'} tone={row.ativo ? 'positive' : 'neutral'} /></View><Text style={ui.caption}>{displayDate(row.dataInicio)} a {displayDate(row.dataFim)}</Text>
          <Text style={ui.amount}>{money(row.resumo.valorRealizado)}</Text><Text style={ui.caption}>de {money(row.resumo.valorPlanejado)} planejados</Text>
          <ProgressBar progress={(row.resumo.percentualConsumido ?? 0) / 100} accessibilityLabel="Consumo do orçamento" color={row.resumo.estado === 'EXCEDIDO' ? colors.negative : row.resumo.estado === 'PROXIMO_LIMITE' ? colors.warning : colors.primary} />
          <Action secondary label="Acompanhar" onPress={() => router.push({ pathname: '/planejamento/orcamento', params: { id: row.id } })} /></AppCard>)}</>)}
    {!!mutation.error && <Notice>{mutation.error}</Notice>}
  </FinanceScreen>;
}
function BudgetForm({ original, categories, initialType, busy, onSave, onCancel }: { original: Awaited<ReturnType<typeof getBudget>> | null; categories: { id: string; name: string }[]; initialType: BudgetType; busy: boolean; onSave: (b: Parameters<typeof saveBudget>[0]) => void; onCancel: () => void }) {
  const period = calendarPeriod(localDate().slice(0, 7));
  const [nome, setName] = useState(original?.nome ?? ''); const [tipo, setType] = useState<BudgetType>(original?.tipo ?? initialType);
  const [start, setStart] = useState((original?.dataInicio ?? period.startDate).split('-').reverse().join('/'));
  const [end, setEnd] = useState((original?.dataFim ?? period.endDate).split('-').reverse().join('/'));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((original?.categorias ?? []).map(c => [c.categoriaId, c.valorPlanejado.replace('.', ',')])));
  const [error, setError] = useState('');
  const total = Object.values(values).reduce((s, v) => s + (parseCurrencyToCents(v) ?? 0), 0);
  const income = useProfileResource(useCallback(() => {
    const a = parseBrazilianDateToISO(start), b = parseBrazilianDateToISO(end);
    return tipo === 'ZERO_BASED' && a && b && a <= b ? getRegisteredBudgetIncome(a, b) : Promise.resolve(null);
  }, [tipo, start, end]));
  return <><Text accessibilityRole="header" style={ui.heading}>{original ? 'Editar orçamento' : 'Novo orçamento'}</Text><Field label="Nome (opcional)" value={nome} onChange={setName} />
    {original ? <Text style={ui.caption}>Tipo: {budgetTypeLabels[tipo]}</Text> : <Choices label="Tipo" value={tipo} onChange={setType} options={[{ value: 'PERIODO', label: 'Período' }, { value: 'TEMPORARIO', label: 'Temporário' }, { value: 'EVENTO', label: 'Evento' }, { value: 'ZERO_BASED', label: 'Orçamento zero' }]} />}
    <DateField label="Início" value={start} onChange={setStart} /><DateField label="Fim" value={end} onChange={setEnd} />
    <Text style={ui.heading}>Planejado por categoria</Text><Text style={ui.caption}>Informe valores positivos. Deixe em branco para não alocar nessa categoria.</Text>{categories.map(c => <Field key={c.id} label={c.name} numeric value={values[c.id] ?? ''} onChange={v => setValues(s => ({ ...s, [c.id]: v }))} />)}
    <Text style={ui.heading}>Total alocado: {Number.isSafeInteger(total) ? money(centsToDecimal(total)) : 'Valor muito alto'}</Text>
    {tipo === 'ZERO_BASED' && <><Text style={ui.caption}>Renda: receitas efetivadas e previstas registradas, sem expandir recorrências futuras. Falta ou excesso não impede salvar.</Text>
      {(income.loading || income.error) && <AsyncState loading={income.loading} error={income.error} onRetry={income.reload} />}
      {income.data != null && Number.isSafeInteger(total) && <AppCard style={ui.card}><Text style={ui.heading}>Renda do período: {money(income.data)}</Text><Text style={ui.caption}>Alocado: {money(centsToDecimal(total))}</Text><Text style={ui.heading}>Diferença: {money(centsToDecimal(decimalToCents(income.data) - total))}</Text><Text style={ui.caption}>{decimalToCents(income.data) === total ? 'Planejamento equilibrado' : decimalToCents(income.data) > total ? 'Ainda falta alocar renda' : 'Alocações acima da renda'} · prévia, revalidada ao salvar</Text></AppCard>}
    </>}
    {tipo === 'ZERO_BASED' && income.data != null && decimalToCents(income.data) !== total && <Notice tone="warning">Planejamento incompleto. Revise a diferença; você pode salvar e ajustar depois.</Notice>}
    {!!error && <Notice>{error}</Notice>}<Action disabled={busy} label={busy ? 'Salvando…' : 'Salvar orçamento'} onPress={() => { try {
      if (!Number.isSafeInteger(total)) throw new ApiError(400, 'Total fora da precisão suportada.');
      const dataInicio = inputDate(start), dataFim = inputDate(end); if (dataFim < dataInicio) throw new ApiError(400, 'Fim deve ser posterior ao início.');
      setError(''); onSave({ nome: nome.trim() || null, tipo, dataInicio, dataFim, categorias: Object.entries(values).filter(([, v]) => v.trim()).map(([categoriaId, v]) => ({ categoriaId, valorPlanejado: moneyInput(v) })) });
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Confira os valores.'); } }} />
    {original?.zeroBased && <Text style={ui.caption}>Última renda consultada: {money(original.zeroBased.rendaPeriodo)}</Text>}
    <Action secondary disabled={busy} label={original ? 'Cancelar edição' : 'Cancelar criação'} onPress={onCancel} />
  </>;
}
