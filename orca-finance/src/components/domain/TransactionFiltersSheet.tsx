import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onApply: () => void;
  onClear: () => void;
}

export function TransactionFiltersSheet({ visible, onCancel, onApply, onClear }: Props) {
  // RF13/US03: controles de filtros avançados ainda não implementados.
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel}
          accessibilityRole="button" accessibilityLabel="Fechar filtros" />
        <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.handle} />
            <Text style={styles.title}>Filtros de transações</Text>
            <Text style={styles.text}>Filtros por data, categoria, valor e método de pagamento estarão disponíveis em uma próxima etapa.</Text>
            <Pressable disabled accessibilityRole="button" accessibilityState={{ disabled: true }}
              onPress={onApply} style={[styles.button, styles.disabled]}>
              <Text style={styles.buttonText}>Aplicar filtros</Text>
            </Pressable>
            <Pressable disabled accessibilityRole="button" accessibilityState={{ disabled: true }}
              onPress={onClear} style={styles.button}>
              <Text style={styles.text}>Limpar filtros — indisponível</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button}>
              <Text style={styles.link}>Cancelar</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 32, 46, 0.4)' },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  content: { padding: spacing.lg, gap: spacing.lg },
  handle: { width: 60, height: 5, borderRadius: radius.pill, backgroundColor: colors.border, alignSelf: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input },
  disabled: { backgroundColor: colors.primary, opacity: 0.45 },
  buttonText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  link: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary },
});
