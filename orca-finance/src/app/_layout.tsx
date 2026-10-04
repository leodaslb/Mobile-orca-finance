import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Modal } from 'react-native';

import { LocalLockScreen } from '@/components/domain/LocalLockScreen';
import { AsyncState } from '@/components/common/AsyncState';
import { AppSessionProvider, useAppSession } from '@/contexts/AppSessionContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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
        <Stack.Protected guard={!account}><Stack.Screen name="index" /></Stack.Protected>
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
        </Stack.Protected>
        <Stack.Protected guard={!!account}>
          <Stack.Screen name="configuracoes/index" />
          <Stack.Screen name="seguranca/index" />
        </Stack.Protected>
      </Stack>
      <Modal visible={!!account && locked} animationType="fade" onRequestClose={() => {}}>
        <LocalLockScreen />
      </Modal>
    </>
  );
}
