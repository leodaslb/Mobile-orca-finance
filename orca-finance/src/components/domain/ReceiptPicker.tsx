import { IconCamera, IconPhoto, IconX } from '@tabler/icons-react-native';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { pickReceipt } from '@/services/receipt-picker.service';
import type { ReceiptFile } from '@/types/receipt';
import { colors, fontFamily, radius, spacing } from '@/theme';

export function ReceiptPicker({ value, onChange, disabled = false, onBusyChange }: {
  value: ReceiptFile | null; onChange: (file: ReceiptFile | null) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const picker = useProfileMutation();
  const busy = disabled || picker.busy;
  async function choose(source: 'camera' | 'gallery') {
    if (busy) return;
    onBusyChange?.(true);
    try { await picker.run(() => pickReceipt(source), file => { if (file) onChange(file); }); }
    finally { onBusyChange?.(false); }
  }
  return <View style={styles.container}>
    <Text style={styles.caption}>JPEG ou PNG · máximo 5 MiB</Text>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void choose('gallery')} style={styles.button}>
        <IconPhoto size={22} color={colors.primary} /><Text style={styles.link}>Galeria</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void choose('camera')} style={styles.button}>
        <IconCamera size={22} color={colors.primary} /><Text style={styles.link}>Câmera</Text>
      </Pressable>
    </View>
    {picker.busy && <Text style={styles.caption}>Selecionando imagem…</Text>}
    {!!picker.error && <>
      <Text accessibilityRole="alert" style={styles.error}>{picker.error}</Text>
      {picker.error.includes('configurações') && <Pressable accessibilityRole="button" style={styles.button} onPress={() => void Linking.openSettings().catch(() => undefined)}><Text style={styles.link}>Abrir configurações</Text></Pressable>}
    </>}
    {value && <>
      <Image source={{ uri: value.uri }} resizeMode="contain" style={styles.preview} accessibilityLabel="Prévia do recibo selecionado" />
      <View style={styles.row}><Text style={styles.caption}>{value.mimeType === 'image/png' ? 'PNG' : 'JPEG'} · {(value.size / 1024).toFixed(0)} KiB</Text>
        <Pressable accessibilityRole="button" disabled={busy} accessibilityLabel="Remover imagem selecionada" style={styles.button} onPress={() => onChange(null)}><IconX size={20} color={colors.textSecondary} /></Pressable>
      </View>
    </>}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  button: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  caption: { fontFamily: fontFamily.regular, color: colors.textSecondary }, link: { fontFamily: fontFamily.medium, color: colors.primary },
  error: { fontFamily: fontFamily.regular, color: colors.negative }, preview: { height: 150, width: '100%', backgroundColor: colors.background, borderRadius: radius.input },
});
