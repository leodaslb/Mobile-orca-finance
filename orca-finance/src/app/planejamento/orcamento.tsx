import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, EmptyState, FinanceScreen, money, moneyDifference, Notice, Section, ui } from '@/components/common/FinanceScreen';
import { colors } from '@/theme';
import { AsyncState } from '@/components/common/AsyncState';
import { ProgressBar } from '@/components/common/ProgressBar';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getBudget, linkBudgetTransaction, setBudgetActive } from '@/services/budget.service';
import { getTransactions } from '@/services/transaction.service';
import { getTransactionCatalog } from '@/services/category.service';
import { centsToDecimal } from '@/utils/currency';
import { useAppSession } from '@/contexts/AppSessionContext';
import { budgetTypeLabels, displayDate } from '@/utils/planning-presentation';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BudgetDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { activeProfileId } = useAppSession();
  return <BudgetDetail key={`${activeProfileId}:${id}`} id={id} />;
}
function BudgetDetail({ id }: { id: string }) {
  const router = useRouter(); const [linking, setLinking] = useState(false);
  const mutation = useProfileMutation(); const resource = useProfileResource(useCallback(() => getBudget(id), [id]));
  const candidates = useProfileResource(useCallback(() => linking ? getTransactions() : Promise.resolve([]), [linking]));
  const catalog = useProfileResource(useCallback(getTransactionCatalog, []));
  const row = resource.data;
  const eligible = candidates.data?.filter(t => t.type === 'expense' && t.status === 'effective' && row && new Date(t.timestamp).toISOString().slice(0, 10) >= row.dataInicio && new Date(t.timestamp).toISOString().slice(0, 10) <= row.dataFim && !row.transacoesVinculadas?.some(x => x.id === t.id)) ?? [];
  return <FinanceScreen title={row?.nome ?? 'Detalhe do orçamento'} refresh={resource.reload} refreshing={resource.refreshing}>
    {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
    {row && <><View style={ui.split}><Badge label={budgetTypeLabels[row.tipo]} /><Badge label={row.ativo ? 'Ativo' : 'Inativo'} tone={row.ativo ? 'positive' : 'neutral'} /></View><Text style={ui.caption}>{displayDate(row.dataInicio)} a {displayDate(row.dataFim)}</Text><AppCard style={ui.card}>
      <Text style={ui.heading}>Realizado</Text><Text style={ui.amount}>{money(row.resumo.valorRealizado)}</Text><Text style={ui.caption}>Planejado: {money(row.resumo.valorPlanejado)}</Text>
      <Text style={ui.caption}>Desvio (realizado − planejado): {moneyDifference(row.resumo.valorRealizado, row.resumo.valorPlanejado)}</Text>
      <ProgressBar progress={(row.resumo.percentualConsumido ?? 0) / 100} color={row.resumo.estado === 'EXCEDIDO' ? colors.negative : row.resumo.estado === 'PROXIMO_LIMITE' ? colors.warning : colors.primary} /><Text style={ui.caption}>{row.resumo.percentualConsumido === null ? 'Percentual não calculável' : `${row.resumo.percentualConsumido}% consumido`}</Text></AppCard>
      {row.zeroBased && <AppCard style={ui.card}><Text style={ui.heading}>Distribuição da renda</Text><Text style={ui.caption}>Renda: {money(row.zeroBased.rendaPeriodo)}</Text><Text style={ui.caption}>Alocado: {money(row.zeroBased.totalAlocado)}</Text><Text style={ui.heading}>Diferença: {money(row.zeroBased.diferenca)}</Text><Text style={ui.caption}>{({ COMPLETO: 'Planejamento equilibrado', FALTA_ALOCAR: 'Ainda falta alocar renda', EXCEDIDO: 'Alocações acima da renda' })[row.zeroBased.status]}</Text></AppCard>}
      {row.zeroBased?.planejamentoIncompleto && <Notice tone="warning">Planejamento incompleto. Ajuste a distribuição para equilibrar a renda e as alocações.</Notice>}
      <Action label="Editar planejamento" onPress={() => router.push({ pathname: '/planejamento/orcamentos', params: { editId: id } })} />
      <Action secondary disabled={mutation.busy} label={row.ativo ? 'Desativar orçamento' : 'Ativar orçamento'} onPress={() => {
        const save = () => mutation.run(() => setBudgetActive(id, !row.ativo), resource.reload);
        if (!row.ativo) { void save(); return; }
        Alert.alert('Desativar orçamento?', 'O planejamento será mantido e poderá ser ativado novamente.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desativar', onPress: () => { void save(); } }]);
      }} />
      <Section title="Por categoria" description="Planejado e realizado no período deste orçamento.">
      {row.categorias.length === 0 && <EmptyState title="Sem categorias planejadas" description="Edite o planejamento para distribuir os valores." />}
      {row.categorias.map(c => <AppCard key={c.categoriaId} style={ui.card}><Text style={ui.heading}>{catalog.data?.categories.find(cat => cat.id === c.categoriaId)?.name ?? 'Categoria'}</Text><Text style={ui.caption}>{money(c.valorRealizado)} de {money(c.valorPlanejado)} planejados</Text><ProgressBar progress={(c.percentualConsumido ?? 0) / 100} accessibilityLabel="Consumo da categoria" color={(c.percentualConsumido ?? 0) > 100 ? colors.negative : colors.primary} /></AppCard>)}</Section>
      {['TEMPORARIO', 'EVENTO'].includes(row.tipo) && <><Text style={ui.heading}>Transações vinculadas</Text>
        {!row.transacoesVinculadas?.length && <EmptyState title="Nenhuma transação vinculada." description="Escolha uma despesa existente para acompanhar seu gasto neste orçamento." />}
        {row.transacoesVinculadas?.map(t => <AppCard key={t.id} style={ui.card}><Text style={ui.heading}>{t.descricao}</Text><Text style={ui.caption}>{money(t.valor)} · {t.status === 'EFETIVADA' ? 'Efetivada' : 'Prevista'}</Text><Action secondary disabled={mutation.busy} label="Remover vínculo" onPress={() => mutation.run(() => linkBudgetTransaction(id, t.id, false), resource.reload)} /></AppCard>)}
        <Action secondary label={linking ? 'Fechar seleção' : 'Vincular transação'} onPress={() => setLinking(v => !v)} />
        <Modal visible={linking} transparent animationType="slide" onRequestClose={() => { if (!mutation.busy) setLinking(false); }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#10202E66' }}><Pressable accessibilityRole="button" accessibilityLabel="Fechar seleção de transações" disabled={mutation.busy} onPress={() => setLinking(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%', padding: 16 }}><ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 14 }}><Text accessibilityRole="header" style={ui.heading}>Vincular despesa</Text><Text style={ui.caption}>Somente despesas efetivadas dentro do período entram no realizado. Vincular não cria transação.</Text>
          {(candidates.loading || candidates.error) && <AsyncState loading={candidates.loading} error={candidates.error} onRetry={candidates.reload} />}
          {!candidates.loading && !candidates.error && eligible.length === 0 && <EmptyState title="Nenhuma despesa disponível" description="Não há outras despesas efetivadas dentro deste período para vincular." />}
          {eligible.map(t => <Action secondary key={t.id} disabled={mutation.busy} label={`${t.description} · ${money(centsToDecimal(t.amountCents))}`} onPress={() => mutation.run(() => linkBudgetTransaction(id, t.id, true), () => { resource.reload(); setLinking(false); })} />)}
          {!!mutation.error && <Notice>{mutation.error}</Notice>}<Action secondary label="Fechar seleção" disabled={mutation.busy} onPress={() => setLinking(false)} /></ScrollView></SafeAreaView></View>
        </Modal>
      </>}
    </>}{!!mutation.error && <Notice>{mutation.error}</Notice>}
  </FinanceScreen>;
}
