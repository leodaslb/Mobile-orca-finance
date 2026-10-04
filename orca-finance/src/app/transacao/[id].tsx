
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconCalendar, IconClock, IconCreditCard, IconHash, IconNotes, IconPencil, IconPhoto, IconShoppingCart, IconStar, IconBuildingStore, IconWallet } from '@tabler/icons-react-native';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '@/components/common/AppCard';
import { TransactionDetailRow } from '@/components/domain/TransactionDetailRow';
import { ReceiptUploadModal } from '@/components/domain/ReceiptUploadModal';
import { getRemoteRecurrence, recurrenceConfiguration as mapRecurrenceConfiguration, updateRemoteRecurrence } from '@/services/recurrence.service';
import { RecurrenceConfigurationModal } from '@/components/domain/RecurrenceConfigurationModal';
import { useProfileResource } from '@/hooks/useProfileResource';
import { AsyncState } from '@/components/common/AsyncState';
import { errorMessage, getApiSession } from '@/services/api-client';
import { getTransactionById, reverseTransaction } from '@/services/transaction.service';
import type { Essentiality, PaymentMethod } from '@/types/transaction';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';
import { formatTransactionDate } from '@/utils/date';

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro', debit_card: 'Cartão de débito', credit_card: 'Cartão de crédito',
  pix: 'Pix', bank_transfer: 'Transferência bancária', other: 'Outro',
};
const essentialityLabels: Record<Essentiality, string> = {
  essential: 'Essencial', non_essential: 'Não essencial', unclassified: 'Não classificada',
};
const iconProps = { size: 20, color: colors.textSecondary, strokeWidth: 1.8 };

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const router = useRouter();
  const [reversalOpen, setReversalOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptUploadOpen, setReceiptUploadOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [busy, setBusy] = useState(false); const sending = useRef(false);
  const load = useCallback(async () => {
    if (typeof id !== 'string') throw new Error('Identificador inválido.');
    const transaction = await getTransactionById(id);
    const recurrence = transaction.recurrenceId ? await getRemoteRecurrence(transaction.recurrenceId) : undefined;
    return { transaction, recurrence };
  }, [id]);
  const { data, loading, error, reload } = useProfileResource(load);
  const transaction = data?.transaction; const recurrence = data?.recurrence;
  const recurrenceConfiguration = useMemo(() => recurrence ? mapRecurrenceConfiguration(recurrence) : undefined, [recurrence]);
  const edit = () => { if (transaction) router.push({ pathname: '/transacao/nova', params: { editId: transaction.id } }); };
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/transacoes');
  const isExpense = transaction?.type === 'expense';
  const amountStyle = isExpense ? styles.expense : styles.income;
  const canOpenReceipt = !!receiptUri && /^https?:\/\//i.test(receiptUri);

  const rows = transaction ? [
    { label: 'Categoria', value: transaction.categoryName, icon: <CategoryIcon name={transaction.categoryName} /> },
    ...(transaction.subcategoryName ? [{ label: 'Subcategoria', value: transaction.subcategoryName, icon: <IconBuildingStore {...iconProps} /> }] : []),
    { label: 'Data', value: formatTransactionDate(transaction.date), icon: <IconCalendar {...iconProps} /> },
    { label: 'Hora', value: transaction.time, icon: <IconClock {...iconProps} /> },
    ...(transaction.paymentMethod ? [{ label: 'Método de pagamento', value: paymentLabels[transaction.paymentMethod], icon: <IconCreditCard {...iconProps} /> }] : []),
    ...(transaction.tags.length ? [{ label: 'Tags', value: transaction.tags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' '), icon: <IconHash {...iconProps} /> }] : []),
    ...(transaction.essentiality ? [{ label: 'Essencialidade', value: essentialityLabels[transaction.essentiality], icon: <IconStar {...iconProps} /> }] : []),
    ...(transaction.freeSpending ? [{ label: 'Gasto livre', value: 'Sim', icon: <IconWallet {...iconProps} /> }] : []),
    ...(transaction.notes ? [{ label: 'Anotações', value: transaction.notes, icon: <IconNotes {...iconProps} /> }] : []),
  ] : [];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Voltar">
          <IconArrowLeft {...iconProps} />
        </Pressable>
        <Text style={styles.title}>Detalhes da transação</Text>
        {transaction && <Pressable onPress={edit} style={styles.iconButton} accessibilityRole="button"
          accessibilityLabel="Editar transação">
          <IconPencil {...iconProps} color={colors.navInactive} />
        </Pressable>}
      </View>
      {!transaction ? <AsyncState loading={loading} error={error ?? 'Transação não encontrada'} onRetry={reload} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          {!!error && <AsyncState error={error} onRetry={reload} />}
          <View style={styles.summary}>
            <Text style={[styles.amount, amountStyle]}>{isExpense ? '- ' : '+ '}{formatCurrency(transaction.amountCents)}</Text>
            <Text style={styles.description}>{transaction.description}</Text>
            <View style={styles.type}>
              {isExpense ? <IconShoppingCart size={18} color={colors.negative} /> : <IconWallet size={18} color={colors.positive} />}
              <Text style={[styles.body, amountStyle]}>{isExpense ? 'Despesa' : 'Receita'}</Text>
            </View>
            {transaction.status === 'scheduled' && <Text style={styles.secondary}>Prevista</Text>}
          </View>
          <AppCard style={styles.details}>
            {rows.map((row, index) => <TransactionDetailRow key={row.label} {...row} showDivider={index < rows.length - 1} />)}
          </AppCard>
          {!!transaction.receipts.length && <AppCard>
            <Text style={styles.secondary}>Comprovante</Text>
            {transaction.receipts.map((receipt, index) => {
              const available = /^https?:\/\//i.test(receipt.arquivoUrl);
              return <Pressable key={receipt.id} onPress={() => {
                if (receipt.mimeType?.startsWith('image/')) { setReceiptUri(receipt.arquivoUrl); setImageLoading(true); setImageError(false); setReceiptOpen(true); }
                else Linking.openURL(receipt.arquivoUrl).catch(() => Alert.alert('Comprovante', 'Não foi possível abrir o arquivo.'));
              }} disabled={!available} style={styles.receipt} accessibilityRole="button" accessibilityState={{ disabled: !available }}>
                <IconPhoto {...iconProps} /><Text style={styles.body}>Ver recibo{transaction.receipts.length > 1 ? ` ${index + 1}` : ''}{!available ? ' — indisponível' : ''}</Text>
              </Pressable>;
            })}
          </AppCard>}
          {isExpense && <Pressable accessibilityRole="button" style={styles.edit} onPress={() => setReceiptUploadOpen(true)}><Text style={styles.editText}>Adicionar recibo</Text></Pressable>}
          {recurrence && <AppCard>
            <Text style={styles.secondary}>Recorrência</Text>
            <Text style={styles.body}>{recurrence.ativa ? ({ SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual' }[recurrence.frequencia]) : 'Desativada'}</Text>
            <Text style={styles.secondary}>Próxima: {new Date(recurrence.proximaOcorrencia).toLocaleString('pt-BR')}</Text>
            <Pressable accessibilityRole="button" style={styles.receipt} onPress={() => setRecurrenceOpen(true)}>
              <Text style={styles.editText}>Editar configuração futura</Text>
            </Pressable>
          </AppCard>}
          <Pressable onPress={edit} accessibilityRole="button" style={styles.edit}>
            <Text style={styles.editText}>Editar transação</Text>
          </Pressable>
          <Pressable onPress={() => setReversalOpen(true)} accessibilityRole="button" style={styles.revert}>
            <Text style={[styles.body, styles.expense]}>Reverter transação</Text>
          </Pressable>
        </ScrollView>
      )}
      <Modal visible={reversalOpen && !!transaction} transparent animationType="fade" onRequestClose={() => { if (!busy) setReversalOpen(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reverter transação?</Text>
            <Text style={styles.modalText}>Esta transação deixará os registros financeiros ativos e não será mais considerada no saldo, orçamento ou relatórios. A reversão ficará registrada na auditoria.</Text>
            <Text style={styles.modalSummary}>{transaction?.description} · {transaction && formatCurrency(transaction.amountCents)}</Text>
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" disabled={busy} style={styles.cancelButton} onPress={() => setReversalOpen(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ busy, disabled: busy }} style={styles.confirmButton} onPress={async () => {
                if (!transaction || sending.current) return;
                sending.current = true; setBusy(true);
                const revision = getApiSession().revision;
                try {
                  await reverseTransaction(transaction.id);
                  if (revision !== getApiSession().revision) return;
                  setReversalOpen(false); router.replace('/(tabs)/transacoes');
                } catch (caught) {
                  if (revision === getApiSession().revision) Alert.alert('Não foi possível reverter', errorMessage(caught));
                } finally { sending.current = false; setBusy(false); }
              }}><Text style={styles.confirmText}>{busy ? 'Revertendo…' : 'Reverter transação'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {recurrence && recurrenceConfiguration && <RecurrenceConfigurationModal visible={recurrenceOpen} busy={busy} remindersAvailable={false}
        value={recurrenceConfiguration}
        onCancel={() => setRecurrenceOpen(false)} onSave={async configuration => {
          if (sending.current) return;
          const revision = getApiSession().revision;
          sending.current = true; setBusy(true);
          try {
            await updateRemoteRecurrence(recurrence, configuration);
            if (revision === getApiSession().revision) { setRecurrenceOpen(false); reload(); }
          } catch (caught) {
            if (revision === getApiSession().revision) Alert.alert('Não foi possível atualizar', errorMessage(caught));
          } finally { sending.current = false; setBusy(false); }
        }} />}
      <Modal visible={receiptOpen && canOpenReceipt} animationType="slide" onRequestClose={() => setReceiptOpen(false)}>
        <SafeAreaView style={styles.receiptViewer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar comprovante" onPress={() => setReceiptOpen(false)}>
            <Text style={styles.editText}>Fechar</Text>
          </Pressable>
          {imageLoading && !imageError && <ActivityIndicator color={colors.primary} />}
          {imageError ? <AsyncState error="Não foi possível carregar o comprovante." onRetry={() => { setImageError(false); setImageLoading(true); setImageAttempt(v => v + 1); }} />
            : receiptUri && <Image key={imageAttempt} source={{ uri: receiptUri }} style={styles.receiptImage} resizeMode="contain" onLoadEnd={() => setImageLoading(false)} onError={() => { setImageError(true); setImageLoading(false); }} />}
        </SafeAreaView>
      </Modal>
      {transaction && receiptUploadOpen && <ReceiptUploadModal transactionId={transaction.id} onClose={() => setReceiptUploadOpen(false)} onSaved={() => { setReceiptUploadOpen(false); reload(); }} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  iconButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  content: { padding: spacing.md, paddingBottom: 24, gap: spacing.lg },
  summary: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  amount: { fontFamily: fontFamily.bold, fontSize: fontSize.display },
  expense: { color: colors.negative },
  income: { color: colors.positive },
  description: { fontFamily: fontFamily.medium, fontSize: fontSize.title, color: colors.textPrimary, textAlign: 'center' },
  type: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.surface, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary, flexShrink: 1 },
  secondary: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textSecondary },
  details: { padding: 0, overflow: 'hidden' },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 44 },
  receiptViewer: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  receiptImage: { flex: 1, width: '100%' },
  edit: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radius.input, borderWidth: 0.5, borderColor: colors.primary, padding: spacing.sm },
  editText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary, textAlign: 'center' },
  revert: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(16,32,46,0.5)' },
  modalCard: { padding: 22, gap: spacing.lg, borderRadius: radius.card, backgroundColor: colors.surface },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: 21, textAlign: 'center', color: colors.textPrimary },
  modalText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 21, textAlign: 'center', color: colors.textSecondary },
  modalSummary: { padding: spacing.lg, borderRadius: radius.input, backgroundColor: colors.background, fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.textPrimary },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  cancelButton: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.input },
  cancelText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
  confirmButton: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.negative },
  confirmText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, textAlign: 'center', color: colors.surface },
  empty: { padding: spacing.lg, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary, textAlign: 'center' },
});
