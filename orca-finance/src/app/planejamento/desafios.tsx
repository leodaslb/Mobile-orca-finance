import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useAppSession } from '@/contexts/AppSessionContext';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, EmptyState, FinanceScreen, money, Notice, ui } from '@/components/common/FinanceScreen';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { acceptChallenge, getCandidates, getChallenges, type Candidate } from '@/services/challenge.service';
export default function ChallengesRoute() { const { activeProfileId } = useAppSession(); return <Challenges key={activeProfileId} />; }
function Challenges() {
  const router = useRouter(); const mutation = useProfileMutation(); const [selected, setSelected] = useState<Candidate | null>(null);
  const resource = useProfileResource(useCallback(async () => ({ challenges: await getChallenges(), proposals: await getCandidates() }), []));
  const data = resource.data;
  const activeCategories = new Set(data?.challenges.filter(c => c.status === 'EM_ANDAMENTO').map(c => c.categoriaId));
  return <FinanceScreen title="Desafios de economia" subtitle="Reduza gastos essenciais com propostas baseadas no seu histórico. Um desafio ativo por categoria em cada perfil." refresh={resource.reload} refreshing={resource.refreshing}>
    {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
    {data && <><Text style={ui.sectionTitle}>Seus desafios</Text>{!data.challenges.length && <EmptyState title="Você ainda não aceitou um desafio." description="Confira as propostas do seu histórico para planejar o próximo mês." />}
      {activeCategories.size > 0 && <Text style={ui.caption}>Você pode acompanhar desafios de categorias diferentes ao mesmo tempo. Uma categoria com desafio ativo ou reservado só pode receber outro após o encerramento.</Text>}
      {data.challenges.map(c => <AppCard key={c.id} style={ui.card}><Badge label={c.status === 'CONCLUIDO' ? 'Concluído' : c.status === 'NAO_ATINGIDO' ? 'Meta não atingida' : 'Em andamento'} tone={c.status === 'CONCLUIDO' ? 'positive' : c.status === 'NAO_ATINGIDO' ? 'negative' : 'neutral'} /><Text style={ui.heading}>{c.nome ?? c.categoriaNome}</Text><Text style={ui.caption}>{c.categoriaNome} · {c.dataInicio} a {c.dataFim}</Text><Text style={ui.caption}>Meta de gasto: {money(c.valorMeta)} · Gasto atual: {money(c.valorGastoAtual)}</Text><Action secondary label="Acompanhar desafio" onPress={() => router.push({ pathname: '/planejamento/desafio', params: { id: c.id } })} /></AppCard>)}
      <Text style={ui.heading}>Propostas para o próximo mês</Text><Text style={ui.caption}>Referência: {data.proposals.baseline.startDate} a {data.proposals.baseline.endDate}</Text>
      {!data.proposals.candidates.length && <EmptyState title="Sem propostas elegíveis neste momento." description="As propostas dependem do orçamento mensal e das despesas registradas." />}
      {data.proposals.candidates.map(c => <AppCard key={c.categoriaId} style={ui.card}><Badge label="Proposta para o próximo mês" /><Text style={ui.heading}>{c.categoriaNome}</Text><Text style={ui.caption}>Planejado: {money(c.valorPlanejado)} · Realizado: {money(c.valorRealizado)}</Text><Text style={ui.caption}>Estouro: {c.percentualEstouro}% · Redução sugerida: {c.percentualReducaoSugerida}%</Text><Text style={ui.amount}>Meta: {money(c.valorMetaSugerido)}</Text><Action secondary label="Revisar proposta" onPress={() => setSelected(c)} />
        {selected?.categoriaId === c.categoriaId && <><Text style={ui.caption}>Período do desafio: {data.proposals.challengePeriod.startDate} a {data.proposals.challengePeriod.endDate}. O aceite fixa os valores recalculados pelo servidor. Cada categoria pode ter um desafio ativo neste perfil.</Text>{activeCategories.has(c.categoriaId) && <Text style={ui.caption}>Esta categoria já tem um desafio ativo ou reservado para começar.</Text>}<Action disabled={mutation.busy || activeCategories.has(c.categoriaId)} label="Aceitar desafio" onPress={() => { if (activeCategories.has(c.categoriaId)) return; return mutation.run(() => acceptChallenge(c.categoriaId), result => { setSelected(null); router.push({ pathname: '/planejamento/desafio', params: { id: result.id } }); resource.reload(); }); }} /><Action secondary disabled={mutation.busy} label="Cancelar revisão" onPress={() => setSelected(null)} /></>}</AppCard>)}
    </>}{!!mutation.error && <><Notice>{mutation.error}</Notice><Action secondary label="Atualizar desafios e propostas" onPress={() => { setSelected(null); resource.reload(); }} /></>}
  </FinanceScreen>;
}
