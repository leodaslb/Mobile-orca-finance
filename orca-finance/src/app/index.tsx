import { IconEye, IconX } from '@tabler/icons-react-native';
import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppSession } from '@/contexts/AppSessionContext';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

type SheetMode = 'login' | 'signup' | null;

export default function Index() {
  const { account, activeProfileId, signIn, signUp } = useAppSession();
  const [mode, setMode] = useState<SheetMode>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  if (account) return <Redirect href={activeProfileId ? "/(tabs)" : "/configuracoes"} />;

  function openSheet(next: Exclude<SheetMode, null>) {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmation('');
    setShowPassword(false);
  }

  async function submit() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      if (mode === 'signup') {
        if (password !== confirmation) throw new Error('As senhas não conferem.');
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      setMode(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível continuar.');
    } finally { sending.current = false; setBusy(false); }
  }

  return <SafeAreaView style={styles.screen}>
    <View style={styles.handle} />
    <View style={styles.hero}>
      <Text style={styles.brand}><Text style={styles.brandBold}>Orca</Text> Finance</Text>
      <Text style={styles.headline}>Cuide melhor do{'\n'}seu dinheiro</Text>
      <Text style={styles.description}>Organize seus gastos, acompanhe metas e planeje seu futuro financeiro.</Text>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => openSheet('login')}>
        <Text style={styles.primaryText}>Entrar</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => openSheet('signup')}>
        <Text style={styles.secondaryText}>Criar conta</Text>
      </Pressable>
    </View>
    <Text style={styles.footer}>Seus dados financeiros em um só lugar.</Text>

    <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={() => { if (!busy) setMode(null); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.dismissArea} onPress={() => { if (!busy) setMode(null); }} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar" style={styles.close} onPress={() => { if (!busy) setMode(null); }}>
            <IconX size={20} color={colors.textSecondary} />
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetTitle}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
            <Text style={styles.sheetSubtitle}>{mode === 'login' ? 'Acesse sua conta para continuar.' : 'Crie sua conta para começar a organizar suas finanças.'}</Text>
            {mode === 'signup' && <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Como podemos te chamar?" placeholderTextColor={colors.navInactive} autoCapitalize="words" />
            </View>}
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="seuemail@exemplo.com" placeholderTextColor={colors.navInactive} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.navInactive} secureTextEntry={!showPassword} autoCapitalize="none" />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setShowPassword((value) => !value)}>
                  <IconEye size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
            {mode === 'signup' && <View style={styles.field}>
              <Text style={styles.label}>Confirmar senha</Text>
              <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} placeholder="••••••••" placeholderTextColor={colors.navInactive} secureTextEntry={!showPassword} autoCapitalize="none" />
            </View>}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Pressable accessibilityRole="button" style={[styles.primaryButton, styles.submit]} disabled={busy} accessibilityState={{ busy, disabled: busy }} onPress={submit}>
              <Text style={styles.primaryText}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
            </Pressable>
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{mode === 'login' ? 'Ainda não tem conta? ' : 'Já possui uma conta? '}</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => openSheet(mode === 'login' ? 'signup' : 'login')}>
                <Text style={styles.switchLink}>{mode === 'login' ? 'Criar conta' : 'Entrar'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  handle: { alignSelf: 'center', width: 60, height: 5, marginTop: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.border },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  brand: { fontFamily: fontFamily.regular, fontSize: 29, color: colors.brand },
  brandBold: { fontFamily: fontFamily.bold },
  headline: { marginTop: 72, fontFamily: fontFamily.bold, fontSize: 34, lineHeight: 43, textAlign: 'center', color: colors.textPrimary },
  description: { marginTop: 22, fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 27, textAlign: 'center', color: colors.textSecondary },
  actions: { gap: spacing.md },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  primaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.surface },
  secondaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.primary },
  footer: { marginTop: 70, marginBottom: 28, textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,32,46,0.45)' },
  dismissArea: { flex: 1 },
  sheet: { maxHeight: '90%', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.surface },
  sheetHandle: { alignSelf: 'center', width: 60, height: 5, borderRadius: radius.pill, backgroundColor: colors.border },
  close: { position: 'absolute', right: 18, top: 18, zIndex: 1 },
  sheetTitle: { marginTop: 20, fontFamily: fontFamily.bold, fontSize: 28, color: colors.textPrimary },
  sheetSubtitle: { marginTop: 4, marginBottom: 20, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  field: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textSecondary },
  input: { height: 49, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary },
  passwordRow: { height: 49, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.input },
  passwordInput: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary },
  error: { marginBottom: spacing.md, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.negative },
  submit: { marginTop: spacing.sm },
  switchRow: { marginTop: 20, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  switchText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  switchLink: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
});
