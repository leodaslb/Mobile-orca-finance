import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, Choices, EmptyState, Field, FinanceScreen, money, ui } from '@/components/common/FinanceScreen';
import { useAppSession } from '@/contexts/AppSessionContext';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { getAudits } from '@/services/audit.service';
import { getTransactionCatalog } from '@/services/category.service';
import { colors } from '@/theme';
const labels: Record<string, string> = { descricao: 'Descrição', valor: 'Valor', tipo: 'Tipo', dataHora: 'Data', categoriaId: 'Categoria', subcategoriaId: 'Subcategoria', essencialidade: 'Essencialidade', status: 'Estado', anotacao: 'Anotação', metodoPagamento: 'Pagamento', ehGastoLivre: 'Gasto livre', tags: 'Tags' };
function value(key: string, v: unknown, catalog?: Awaited<ReturnType<typeof getTransactionCatalog>>) {
  if (v === null || v === undefined) return 'Não informado';
  if (key === 'valor' && typeof v === 'string') return money(v);
  if (key === 'dataHora' && typeof v === 'string') return new Date(v).toLocaleString('pt-BR');
  if (key === 'categoriaId') return catalog?.categories.find(c => c.id === v)?.name ?? `Categoria indisponível (${String(v).slice(0, 8)})`;
  if (key === 'subcategoriaId') return catalog?.subcategories.find(c => c.id === v)?.name ?? `Subcategoria indisponível (${String(v).slice(0, 8)})`;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  const enums: Record<string, string> = { RECEITA: 'Receita', DESPESA: 'Despesa', EFETIVADA: 'Efetivada', PREVISTA: 'Prevista', ESSENCIAL: 'Essencial', NAO_ESSENCIAL: 'Não essencial', NAO_CLASSIFICADA: 'Não classificada', CARTAO_DEBITO: 'Cartão de débito', CARTAO_CREDITO: 'Cartão de crédito', TRANSFERENCIA: 'Transferência', DINHEIRO: 'Dinheiro', PIX: 'Pix', OUTRO: 'Outro' };
  if (Array.isArray(v)) return v.map(x => typeof x === 'object' && x !== null && 'nome' in x ? String(x.nome) : String(x)).join(', ') || 'Nenhuma';
  return enums[String(v)] ?? String(v);
}
export default function AuditHistoryRoute() { const { activeProfileId } = useAppSession(); const { transactionId } = useLocalSearchParams<{ transactionId?: string }>(); return <AuditHistory key={`${activeProfileId}:${transactionId}`} />; }
function AuditHistory() {
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>(); const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState(transactionId ?? '');
  const [query, setQuery] = useState('');
  const resource = useProfileResource(useCallback(async () => ({ audits: await getAudits(transactionId), catalog: await getTransactionCatalog() }), [transactionId]));
  const originalId = (e: NonNullable<typeof resource.data>['audits'][number]) => String(e.transacaoId ?? e.estadoAnterior?.id ?? e.estadoNovo?.id ?? '');
  const options = new Map((resource.data?.audits ?? []).map(e => [originalId(e), String(e.estadoNovo?.descricao ?? e.estadoAnterior?.descricao ?? 'Transação')]));
  const visible = resource.data?.audits.filter(e => (!selected || originalId(e) === selected) && (!query.trim() || String(e.estadoNovo?.descricao ?? e.estadoAnterior?.descricao ?? '').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))));
  return <FinanceScreen title="Histórico de alterações" subtitle={transactionId ? 'Eventos desta transação, inclusive após reversão.' : 'Criações, edições e reversões do perfil.'} refresh={resource.reload} refreshing={resource.refreshing}>
    {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
    {!transactionId && !!resource.data?.audits.length && <><Field label="Buscar transação no histórico" value={query} onChange={setQuery} /><Choices label="Filtrar transação" value={selected} onChange={v => { setSelected(v); setExpanded(null); }} options={[{ value: '', label: 'Todas' }, ...[...options].filter(([id, label]) => id && (!query.trim() || label.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))).map(([value, label]) => ({ value, label }))]} /></>}
    {visible?.length === 0 && <EmptyState title="Nenhum evento encontrado." description="As alterações dos seus lançamentos aparecerão aqui." />}
    {visible?.map(e => <AppCard key={e.id} style={ui.card}><Badge label={({ CRIACAO: 'Criação', EDICAO: 'Edição', EXCLUSAO: 'Exclusão por reversão' })[e.operacao]} tone={e.operacao === 'EXCLUSAO' ? 'negative' : e.operacao === 'CRIACAO' ? 'positive' : 'neutral'} /><Text style={ui.caption}>{new Date(e.realizadoEm).toLocaleString('pt-BR')}</Text><Text style={ui.heading}>{String(e.estadoNovo?.descricao ?? e.estadoAnterior?.descricao ?? 'Transação')}</Text>
      <Action secondary label={expanded === e.id ? 'Recolher' : 'Ver alterações'} onPress={() => setExpanded(v => v === e.id ? null : e.id)} />
      {expanded === e.id && Object.entries(labels).filter(([key]) => key in (e.estadoAnterior ?? {}) || key in (e.estadoNovo ?? {})).filter(([key]) => e.operacao !== 'EDICAO' || JSON.stringify(e.estadoAnterior?.[key]) !== JSON.stringify(e.estadoNovo?.[key])).map(([key, label]) => <View key={key} style={{ gap: 4, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: colors.border }}><Text style={ui.heading}>{label}</Text>{e.estadoAnterior && <Text style={ui.caption}>Antes: {value(key, e.estadoAnterior[key], resource.data?.catalog)}</Text>}{e.estadoNovo && <Text style={ui.caption}>Depois: {value(key, e.estadoNovo[key], resource.data?.catalog)}</Text>}</View>)}
    </AppCard>)}
  </FinanceScreen>;
}
