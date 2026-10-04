import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export function AsyncState({ loading, error, onRetry }: { loading?: boolean; error?: string; onRetry?: () => void }) {
  return <View style={styles.container}>
    {loading ? <><ActivityIndicator color={colors.primary} /><Text style={styles.text}>Carregando…</Text></>
      : <><Text accessibilityRole="alert" style={styles.text}>{error}</Text>
        {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.link}>Tentar novamente</Text></Pressable>}</>}
  </View>;
}
const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary },
});
