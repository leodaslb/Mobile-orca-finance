import { IconArrowLeft, IconPencil } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '@/components/common/AppCard';
import { AppSwitch } from '@/components/common/AppSwitch';
import { AsyncState } from '@/components/common/AsyncState';
import { RecurrenceConfigurationModal } from '@/components/domain/RecurrenceConfigurationModal';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { getRemoteRecurrences, getRemoteReminders, recurrenceConfiguration, updateRemoteRecurrence, updateRemoteReminder, type RemoteRecurrence, type RemoteReminder } from '@/services/recurrence.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { decimalToCents, formatCurrency } from '@/utils/currency';
import { formatDateInput, isValidTime, parseBrazilianDateToISO, timestampToLocal } from '@/utils/date';

export default function RecurrencesScreen() {
  const { activeProfileId } = useAppSession();
  return <RecurrencesContent key={activeProfileId} />;
}
function RecurrencesContent() {
  const router = useRouter();
  const resource = useProfileResource(useCallback(async () => {
    const [recurrences, reminders] = await Promise.all([getRemoteRecurrences(), getRemoteReminders()]); return { recurrences, reminders };
  }, []));
  const mutation = useProfileMutation();
  const [editing, setEditing] = useState<RemoteRecurrence | null>(null);
  const [reminder, setReminder] = useState<RemoteReminder | null>(null);
  const configuration = useMemo(() => editing ? recurrenceConfiguration(editing) : null, [editing]);
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.iconButton}><IconArrowLeft color={colors.textPrimary} /></Pressable><Text style={styles.title}>Recorrências e lembretes</Text><View style={styles.iconButton} /></View>
    <ScrollView refreshControl={<RefreshControl refreshing={resource.refreshing} onRefresh={resource.reload} />} contentContainerStyle={styles.content}>
      <Text style={styles.caption}>Configure ao criar uma transação. Alterações na recorrência afetam somente as próximas ocorrências.</Text>
      {(resource.loading || resource.error) && <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />}
      {resource.data && <>
        <Text style={styles.title}>Recorrências</Text>
        {!resource.data.recurrences.length && <Text style={styles.caption}>Nenhuma recorrência configurada.</Text>}
        {resource.data.recurrences.map(item => <AppCard key={item.id} style={styles.card}>
          <Text style={styles.title}>{item.descricao}</Text><Text style={styles.body}>{formatCurrency(decimalToCents(item.valor))} · {{ SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual' }[item.frequencia]}</Text>
          <Text style={styles.caption}>{item.ativa ? 'Ativa' : 'Desativada'} · Próxima: {new Date(item.proximaOcorrencia).toLocaleString('pt-BR')}</Text><Text style={styles.caption}>{item.dataTermino ? `Término: ${item.dataTermino.split('-').reverse().join('/')}` : 'Sem data de término'}</Text>
          <Pressable accessibilityRole="button" style={styles.action} onPress={() => setEditing(item)}><IconPencil size={18} color={colors.primary} /><Text style={styles.actionText}>Editar próximas ocorrências</Text></Pressable>
        </AppCard>)}
        <Text style={styles.title}>Lembretes</Text>
        {!resource.data.reminders.length && <Text style={styles.caption}>Nenhum lembrete configurado.</Text>}
        {resource.data.reminders.map(item => <AppCard key={item.id} style={styles.card}><Text style={styles.body}>{new Date(item.notificarEm).toLocaleString('pt-BR')}</Text><Text style={styles.caption}>{item.ativo ? 'Ativo' : 'Desativado'} · {item.recorrenciaId ? 'Vinculado à recorrência' : 'Vinculado à transação'}</Text>
          <Pressable accessibilityRole="button" style={styles.action} onPress={() => setReminder(item)}><IconPencil size={18} color={colors.primary} /><Text style={styles.actionText}>Editar lembrete</Text></Pressable>
          {item.transacaoId && <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.push({ pathname: '/transacao/[id]', params: { id: item.transacaoId! } })}><Text style={styles.actionText}>Ver transação</Text></Pressable>}
        </AppCard>)}
        <Text style={styles.caption}>Os horários são armazenados. A entrega de notificações ainda não está disponível.</Text>
      </>}
    </ScrollView>
    {editing && configuration && <RecurrenceConfigurationModal visible value={configuration} busy={mutation.busy} error={mutation.error} remindersAvailable={false} onCancel={() => setEditing(null)} onSave={configuration => { void mutation.run(() => updateRemoteRecurrence(editing, configuration), () => { setEditing(null); resource.reload(); }); }} />}
    {!!mutation.error && <View style={styles.errorBanner}><Text accessibilityRole="alert" style={styles.error}>{mutation.error}</Text></View>}
    {reminder && <ReminderForm key={reminder.id} item={reminder} onClose={() => setReminder(null)} onSaved={() => { setReminder(null); resource.reload(); }} />}
  </SafeAreaView>;
}
function ReminderForm({ item, onClose, onSaved }: { item: RemoteReminder; onClose: () => void; onSaved: () => void }) {
  const local = timestampToLocal(item.notificarEm);
  const [date, setDate] = useState(local.date.split('-').reverse().join('/'));
  const [time, setTime] = useState(local.time);
  const [active, setActive] = useState(item.ativo);
  const [error, setError] = useState('');
  const mutation = useProfileMutation();
  function save() {
    const parsed = parseBrazilianDateToISO(date);
    if (!parsed || !isValidTime(time)) { setError('Informe data e horário válidos.'); return; }
    setError(''); void mutation.run(() => updateRemoteReminder(item.id, { active,
      ...(parsed !== local.date || time !== local.time ? { date: parsed, time } : {}),
    }), onSaved);
  }
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!mutation.busy) onClose(); }}><View style={styles.overlay}><View style={styles.modal}>
    <Text style={styles.title}>Editar lembrete</Text>
    <TextInput accessibilityLabel="Data do lembrete" value={date} onChangeText={text => setDate(formatDateInput(text))} keyboardType="number-pad" maxLength={10} style={styles.input} />
    <TextInput accessibilityLabel="Horário do lembrete" value={time} onChangeText={setTime} maxLength={5} style={styles.input} />
    <View style={styles.header}><Text style={styles.body}>Lembrete ativo</Text><AppSwitch value={active} disabled={mutation.busy} onChange={setActive} accessibilityLabel="Lembrete ativo" /></View>
    {!!(error || mutation.error) && <Text accessibilityRole="alert" style={styles.error}>{error || mutation.error}</Text>}
    <Pressable accessibilityRole="button" disabled={mutation.busy} style={styles.save} onPress={save}><Text style={styles.saveText}>{mutation.busy ? 'Salvando…' : 'Salvar lembrete'}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={mutation.busy} style={styles.action} onPress={onClose}><Text style={styles.actionText}>Cancelar</Text></Pressable>
  </View></View></Modal>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 },
  card: { gap: spacing.sm },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  body: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textSecondary },
  action: { minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  actionText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary },
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(16,32,46,0.4)' },
  modal: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.sheet, backgroundColor: colors.surface },
  input: { minHeight: 44, paddingHorizontal: spacing.md, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.medium, color: colors.textPrimary },
  save: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  saveText: { fontFamily: fontFamily.bold, color: colors.surface },
  error: { fontFamily: fontFamily.regular, color: colors.negative },
  errorBanner: { padding: spacing.md, backgroundColor: colors.surface },
});
