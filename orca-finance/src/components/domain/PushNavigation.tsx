import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAppSession } from '@/contexts/AppSessionContext';
import { parsePushContext, type PushContext } from '@/services/push.service';
export function PushNavigation() {
  const session = useAppSession(); const router = useRouter();
  const [pending, setPending] = useState<PushContext | null>(null); const seen = useRef(new Set<string>());
  const [verified, setVerified] = useState<string | null>(null);
  const verificationKey = pending && session.account ? `${session.account.id}:${pending.profileId}:${pending.type}` : null;
  useEffect(() => {
    if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return;
    let mounted = true; let cleanup: (() => void) | undefined;
    void import('expo-notifications').then(async notifications => {
      if (!mounted) return;
      const receive = (response: import('expo-notifications').NotificationResponse) => {
        const id = response.notification.request.identifier;
        if (seen.current.has(id)) return;
        seen.current.add(id); if (seen.current.size > 100) seen.current.delete(seen.current.values().next().value!);
        const context = parsePushContext(response.notification.request.content.data ?? {});
        if (context && mounted) { setVerified(null); setPending(context); }
        void notifications.clearLastNotificationResponseAsync().catch(() => { /* Falha de limpeza não repete a navegação nem expõe detalhes do SDK. */ });
      };
      notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
      let liveReceived = false;
      const subscription = notifications.addNotificationResponseReceivedListener(response => { liveReceived = true; receive(response); }); cleanup = () => subscription.remove();
      const last = await notifications.getLastNotificationResponseAsync(); if (last && mounted && !liveReceived) receive(last);
    }).catch(() => { /* Builds sem suporte nativo continuam utilizáveis sem push. */ });
    return () => { mounted = false; cleanup?.(); };
  }, []);
  useEffect(() => {
    if (!pending || !session.account || session.locked) return;
    let mounted = true;
    void session.refreshProfiles().then(() => { if (mounted) setVerified(`${session.account!.id}:${pending.profileId}:${pending.type}`); })
      .catch(() => { if (mounted) { setPending(null); Alert.alert('Não foi possível abrir o aviso', 'Entre novamente ou consulte seus perfis e lançamentos para revisar a notificação.'); } });
    return () => { mounted = false; };
  }, [pending, session.account?.id, session.locked, session.refreshProfiles]);
  useEffect(() => {
    if (!pending || !session.account || !session.activeProfileId || session.locked || verified !== verificationKey) return;
    if (!session.profiles.some(p => p.id === pending.profileId)) { setPending(null); Alert.alert('Perfil indisponível', 'Esta notificação pertence a um perfil que não está disponível nesta conta.'); return; }
    if (session.activeProfileId !== pending.profileId) { session.setActiveProfile(pending.profileId); return; }
    setPending(null);
    if (pending.type === 'TRANSACTION_REMINDER') router.push({ pathname: '/transacao/nova', params: { reminderCategoryId: pending.categoriaId, referenceDate: pending.referenceDate } });
    else if (pending.type === 'WEEKLY_SUMMARY') router.push({ pathname: '/relatorios/analises', params: { mode: 'weekly', periodStart: pending.periodStart, periodEnd: pending.periodEnd } });
    else router.push('/planejamento/limites-alertas');
  }, [pending, session, router, verified, verificationKey]);
  return null;
}
