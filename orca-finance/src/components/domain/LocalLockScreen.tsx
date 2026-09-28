import { IconBackspace, IconFingerprint, IconLock } from '@tabler/icons-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppSession } from '@/contexts/AppSessionContext';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export function LocalLockScreen() {
  const { security, unlockWithPin, unlockBiometricDemo } = useAppSession();
  const [mode, setMode] = useState<'pin' | 'biometric'>(
    security.preferredMethod === 'biometric' && security.biometricEnabled ? 'biometric' : 'pin',
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function enterDigit(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      if (!unlockWithPin(next)) {
        setError('PIN inválido. Tente novamente.');
        setPin('');
      }
    }
  }

  return <SafeAreaView style={styles.screen}>
    <View style={styles.handle} />
    <Text style={styles.brand}>orca finance</Text>
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        {mode === 'biometric' ? <IconFingerprint size={52} color={colors.surface} strokeWidth={1.6} />
          : <IconLock size={48} color={colors.surface} strokeWidth={1.6} />}
      </View>
      <Text style={styles.title}>Desbloqueie seu app</Text>
      <Text style={styles.subtitle}>{mode === 'pin' ? 'Digite seu PIN de acesso' : 'Use a biometria ou PIN para acessar'}</Text>
      {mode === 'pin' && <>
        <View style={styles.dots}>{[0, 1, 2, 3].map((position) => <View key={position}
          style={[styles.dot, position < pin.length && styles.dotFilled]} />)}</View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((digit, index) =>
            digit === '' ? <View key={index} style={styles.key} /> :
              <Pressable key={index} accessibilityRole="button" accessibilityLabel={digit === 'back' ? 'Apagar dígito' : digit}
                style={[styles.key, digit !== 'back' && styles.keyCircle]}
                onPress={() => digit === 'back' ? setPin((current) => current.slice(0, -1)) : enterDigit(digit)}>
                {digit === 'back' ? <IconBackspace size={27} color={colors.surface} /> : <Text style={styles.keyText}>{digit}</Text>}
              </Pressable>)}
        </View>
      </>}
      {mode === 'biometric' && <Pressable accessibilityRole="button" style={styles.biometricAction} onPress={unlockBiometricDemo}>
        <IconFingerprint size={25} color={colors.surface} />
        <Text style={styles.biometricText}>Simular desbloqueio biométrico</Text>
      </Pressable>}
    </View>
    {security.biometricEnabled && security.pinConfigured && <Pressable accessibilityRole="button" style={styles.alternative}
      onPress={() => { setMode(mode === 'pin' ? 'biometric' : 'pin'); setPin(''); setError(''); }}>
      <Text style={styles.alternativeText}>{mode === 'pin' ? 'Usar biometria' : 'Usar PIN'}</Text>
    </Pressable>}
    <Text style={styles.demoNote}>Proteção local demonstrativa. Biometria nativa indisponível nesta versão.</Text>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, backgroundColor: colors.brand },
  handle: { width: 60, height: 5, alignSelf: 'center', marginTop: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primaryTint, opacity: 0.45 },
  brand: { marginTop: 60, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: 30, color: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 92, height: 92, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  title: { marginTop: 18, fontFamily: fontFamily.bold, fontSize: 25, color: colors.surface },
  subtitle: { marginTop: spacing.xs, textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.primaryTint },
  dots: { flexDirection: 'row', gap: 14, marginTop: 28, marginBottom: spacing.lg },
  dot: { width: 13, height: 13, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotFilled: { backgroundColor: colors.surface },
  error: { marginBottom: spacing.sm, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.surface },
  keypad: { width: '100%', maxWidth: 300, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  key: { width: '29%', height: 66, alignItems: 'center', justifyContent: 'center' },
  keyCircle: { borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  keyText: { fontFamily: fontFamily.medium, fontSize: 25, color: colors.surface },
  biometricAction: { marginTop: 45, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.primaryTint, borderRadius: radius.input },
  biometricText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  alternative: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryTint, borderRadius: radius.input },
  alternativeText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  demoNote: { marginTop: 14, marginBottom: 16, textAlign: 'center', fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.primaryTint },
});
