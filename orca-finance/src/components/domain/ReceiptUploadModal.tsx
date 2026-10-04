import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReceiptPicker } from '@/components/domain/ReceiptPicker';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { uploadReceipt } from '@/services/receipt.service';
import type { ReceiptFile } from '@/types/receipt';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export function ReceiptUploadModal({ transactionId, onClose, onSaved }: { transactionId: string; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<ReceiptFile | null>(null);
  const [picking, setPicking] = useState(false);
  const mutation = useProfileMutation();
  const busy = picking || mutation.busy;
  const close = () => { if (!busy) onClose(); };
  return <Modal visible transparent animationType="slide" onRequestClose={close}>
    <View style={styles.overlay}><SafeAreaView edges={['bottom']} style={styles.modal}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Adicionar recibo</Text>
        <Text style={styles.caption}>Fotografe o comprovante ou escolha uma imagem. Você pode adicionar mais recibos depois.</Text>
        <ReceiptPicker value={file} onChange={setFile} disabled={mutation.busy} onBusyChange={setPicking} />
        {!!mutation.error && <Text accessibilityRole="alert" style={styles.error}>{mutation.error}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || !file} accessibilityState={{ disabled: busy || !file }}
          onPress={() => { if (file) void mutation.run(() => uploadReceipt(transactionId, file), onSaved); }}
          style={[styles.save, (busy || !file) && styles.disabled]}>
          <Text style={styles.saveText}>{mutation.busy ? 'Enviando…' : mutation.error ? 'Tentar enviar novamente' : 'Enviar comprovante'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={styles.cancel}><Text style={styles.link}>Cancelar</Text></Pressable>
      </ScrollView>
    </SafeAreaView></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,32,46,0.4)' },
  modal: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  content: { padding: spacing.lg, gap: spacing.md }, title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  caption: { fontFamily: fontFamily.regular, color: colors.textSecondary }, error: { fontFamily: fontFamily.regular, color: colors.negative },
  save: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.input },
  disabled: { opacity: 0.5 }, saveText: { fontFamily: fontFamily.bold, color: colors.surface },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, link: { fontFamily: fontFamily.medium, color: colors.primary },
});
