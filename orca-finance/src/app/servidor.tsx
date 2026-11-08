import { IconArrowLeft, IconServer } from '@tabler/icons-react-native';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/common/KeyboardLayout';
import { Action, Notice, ui } from '@/components/common/FinanceScreen';
import { useAppSession } from '@/contexts/AppSessionContext';
import { errorMessage, getApiServerURL } from '@/services/api-client';
import { saveServerSettings, testServerConnection } from '@/services/server-settings.service';
import { colors, radius, spacing } from '@/theme';

export default function ServerScreen() {
  const router = useRouter();
  const { account } = useAppSession();
  const [address, setAddress] = useState(getApiServerURL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (account) return <Redirect href="/selecionar-perfil" />;
  async function save(restore = false) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const next = restore ? null : await testServerConnection(address);
      if (!mounted.current) return;
      await saveServerSettings(next);
      if (mounted.current) router.replace('/');
    } catch (caught) { if (mounted.current) setError(errorMessage(caught)); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  return <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
    <View style={ui.header}>
      <Pressable style={ui.back} accessibilityRole="button" accessibilityLabel="Voltar" disabled={busy} onPress={() => router.replace('/')}><IconArrowLeft size={23} color={colors.textPrimary} /></Pressable>
      <Text style={ui.title}>Servidor</Text><View style={ui.headerSpacer} />
    </View>
    <FormScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.icon}><IconServer size={28} color={colors.primary} /></View>
        <Text style={ui.heading}>Conecte ao seu servidor</Text>
        <Text style={ui.caption}>Informe o endereço do notebook com o backend ligado. Se estiver usando a rede local, conecte os dois aparelhos à mesma rede.</Text>
        <Text style={ui.fieldLabel}>Endereço do servidor</Text>
        <TextInput accessibilityLabel="Endereço do servidor" style={ui.input} value={address} onChangeText={setAddress} placeholder="http://192.168.1.10:3000" placeholderTextColor={colors.navInactive} autoCapitalize="none" autoCorrect={false} keyboardType="url" editable={!busy} />
        <Text style={ui.caption}>Use um servidor de confiança: seu login e seus dados serão enviados para esse endereço. A configuração fica salva somente neste aparelho.</Text>
      </View>
      {!!error && <Notice>{error}</Notice>}
      <Action label={busy ? 'Aguarde…' : 'Testar e salvar'} disabled={busy} onPress={() => { void save(); }} />
      <Action label="Usar endereço padrão do aplicativo" secondary disabled={busy} onPress={() => { void save(true); }} />
      <Text style={ui.caption}>Quando o IP mudar, volte aqui e informe o novo endereço. Você não precisa reinstalar o aplicativo.</Text>
    </FormScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 0.5, borderColor: colors.border },
  icon: { width: 56, height: 56, borderRadius: radius.card, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
});
