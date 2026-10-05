import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardLayout } from '@/components/common/KeyboardLayout';
import { AppSwitch } from '@/components/common/AppSwitch';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
export function SubcategoryModal(props: {
  visible: boolean;
  editing: boolean;
  active: boolean;
  onActiveChange: (value: boolean) => void;
  error: string;
  busy: boolean;
  categoryName?: string;
  name: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return <Modal visible={props.visible} transparent animationType="fade"
    onRequestClose={props.onClose}>
    <KeyboardLayout style={styles.overlay}><ScrollView style={styles.modal} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={styles.modalTitle}>{props.editing ? 'Editar subcategoria' : 'Nova subcategoria'}</Text>
      <Text style={styles.muted}>{props.categoryName}</Text>
      <Text style={styles.label}>Nome</Text>
      <TextInput accessibilityLabel="Nome da subcategoria" value={props.name} onChangeText={props.onNameChange} autoFocus editable={!props.busy}
        placeholder="Ex.: Feira" placeholderTextColor={colors.navInactive} style={styles.input} />
      {props.editing && <View style={styles.subcategoryRow}><Text style={styles.item}>Subcategoria ativa</Text><AppSwitch disabled={props.busy} value={props.active} onChange={props.onActiveChange} accessibilityLabel="Subcategoria ativa" /></View>}
      {props.editing && <Text style={styles.muted}>Desativar preserva as transações anteriores.</Text>}
      {!!props.error && <Text accessibilityRole="alert" style={styles.error}>{props.error}</Text>}
      <View style={styles.actions}>
        <Pressable disabled={props.busy} onPress={props.onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Cancelar</Text>
        </Pressable>
        <Pressable disabled={props.busy} accessibilityState={{ busy: props.busy, disabled: props.busy }} onPress={props.onSave} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{props.busy ? 'Salvando…' : props.editing ? 'Salvar' : 'Criar'}</Text>
        </Pressable>
      </View>
    </ScrollView></KeyboardLayout>
  </Modal>;
}

const styles = StyleSheet.create({
  subcategoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  error: { color: colors.negative, fontFamily: fontFamily.regular, marginTop: spacing.md },
  item: { flex: 1, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textPrimary },
  muted: { paddingTop: spacing.md, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(16,32,46,0.35)' },
  modal: { maxHeight: '100%', flexGrow: 0, flexShrink: 1, borderRadius: radius.sheet, backgroundColor: colors.surface },
  modalContent: { padding: 20 },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  label: { marginTop: spacing.lg, marginBottom: spacing.xs, fontFamily: fontFamily.medium,
    fontSize: fontSize.label, color: colors.textPrimary },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.input, paddingHorizontal: spacing.lg, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textPrimary },
  actions: { marginTop: spacing.lg, flexDirection: 'row', gap: spacing.md },
  secondaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input },
  primaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.input, backgroundColor: colors.primary },
  secondaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textSecondary },
  primaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
});
