import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, Field, FinanceScreen, money, Notice, Section, ui } from '@/components/common/FinanceScreen';
import { ProgressBar } from '@/components/common/ProgressBar';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getChallenge, getSuggestions, renameChallenge } from '@/services/challenge.service';
import { colors } from '@/theme';
import { useAppSession } from '@/contexts/AppSessionContext';
export default function ChallengeDetailRoute() {
  const { activeProfileId } = useAppSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChallengeDetail key={`${activeProfileId}:${id}`} id={id} />;
}
function ChallengeDetail({ id }: { id: string }) {
  const [nome, setName] = useState(''); const mutation = useProfileMutation();
  const resource = useProfileResource(useCallback(() => getChallenge(id), [id]));
  const suggestions = useProfileResource(useCallback(() => getSuggestions(id), [id])); const c = resource.data;
  return <FinanceScreen title={c?.nome ?? c?.categoriaNome ?? 'Desafio'} refresh={() => { resource.reload(); suggestions.reload(); }} refreshing={resource.refreshing || suggestions.refreshing}>
    {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
    {c && <><Badge label={c.status === 'CONCLUIDO' ? 'Concluído' : c.status === 'NAO_ATINGIDO' ? 'Meta não atingida' : 'Em andamento'} tone={c.status === 'CONCLUIDO' ? 'positive' : c.status === 'NAO_ATINGIDO' ? 'negative' : 'neutral'} /><Text style={ui.caption}>{c.categoriaNome} · {c.dataInicio} a {c.dataFim}</Text><AppCard style={ui.card}>
      <Text style={ui.heading}>Meta de gasto: {money(c.valorMeta)}</Text><Text style={ui.amount}>{money(c.valorGastoAtual)}</Text><Text style={ui.caption}>Gasto no período · referência aceita: {money(c.valorReferencia)}</Text>
      <ProgressBar progress={c.percentualPeriodoConsumido / 100} color={c.percentualPeriodoConsumido > 100 ? colors.negative : c.status === 'CONCLUIDO' ? colors.positive : colors.primary} /><Text style={ui.caption}>{c.percentualPeriodoConsumido}% da meta consumida · Redução: {c.percentualReducao}%</Text><Text style={ui.heading}>Disponível: {money(c.valorDisponivelAteMeta)}</Text><Text style={ui.caption}>{c.status === 'CONCLUIDO' ? 'Concluído' : c.status === 'NAO_ATINGIDO' ? 'Meta não atingida' : 'Em andamento — confira as datas do desafio'}</Text></AppCard>
      <Text style={ui.heading}>Orientações do seu histórico</Text>
      {(suggestions.loading || suggestions.error) && <AsyncState loading={suggestions.loading} error={suggestions.error} onRetry={suggestions.reload} />}
      {suggestions.data?.suggestions.map(s => <AppCard key={s.type} style={ui.card}><Text style={ui.caption}>{s.type === 'WEEKLY_TARGET' ? `Referência semanal aproximada: ${money(s.valorSemanalAproximado)}. É uma orientação, não um limite semanal.` : s.type === 'AVERAGE_TRANSACTION' ? `Média histórica por lançamento: ${money(s.valorMedioHistorico)}. Referência ajustada: ${money(s.valorMedioSugerido)}.` : `Revise “${s.descricao}”: ${money(s.valorTotal)}, ${s.participacaoPercentual}% do histórico da categoria.`}</Text></AppCard>)}
      {suggestions.data?.suggestions.length === 0 && <Text style={ui.caption}>Nenhuma orientação disponível neste momento.</Text>}
      <Section title="Personalizar o nome" description="Categoria, período e meta permanecem os mesmos."><Field label="Novo nome do desafio" value={nome} onChange={setName} /><Action secondary label="Renomear" disabled={mutation.busy || !nome.trim()} onPress={() => mutation.run(() => renameChallenge(id, nome.trim()), () => { setName(''); resource.reload(); })} /></Section>
    </>}{!!mutation.error && <Notice>{mutation.error}</Notice>}
  </FinanceScreen>;
}
