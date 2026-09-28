import { IconArrowLeft, IconChevronRight, IconFingerprint, IconLock, IconShieldCheck, IconX } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/common/AppCard';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useAppSession } from '@/contexts/AppSessionContext';
import type { UnlockMethod } from '@/services/security.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export default function SecuritySettingsScreen() {
  const router = useRouter();
  const { security, setPin, setBiometric, setPreferredMethod, disableLock } = useAppSession();
  const [modal, setModal] = useState<'pin' | 'method' | null>(null);
  const [pin, setPinInput] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  function savePin() {
    try {
      if (pin !== confirm) throw new Error('Os PINs não conferem.');
      setPin(pin);
      setModal(null);
      setPinInput('');
      setConfirm('');
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'PIN inválido.');
    }
  }

  function chooseMethod(method: UnlockMethod) {
    try {
      setPreferredMethod(method);
      setModal(null);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Método indisponível.');
    }
  }

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace('/configuracoes')}>
          <IconArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Segurança</Text>
        <View style={styles.headerSpacer} />
      </View>

      <AppCard style={styles.card}>
        <View style={styles.row}>
          <IconFingerprint size={32} color={colors.primary} strokeWidth={1.6} />
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>Biometria</Text>
            <Text style={styles.caption}>Desbloqueio biométrico demonstrativo.</Text>
          </View>
          <AppSwitch value={security.biometricEnabled} onChange={setBiometric} accessibilityLabel="Ativar biometria demonstrativa" />
        </View>
        <Text style={styles.detail}>A API biométrica do dispositivo ainda não está integrada. Esta opção demonstra somente a navegação e os estados.</Text>
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.row}>
          <IconLock size={32} color={colors.textSecondary} strokeWidth={1.6} />
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>PIN de acesso</Text>
            <Text style={styles.caption}>{security.pinConfigured ? 'PIN configurado para esta execução.' : 'Configure um PIN alternativo de desbloqueio.'}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" style={styles.outlineButton} onPress={() => { setModal('pin'); setError(''); }}>
          <Text style={styles.outlineText}>{security.pinConfigured ? 'Alterar PIN' : 'Configurar PIN'}</Text>
        </Pressable>
      </AppCard>

      <Pressable accessibilityRole="button" onPress={() => { setModal('method'); setError(''); }}>
        <AppCard style={styles.card}>
          <View style={styles.row}>
            <IconShieldCheck size={32} color={colors.textSecondary} strokeWidth={1.6} />
            <View style={styles.rowText}>
              <Text style={styles.cardTitle}>Método preferencial</Text>
              <Text style={styles.method}>{security.preferredMethod === 'biometric' ? 'Biometria' : 'PIN'}</Text>
              <Text style={styles.caption}>O outro método continuará disponível quando configurado.</Text>
            </View>
            <IconChevronRight size={20} color={colors.textSecondary} />
          </View>
        </AppCard>
      </Pressable>

      {(security.pinConfigured || security.biometricEnabled) && <Pressable accessibilityRole="button" style={styles.disableButton} onPress={disableLock}>
        <Text style={styles.disableText}>Desativar bloqueio</Text>
      </Pressable>}
      <Text style={styles.footer}>Biometria e PIN protegem apenas o acesso local ao aplicativo. Configurações em memória: serão perdidas ao fechar o app.</Text>
    </ScrollView>

    <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => setModal(null)}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={() => setModal(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{modal === 'pin' ? (security.pinConfigured ? 'Alterar PIN' : 'Configurar PIN') : 'Método preferencial'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setModal(null)}><IconX size={22} color={colors.textSecondary} /></Pressable>
          </View>
          {modal === 'pin' ? <>
            <Text style={styles.caption}>Use 4 números. Este PIN vale apenas durante a execução atual.</Text>
            <TextInput style={styles.input} placeholder="Novo PIN" value={pin} onChangeText={setPinInput} keyboardType="number-pad" secureTextEntry maxLength={4} placeholderTextColor={colors.navInactive} />
            <TextInput style={styles.input} placeholder="Confirmar PIN" value={confirm} onChangeText={setConfirm} keyboardType="number-pad" secureTextEntry maxLength={4} placeholderTextColor={colors.navInactive} />
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Pressable accessibilityRole="button" style={styles.saveButton} onPress={savePin}><Text style={styles.saveText}>Salvar PIN</Text></Pressable>
          </> : <>
            {(['biometric', 'pin'] as const).map((method) => <Pressable key={method} accessibilityRole="button" style={styles.methodOption} onPress={() => chooseMethod(method)}>
              <Text style={styles.methodOptionText}>{method === 'biometric' ? 'Biometria' : 'PIN'}</Text>
              <Text style={styles.caption}>{method === 'biometric' ? (security.biometricEnabled ? 'Disponível na demonstração' : 'Ative a biometria primeiro') : (security.pinConfigured ? 'Configurado' : 'Configure um PIN primeiro')}</Text>
            </Pressable>)}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          </>}
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 30, gap: spacing.lg },
  header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpacer: { width: 24 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.textPrimary },
  card: { padding: 18 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  rowText: { flex: 1 },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  caption: { marginTop: spacing.xs, fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 20, color: colors.textSecondary },
  detail: { marginTop: spacing.lg, marginLeft: 46, fontFamily: fontFamily.regular, fontSize: fontSize.caption, lineHeight: 17, color: colors.textSecondary },
  method: { marginTop: spacing.xs, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  outlineButton: { minHeight: 42, alignSelf: 'flex-end', justifyContent: 'center', marginTop: spacing.lg, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.input },
  outlineText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary },
  disableButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input },
  disableText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.negative },
  footer: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, lineHeight: 18, color: colors.textSecondary },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,32,46,0.45)' },
  dismiss: { flex: 1 },
  sheet: { padding: 22, paddingBottom: 35, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.surface },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.textPrimary },
  input: { height: 48, marginTop: spacing.lg, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary },
  error: { marginTop: spacing.md, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.negative },
  saveButton: { minHeight: 48, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  saveText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  methodOption: { marginTop: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  methodOptionText: { fontFamily: fontFamily.medium, fontSize: fontSize.title, color: colors.textPrimary },
});
