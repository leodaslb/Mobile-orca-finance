import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, Choices, EmptyState, FinanceScreen, Notice, ui } from '@/components/common/FinanceScreen';
import { AsyncState } from '@/components/common/AsyncState';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getAutomations, saveAutomation, type Automation } from '@/services/planning-tools.service';
import { getTransactionCatalog } from '@/services/category.service';
const essentialities = [{ value: 'ESSENCIAL', label: 'Essencial' }, { value: 'NAO_ESSENCIAL', label: 'Não essencial' }, { value: 'NAO_CLASSIFICADA', label: 'Não classificada' }] as const;
export default function AutomationsRoute() { const { activeProfileId } = useAppSession(); return <Automations key={activeProfileId} />; }
function Automations() {
  const resource = useProfileResource(useCallback(async () => ({ rules: await getAutomations(), catalog: await getTransactionCatalog() }), [])); const mutation = useProfileMutation();
  const [edit, setEdit] = useState<Automation | 'new' | null>(null); const data = resource.data;
  return <FinanceScreen title="Automações" subtitle="Classifique novas despesas. O histórico permanece preservado." refresh={resource.reload} refreshing={resource.refreshing}>
    {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
    {data && (edit ? <AutomationForm key={edit === 'new' ? 'new' : edit.id} initial={edit === 'new' ? null : edit} catalog={data.catalog} busy={mutation.busy} onSave={body => mutation.run(() => saveAutomation(body, edit === 'new' ? undefined : edit.id), () => { setEdit(null); resource.reload(); })} onCancel={() => setEdit(null)} />
      : <><Action label="Nova automação" onPress={() => setEdit('new')} />{data.rules.length === 0 && <EmptyState title="Nenhuma automação configurada." description="Defina a essencialidade das novas despesas por categoria ou subcategoria." />}{data.rules.map(r => <AppCard key={r.id} style={ui.card}><Badge label={r.ativa ? 'Ativa' : 'Inativa'} tone={r.ativa ? 'positive' : 'neutral'} /><Text style={ui.heading}>{data.catalog.categories.find(c => c.id === r.categoriaId)?.name ?? data.catalog.subcategories.find(c => c.id === r.subcategoriaId)?.name ?? 'Escopo indisponível'}</Text><Text style={ui.caption}>Essencialidade → {essentialities.find(e => e.value === r.valorDestino)?.label}</Text><Action secondary label="Editar regra" onPress={() => setEdit(r)} /></AppCard>)}</>)}
    {!!mutation.error && <Notice>{mutation.error}</Notice>}
  </FinanceScreen>;
}
function AutomationForm({ initial, catalog, busy, onSave, onCancel }: { initial: Automation | null; catalog: Awaited<ReturnType<typeof getTransactionCatalog>>; busy: boolean; onSave: (v: Omit<Automation, 'id'>) => void; onCancel: () => void }) {
  const [scope, setScope] = useState(initial?.subcategoriaId ? 'sub' : 'cat'); const [id, setId] = useState(initial?.categoriaId ?? initial?.subcategoriaId ?? ''); const [value, setValue] = useState<Automation['valorDestino']>(initial?.valorDestino ?? 'ESSENCIAL'); const [active, setActive] = useState(String(initial?.ativa ?? true));
  return <><Choices label="Escopo" value={scope} onChange={v => { setScope(v); setId(''); }} options={[{ value: 'cat', label: 'Categoria' }, { value: 'sub', label: 'Subcategoria' }]} /><Choices label="Aplicar em" value={id} onChange={setId} options={(scope === 'cat' ? catalog.categories : catalog.subcategories).filter(c => c.active || c.id === id).map(c => ({ value: c.id, label: c.name }))} /><Choices label="Essencialidade" value={value} onChange={setValue} options={essentialities} /><Choices label="Estado" value={active} onChange={setActive} options={[{ value: 'true', label: 'Ativa' }, { value: 'false', label: 'Inativa' }]} /><Text style={ui.caption}>Salvar ativa substitui outra regra ativa do mesmo escopo e atributo. Subcategoria tem prioridade; escolha manual na transação prevalece.</Text><Action disabled={busy || !id} label="Salvar regra" onPress={() => onSave({ categoriaId: scope === 'cat' ? id : null, subcategoriaId: scope === 'sub' ? id : null, atributoAlvo: 'essencialidade', valorDestino: value, ativa: active === 'true' })} /><Action secondary disabled={busy} label="Cancelar" onPress={onCancel} /></>;
}
