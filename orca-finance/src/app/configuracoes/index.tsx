import { IconArrowLeft, IconChevronRight, IconShieldLock } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/common/AppCard';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Destination, Notice } from '@/components/common/FinanceScreen';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export default function SettingsHub() {
  const router = useRouter();
  const { account, profiles, activeProfileId, signOut } = useAppSession();
  const mutation = useProfileMutation();
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
        <IconArrowLeft size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>Perfil e configurações</Text>
      <View style={styles.headerSpacer} />
    </View>
    <Text style={styles.name}>{account?.name}</Text>
    <Text style={styles.email}>{account?.email}</Text>
    <Destination title="Trocar perfil" caption={profiles.find(profile => profile.id === activeProfileId)?.nome ?? 'Escolha seu espaço financeiro'} href="/selecionar-perfil" />
    <Destination title="Gerenciar perfis" caption="Criar e renomear perfis financeiros" href="/configuracoes/perfis" />
    <Destination title="Notificações" caption="Registrar ou desativar este aparelho" href="/configuracoes/notificacoes" />
    <Text style={styles.serverHint}>Para mudar o endereço do servidor, saia da conta e toque no ícone de engrenagem no rodapé da tela de entrada.</Text>
    {activeProfileId && <Destination title="Automações de classificação" href="/configuracoes/automacoes" />}
    <Pressable accessibilityRole="button" onPress={() => router.push('/seguranca')}>
      <AppCard style={styles.card}>
        <IconShieldLock size={25} color={colors.primary} />
        <Text style={styles.cardTitle}>Segurança</Text>
        <IconChevronRight size={19} color={colors.textSecondary} />
      </AppCard>
    </Pressable>
    {activeProfileId && <Pressable accessibilityRole="button" onPress={() => router.push('/recorrencias')}><AppCard style={styles.card}><Text style={styles.cardTitle}>Recorrências e lembretes</Text><IconChevronRight size={19} color={colors.textSecondary} /></AppCard></Pressable>}
    {!!mutation.error && <Notice>{mutation.error}</Notice>}
    <Pressable accessibilityRole="button" disabled={mutation.busy} style={styles.signOut} onPress={() => mutation.run(async () => { const result = await signOut(); if (!result.pushDeactivated) Alert.alert('Sessão encerrada', 'Não foi possível confirmar a desativação das notificações no servidor. Você pode desativar a permissão nas configurações do aparelho.'); }, () => {})}>
      <Text style={styles.signOutText}>Sair da conta</Text>
    </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 30 },
  serverHint: { marginVertical: spacing.md, fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 },
  headerSpacer: { width: 24 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  name: { marginTop: 25, fontFamily: fontFamily.bold, fontSize: 22, color: colors.textPrimary },
  email: { marginTop: spacing.xs, marginBottom: 26, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: 18 },
  cardTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  signOut: { marginTop: 30, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  signOutText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.negative },
});
