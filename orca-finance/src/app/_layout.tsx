import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal } from 'react-native';

import { LocalLockScreen } from '@/components/domain/LocalLockScreen';
import { PushNavigation } from '@/components/domain/PushNavigation';
import { AsyncState } from '@/components/common/AsyncState';
import { AppSessionProvider, useAppSession } from '@/contexts/AppSessionContext';
import { initializeServerSettings } from '@/services/server-settings.service';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [serverReady, setServerReady] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverAttempt, setServerAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setServerError('');
    initializeServerSettings().then(() => { if (mounted) setServerReady(true); })
      .catch(error => { if (mounted) setServerError(error.message); });
    return () => { mounted = false; };
  }, [serverAttempt]);
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }
  if (!serverReady) return <AsyncState loading={!serverError} error={serverError} onRetry={() => setServerAttempt(value => value + 1)} />;

  return <AppSessionProvider><RootNavigation /></AppSessionProvider>;
}

function RootNavigation() {
  const { account, activeProfileId, locked, securityReady, securityError, retryLocalSecurity } = useAppSession();
  if (!securityReady) return <AsyncState loading={!securityError} error={securityError} onRetry={retryLocalSecurity} />;

  return (
    <>
      <StatusBar style={locked ? 'light' : 'dark'} />

      <Stack
        screenOptions={{
          headerShown: false,
          statusBarStyle: 'dark',
        }}
      >
        <Stack.Protected guard={!account}><Stack.Screen name="index" /><Stack.Screen name="servidor" /></Stack.Protected>
        <Stack.Protected guard={!!account}>
          <Stack.Screen name="selecionar-perfil" options={{ statusBarStyle: 'light' }} />
        </Stack.Protected>
        <Stack.Protected guard={!!account && !!activeProfileId}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transacao/nova" />
          <Stack.Screen name="transacao/[id]" />
          <Stack.Screen name="metas/[id]" />
          <Stack.Screen name="metas/index" />
          <Stack.Screen name="metas/nova" />
          <Stack.Screen name="categorias/index" />
          <Stack.Screen name="planejamento/limites-alertas" />
          <Stack.Screen name="planejamento/gastos-livres" />
          <Stack.Screen name="planejamento/planejado-realizado" />
          <Stack.Screen name="reflexao/index" />
          <Stack.Screen name="recorrencias/index" />
          <Stack.Screen name="planejamento/orcamentos" />
          <Stack.Screen name="planejamento/orcamento" />
          <Stack.Screen name="planejamento/desafios" />
          <Stack.Screen name="planejamento/desafio" />
          <Stack.Screen name="planejamento/grandes-compras" />
          <Stack.Screen name="planejamento/simuladores" />
          <Stack.Screen name="relatorios/analises" />
          <Stack.Screen name="transacao/historico" />
          <Stack.Screen name="transacao/importar" />
          <Stack.Screen name="configuracoes/automacoes" />
        </Stack.Protected>
        <Stack.Protected guard={!!account}>
          <Stack.Screen name="configuracoes/index" />
          <Stack.Screen name="seguranca/index" />
          <Stack.Screen name="configuracoes/perfis" />
          <Stack.Screen name="configuracoes/notificacoes" />
        </Stack.Protected>
      </Stack>
      <PushNavigation />
      <Modal visible={!!account && locked} animationType="fade" onRequestClose={() => {}}>
        <LocalLockScreen />
      </Modal>
    </>
  );
}
