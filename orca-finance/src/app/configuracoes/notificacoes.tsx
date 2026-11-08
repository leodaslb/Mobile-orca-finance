import { useState } from 'react';
import { Linking, Platform, Text } from 'react-native';
import { Action, FinanceScreen, Notice, ui } from '@/components/common/FinanceScreen';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { registerPush, deactivatePush } from '@/services/push.service';
import { AppCard } from '@/components/common/AppCard';
export default function PushSettings() {
  const { account } = useAppSession(); const mutation = useProfileMutation(); const [message, setMessage] = useState('');
  return <FinanceScreen title="Notificações" subtitle="Receba lembretes, alertas de limites e seu resumo semanal neste aparelho.">
    <Text style={ui.caption}>O registro vale para a conta e seus perfis. Os lembretes apenas sugerem revisar lançamentos; não confirmam que uma movimentação ocorreu.</Text>
    <AppCard style={ui.card}><Text style={ui.heading}>Lembretes de revisão</Text><Text style={ui.caption}>Um convite para conferir seus lançamentos, baseado no histórico de cada perfil.</Text></AppCard>
    <AppCard style={ui.card}><Text style={ui.heading}>Seu resumo semanal</Text><Text style={ui.caption}>Despesas da semana e acompanhamento dos orçamentos. Ao abrir o aviso, você será levado ao perfil correspondente.</Text></AppCard>
    <AppCard style={ui.card}><Text style={ui.heading}>Alertas de limites</Text><Text style={ui.caption}>Regras com Push ativo podem avisar quando o limite for atingido. Após o consumo sair da condição de alerta, uma nova violação pode gerar outro aviso.</Text></AppCard>
    <Action disabled={mutation.busy || !account} label="Permitir e registrar este aparelho" onPress={() => { setMessage(''); return mutation.run(() => registerPush(account!.id), () => setMessage('Aparelho registrado. A entrega depende da permissão e da configuração do serviço push.')); }} />
    <Action secondary disabled={mutation.busy || !account} label="Desativar neste aparelho" onPress={() => { setMessage(''); return mutation.run(() => deactivatePush(account!.id), deactivated => setMessage(deactivated ? 'Registro desativado no serviço. Você também pode revisar a permissão do sistema.' : 'Não há registro salvo neste aplicativo para desativar. Isso não confirma a situação de registros anteriores; revise também a permissão do sistema.')); }} />
    {Platform.OS !== 'web' && <Action secondary label="Abrir configurações do aparelho" onPress={() => { void Linking.openSettings().catch(() => setMessage('Abra as configurações do sistema e localize Orca Finance para revisar a permissão de notificações.')); }} />}
    {!!message && <AppCard style={ui.card}><Text accessibilityLiveRegion="polite" style={ui.caption}>{message}</Text></AppCard>}{!!mutation.error && <Notice>{mutation.error}</Notice>}
  </FinanceScreen>;
}
