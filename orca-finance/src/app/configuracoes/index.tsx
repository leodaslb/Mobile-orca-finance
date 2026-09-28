import { IconArrowLeft, IconChevronRight, IconShieldLock } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/common/AppCard';
import { useAppSession } from '@/contexts/AppSessionContext';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export default function SettingsHub() {
  const router = useRouter();
  const { account, signOut } = useAppSession();
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
        <IconArrowLeft size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>Perfil e configurações</Text>
      <View style={styles.headerSpacer} />
    </View>
    <Text style={styles.name}>{account?.name}</Text>
    <Text style={styles.email}>{account?.email}</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push('/seguranca')}>
      <AppCard style={styles.card}>
        <IconShieldLock size={25} color={colors.primary} />
        <Text style={styles.cardTitle}>Segurança</Text>
        <IconChevronRight size={19} color={colors.textSecondary} />
      </AppCard>
    </Pressable>
    <Pressable accessibilityRole="button" style={styles.signOut} onPress={signOut}>
      <Text style={styles.signOutText}>Sair da conta</Text>
    </Pressable>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.lg, backgroundColor: colors.background },
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
