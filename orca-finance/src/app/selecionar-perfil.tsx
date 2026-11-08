import { IconArrowLeft, IconArrowUpRight, IconCheck, IconLogout, IconPencil, IconPlus, IconShieldLock } from '@tabler/icons-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AsyncState } from '@/components/common/AsyncState';
import { Notice } from '@/components/common/FinanceScreen';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { errorMessage, SessionChangedError } from '@/services/api-client';
import { colors, fontFamily, radius, spacing } from '@/theme';

const avatarTones = [
  { background: colors.primaryTint, ink: colors.brand },
  { background: colors.positiveTint, ink: colors.categories.housing.icon },
  { background: colors.categories.food.background, ink: colors.categories.food.icon },
  { background: colors.categories.leisure.background, ink: colors.categories.leisure.icon },
] as const;

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length ? `${Array.from(words[0])[0]}${words.length > 1 ? Array.from(words.at(-1)!)[0] : ''}`.toLocaleUpperCase('pt-BR') : 'P';
}
function avatarTone(id: string) {
  const hash = Array.from(id).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
  return avatarTones[hash % avatarTones.length];
}

export default function SelectProfile() {
  const router = useRouter();
  const { account, profiles, activeProfileId, refreshProfiles, setActiveProfile, signOut } = useAppSession();
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const mutation = useProfileMutation();
  useFocusEffect(useCallback(() => {
    let mounted = true; setRefreshing(true); setError('');
    void refreshProfiles().catch(caught => {
      if (mounted && !(caught instanceof SessionChangedError)) setError(errorMessage(caught));
    }).finally(() => { if (mounted) setRefreshing(false); });
    return () => { mounted = false; };
  }, [refreshProfiles, attempt]));
  const disabled = refreshing || mutation.busy || !!error;

  function choose(id: string) {
    if (disabled) return;
    try { setActiveProfile(id); router.replace('/(tabs)'); }
    catch (caught) { setError(errorMessage(caught)); }
  }

  return <View style={styles.screen}>
    <StatusBar style="light" />
    <SafeAreaView edges={['top']} style={styles.top}>
      <View style={styles.topRow}>
        {activeProfileId ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao início" style={styles.back} onPress={() => router.replace('/(tabs)')}><IconArrowLeft size={22} color={colors.surface} /></Pressable> : <View style={styles.back} />}
        <Text style={styles.brand}>Orca<Text style={styles.brandLight}> Finance</Text></Text>
        <View style={styles.back} />
      </View>
      <View style={styles.welcome}><Text style={styles.eyebrow}>SEU DINHEIRO, DO SEU JEITO</Text>
        <Text accessibilityRole="header" style={styles.title}>Quem vai usar?</Text>
        <Text style={styles.subtitle}>Escolha o perfil que você quer cuidar hoje.</Text>
      </View>
    </SafeAreaView>
    <SafeAreaView edges={['bottom']} style={styles.body}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.account}><View style={styles.accountDot} /><Text style={styles.accountName}>Conta de {account?.name}</Text></View>
        {refreshing && <AsyncState loading />}
        {!!error && <AsyncState error={error} onRetry={() => setAttempt(value => value + 1)} />}
        {!refreshing && !error && !profiles.length && <View style={styles.empty}><Text style={styles.emptyTitle}>Seu espaço começa aqui</Text><Text style={styles.emptyText}>Crie seu primeiro perfil para organizar suas finanças.</Text></View>}
        <View style={styles.grid}>
          {profiles.map(profile => {
            const tone = avatarTone(profile.id); const active = profile.id === activeProfileId;
            return <Pressable key={profile.id} accessibilityRole="button" accessibilityLabel={`Entrar no perfil ${profile.nome}`}
              accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={() => choose(profile.id)}
              style={({ pressed }) => [styles.tile, active && styles.activeTile, pressed && styles.pressed, disabled && styles.disabled]}>
              <View style={[styles.avatar, { backgroundColor: tone.background }]}><Text accessible={false} style={[styles.initials, { color: tone.ink }]}>{initials(profile.nome)}</Text>
                {active && <View style={styles.check}><IconCheck size={14} color={colors.surface} /></View>}</View>
              <Text style={styles.profileName}>{profile.nome}</Text>
              <View style={styles.enter}><Text style={styles.enterText}>{active ? 'Continuar' : 'Entrar'}</Text><IconArrowUpRight size={15} color={colors.primary} /></View>
            </Pressable>;
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Adicionar perfil" disabled={mutation.busy}
            style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.pressed]} onPress={() => router.push('/configuracoes/perfis')}>
            <View style={[styles.avatar, styles.addAvatar]}><IconPlus size={32} color={colors.textSecondary} strokeWidth={1.5} /></View>
            <Text style={styles.addLabel}>Adicionar perfil</Text><Text style={styles.addCaption}>Um novo espaço</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" disabled={mutation.busy} style={({ pressed }) => [styles.manage, pressed && styles.pressed]} onPress={() => router.push('/configuracoes/perfis')}>
          <IconPencil size={18} color={colors.brand} /><Text style={styles.manageText}>Gerenciar perfis</Text>
        </Pressable>
        <View style={styles.privacy}><IconShieldLock size={18} color={colors.textSecondary} /><Text style={styles.privacyText}>Cada perfil tem suas próprias finanças.</Text></View>
        {!!mutation.error && <Notice>{mutation.error}</Notice>}
        <Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" disabled={mutation.busy} accessibilityState={{ disabled: mutation.busy }} style={styles.logout}
          onPress={() => mutation.run(async () => { const result = await signOut(); if (!result.pushDeactivated) Alert.alert('Sessão encerrada', 'Não foi possível confirmar a desativação das notificações. Você pode desativá-las nas configurações do aparelho.'); }, () => {})}>
          <IconLogout size={17} color={colors.textSecondary} /><Text style={styles.logoutText}>{mutation.busy ? 'Saindo…' : 'Não é você? Sair da conta'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brand },
  top: { backgroundColor: colors.brand },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.surface, fontFamily: fontFamily.bold, fontSize: 23 },
  brandLight: { fontFamily: fontFamily.regular },
  welcome: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 36, alignItems: 'center', gap: 12 },
  eyebrow: { color: colors.primaryTint, fontFamily: fontFamily.medium, fontSize: 10, letterSpacing: 2 },
  title: { color: colors.surface, fontFamily: fontFamily.bold, fontSize: 32, textAlign: 'center' },
  subtitle: { color: colors.primaryTint, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  body: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, overflow: 'hidden' },
  content: { padding: 24, paddingBottom: 20, gap: 22, width: '100%', maxWidth: 540, alignSelf: 'center' },
  account: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  accountDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.positive },
  accountName: { color: colors.textSecondary, fontFamily: fontFamily.medium, fontSize: 12, flexShrink: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  tile: { flexBasis: '45%', flexGrow: 1, maxWidth: 228, minHeight: 190, paddingHorizontal: 12, paddingVertical: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 12 },
  activeTile: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  avatar: { width: 78, height: 78, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fontFamily.bold, fontSize: 29, letterSpacing: 1 },
  check: { position: 'absolute', bottom: -3, right: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  profileName: { color: colors.textPrimary, fontFamily: fontFamily.bold, fontSize: 16, textAlign: 'center', flexShrink: 1 },
  enter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  enterText: { fontFamily: fontFamily.medium, color: colors.primary, fontSize: 12 },
  addTile: { backgroundColor: colors.background, borderStyle: 'dashed' },
  addAvatar: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  addLabel: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  addCaption: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textSecondary },
  manage: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  manageText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.brand },
  privacy: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  privacyText: { flexShrink: 1, fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 18, textAlign: 'center', color: colors.textSecondary },
  logout: { minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontFamily: fontFamily.medium, color: colors.textSecondary, fontSize: 12 },
  empty: { gap: 8, alignItems: 'center' },
  emptyTitle: { fontFamily: fontFamily.bold, color: colors.textPrimary, fontSize: 17 },
  emptyText: { fontFamily: fontFamily.regular, color: colors.textSecondary, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
