import {
  IconArrowLeft,
  IconInfoCircle,
  IconPlayerPause,
  IconShoppingCart,
} from '@tabler/icons-react-native';
import {
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import type { CreateTransactionInput } from '@/types/transaction';
import { formatCurrency } from '@/utils/currency';

interface PurchaseReflectionModalProps {
  visible: boolean;
  transaction: CreateTransactionInput | null;
  categoryName: string;
  onFinalize: () => void;
  onReview: () => void;
  onPlaceInReflection?: (durationHours: number) => void;
}

export function PurchaseReflectionModal({
  visible,
  transaction,
  categoryName,
  onFinalize,
  onReview,
  onPlaceInReflection,
}: PurchaseReflectionModalProps) {
  const [durationInput, setDurationInput] = useState('48');
  const [durationError, setDurationError] = useState(false);
  if (!transaction) return null;

  const reflectionAvailable = Boolean(onPlaceInReflection);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onReview}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Voltar e revisar"
            accessibilityRole="button"
            onPress={onReview}
            style={styles.iconButton}
          >
            <IconArrowLeft size={24} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Antes de finalizar</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.reflectionCard}>
            <View style={styles.pauseCircle}>
              <IconPlayerPause size={44} color={colors.warning} strokeWidth={1.8} />
            </View>

            <Text style={styles.question}>Essa compra é realmente necessária agora?</Text>
            <Text style={styles.explanation}>
              Reserve alguns segundos para pensar antes de confirmar uma compra não essencial.
            </Text>

            <View style={styles.transactionCard}>
              <Text style={styles.description}>{transaction.description}</Text>
              <Text style={styles.amount}>{formatCurrency(transaction.amountCents)}</Text>
              <View style={styles.categoryRow}>
                <View style={styles.categoryIcon}>
                  <IconShoppingCart size={22} color={colors.categories.food.icon} />
                </View>
                <Text style={styles.category}>{categoryName}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <IconInfoCircle size={24} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                O item ficará aguardando pelo período de reflexão configurado.
              </Text>
            </View>
          </View>

          {reflectionAvailable && <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Período de reflexão (horas)</Text>
            <TextInput accessibilityLabel="Duração da reflexão em horas" keyboardType="number-pad"
              value={durationInput} onChangeText={(value) => { setDurationInput(value); setDurationError(false); }}
              style={styles.durationInput} />
            {durationError && <Text style={styles.durationError}>Informe uma quantidade inteira de horas maior que zero.</Text>}
          </View>}

          <Pressable
            accessibilityRole="button"
            onPress={onFinalize}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Finalizar mesmo assim</Text>
          </Pressable>

          <Pressable
            accessibilityHint={
              reflectionAvailable
                ? undefined
                : 'Indisponível enquanto a duração e a lista de reflexão não estiverem definidas.'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: !reflectionAvailable }}
            disabled={!reflectionAvailable}
            onPress={() => {
              const hours = Number(durationInput);
              if (!Number.isSafeInteger(hours) || hours <= 0) { setDurationError(true); return; }
              onPlaceInReflection?.(hours);
            }}
            style={[
              styles.secondaryButton,
              !reflectionAvailable && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryText}>Colocar em reflexão</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onReview}
            style={styles.reviewButton}
          >
            <Text style={styles.reviewText}>Voltar e revisar</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  durationRow: { padding: spacing.lg, gap: spacing.sm, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  durationLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  durationInput: { minHeight: 44, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary },
  durationError: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.negative },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: fontSize.title,
    color: colors.textPrimary,
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  reflectionCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pauseCircle: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.categories.food.background,
  },
  question: {
    marginTop: spacing.lg,
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  explanation: {
    marginTop: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  transactionCard: {
    width: '100%',
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  description: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  amount: { marginTop: spacing.sm, fontFamily: fontFamily.bold, fontSize: 32, color: colors.negative },
  categoryRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  categoryIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.icon,
    backgroundColor: colors.categories.food.background,
  },
  category: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  infoRow: { width: '100%', marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 24, color: colors.textSecondary },
  primaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
    backgroundColor: colors.primary,
  },
  primaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  secondaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  secondaryText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
  buttonDisabled: { opacity: 0.5 },
  reviewButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  reviewText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textSecondary },
});
