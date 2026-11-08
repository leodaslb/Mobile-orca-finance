import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import { AppCard } from '@/components/common/AppCard';
import { Action, Badge, EmptyState, Field, FinanceScreen, Notice, Section, ui } from '@/components/common/FinanceScreen';
import { colors } from '@/theme';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { apiRequest, errorMessage } from '@/services/api-client';
import type { ApiProfile } from '@/services/auth.service';
export default function Profiles() {
  const { profiles, activeProfileId, setActiveProfile, refreshProfiles } = useAppSession(); const [nome, setName] = useState(''); const [editing, setEditing] = useState<string | null>(null); const mutation = useProfileMutation();
  const [loadError, setLoadError] = useState('');
  useFocusEffect(useCallback(() => { let mounted = true; setLoadError(''); void refreshProfiles().catch(e => { if (mounted) setLoadError(errorMessage(e)); }); return () => { mounted = false; }; }, [refreshProfiles]));
  return <FinanceScreen title="Perfis financeiros">
    <Text style={ui.caption}>Cada perfil mantém suas transações, orçamentos e análises separados.</Text>
    {!!loadError && <Notice>{loadError}</Notice>}
    <Action secondary disabled={mutation.busy} label="Atualizar perfis" onPress={() => mutation.run(() => refreshProfiles(), () => setLoadError(''))} />
    {!profiles.length && <EmptyState title="Seu primeiro perfil" description="Crie um perfil financeiro para começar a organizar seus lançamentos." />}
    {profiles.map(p => <AppCard style={[ui.card, p.id === activeProfileId && { borderColor: colors.primary }]} key={p.id}><View style={ui.split}><Text style={[ui.heading, { flex: 1 }]}>{p.nome}</Text><Badge label={p.id === activeProfileId ? 'Perfil ativo' : 'Disponível'} tone={p.id === activeProfileId ? 'positive' : 'neutral'} /></View><Text style={ui.caption}>Moeda: {p.moedaBase}</Text><Action secondary label="Selecionar perfil" disabled={mutation.busy || p.id === activeProfileId} onPress={() => { setActiveProfile(p.id); setEditing(null); setName(''); }} /><Action secondary label="Renomear" disabled={mutation.busy} onPress={() => { setEditing(p.id); setName(p.nome); }} /></AppCard>)}
    <Section title={editing ? 'Renomear perfil' : 'Novo perfil'}><Field label="Nome do perfil" value={nome} onChange={setName} />
    <Action label="Salvar perfil" disabled={mutation.busy || !nome.trim()} onPress={() => mutation.run(async () => { const result = await apiRequest<ApiProfile>(editing ? `/profiles/${encodeURIComponent(editing)}` : '/profiles', { method: editing ? 'PATCH' : 'POST', body: { nome: nome.trim() } }); await refreshProfiles(); return result; }, () => { setName(''); setEditing(null); })} />
    {editing && <Action secondary label="Cancelar renomeação" disabled={mutation.busy} onPress={() => { setName(''); setEditing(null); }} />}</Section>{!!mutation.error && <Notice>{mutation.error}</Notice>}
  </FinanceScreen>;
}
