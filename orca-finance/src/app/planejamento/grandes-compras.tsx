import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, DateField, Destination, EmptyState, Field, FinanceScreen, inputDate, money, moneyInput, Notice, ui } from '@/components/common/FinanceScreen';
import { displayDate } from '@/utils/planning-presentation';
import { AsyncState } from '@/components/common/AsyncState';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getPurchasePlans, savePurchasePlan, type PurchasePlan } from '@/services/planning-tools.service';
import { localDate } from '@/utils/date';
export default function PlansRoute() { const { activeProfileId } = useAppSession(); return <Plans key={activeProfileId} />; }
function Plans() {
  const resource = useProfileResource(useCallback(getPurchasePlans, [])); const mutation = useProfileMutation();
  const [editing, setEditing] = useState<PurchasePlan | 'new' | null>(null);
  return <FinanceScreen title="Grandes compras" subtitle="Planeje uma compra futura sem movimentar seu saldo." refresh={resource.reload} refreshing={resource.refreshing}>
    {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
    {editing ? <PlanForm key={editing === 'new' ? 'new' : editing.id} original={editing === 'new' ? null : editing} busy={mutation.busy}
      onSave={body => mutation.run(() => savePurchasePlan(body, editing === 'new' ? undefined : editing.id), () => { setEditing(null); resource.reload(); })} onCancel={() => setEditing(null)} />
      : <><Action label="Nova grande compra" onPress={() => setEditing('new')} />{resource.data?.length === 0 && <EmptyState title="Nenhum plano cadastrado." description="Organize uma compra futura sem alterar seu saldo." />}{resource.data?.map(p => <AppCard style={ui.card} key={p.id}><Badge label="Compra planejada" /><Text style={ui.heading}>{p.nome}</Text><Text style={ui.amount}>{money(p.valorTotal)}</Text><Text style={ui.caption}>Mensal: {p.valorMensalPlanejado === null ? 'Não informado' : money(p.valorMensalPlanejado)} · Início: {displayDate(p.dataInicio)}</Text><Text style={ui.caption}>{p.quantidadeMesesEstimada === null ? 'Prazo não calculado' : `${p.quantidadeMesesEstimada} meses estimados`}</Text><Action secondary label="Editar plano" onPress={() => setEditing(p)} /></AppCard>)}</>}
    {!!mutation.error && <Notice>{mutation.error}</Notice>}<Destination title="Avaliar impacto de uma compra" caption="Simulação separada do plano" href="/planejamento/simuladores" />
  </FinanceScreen>;
}
function PlanForm({ original, busy, onSave, onCancel }: { original: PurchasePlan | null; busy: boolean; onSave: (p: Omit<PurchasePlan, 'id' | 'quantidadeMesesEstimada'>) => void; onCancel: () => void }) {
  const [nome, setName] = useState(original?.nome ?? ''); const [total, setTotal] = useState(original?.valorTotal.replace('.', ',') ?? ''); const [monthly, setMonthly] = useState(original?.valorMensalPlanejado?.replace('.', ',') ?? ''); const [date, setDate] = useState((original?.dataInicio ?? localDate()).split('-').reverse().join('/')); const [error, setError] = useState('');
  return <><Field label="Nome" value={nome} onChange={setName} /><Field label="Valor total (R$)" numeric value={total} onChange={setTotal} /><Field label="Valor mensal planejado (opcional)" numeric value={monthly} onChange={setMonthly} /><DateField label="Início" value={date} onChange={setDate} />
    {!!error && <Notice>{error}</Notice>}<Action disabled={busy || !nome.trim()} label="Salvar plano" onPress={() => { try { setError(''); onSave({ nome: nome.trim(), valorTotal: moneyInput(total), valorMensalPlanejado: monthly.trim() ? moneyInput(monthly) : null, dataInicio: inputDate(date) }); } catch { setError('Confira os valores e a data.'); } }} /><Action secondary disabled={busy} label="Cancelar edição" onPress={onCancel} /></>;
}
