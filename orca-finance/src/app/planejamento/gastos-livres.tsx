import { IconChevronLeft, IconInfoCircle } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsyncState } from '@/components/common/AsyncState';
import { MonthSelector } from '@/components/common/MonthSelector';
import { useProfileResource } from '@/hooks/useProfileResource';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { useAppSession } from '@/contexts/AppSessionContext';
import { localDate } from '@/utils/date';
import { AppCard } from '@/components/common/AppCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import {
  getFreeSpendingAllowance,
  saveFreeSpendingAllowance,
} from '@/services/planning.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency, parseCurrencyToCents } from '@/utils/currency';

export default function FreeSpendingScreen() {
  const { activeProfileId } = useAppSession();
  const router = useRouter();
  const [period, setPeriod] = useState(localDate().slice(0, 7));
  const resource = useProfileResource(useCallback(() => getFreeSpendingAllowance(period), [period]));
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={styles.headerButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/planejamento')}><IconChevronLeft size={25} color={colors.navInactive} /></Pressable><Text style={styles.title}>Gastos livres</Text><View style={styles.headerButton} /></View>
    <MonthSelector value={period} onChange={setPeriod} />
    {!!resource.error && resource.data !== undefined && <AsyncState error={resource.error} onRetry={resource.reload} />}
    {resource.data === undefined ? <AsyncState loading={resource.loading} error={resource.error} onRetry={resource.reload} />
      : <QuotaForm key={`${activeProfileId}:${period}`} allowance={resource.data} period={period} reload={resource.reload} refreshing={resource.refreshing} />}
  </SafeAreaView>;
}
function QuotaForm({ allowance, period, reload, refreshing }: { allowance?: Awaited<ReturnType<typeof getFreeSpendingAllowance>>; period: string; refreshing: boolean; reload: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(allowance ? formatCurrency(allowance.limitCents) : '');
  const mutation = useProfileMutation();
  const save = () => {
    const limitCents = parseCurrencyToCents(value);
    if (!limitCents || limitCents <= 0) {
      Alert.alert('Revise a cota', 'Informe um valor mensal válido.');
      return;
    }
    void mutation.run(() => saveFreeSpendingAllowance(limitCents, period), () => router.replace('/(tabs)/planejamento'));
  };

  return <View style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />} contentContainerStyle={styles.content}>
      {allowance ? <AppCard style={styles.quotaCard}>
        <Text style={styles.caption}>Cota mensal</Text>
        <Text style={styles.quota}>{formatCurrency(allowance.limitCents)}</Text>
        <Text style={styles.description}>Disponível para gastos marcados como livres</Text>
        <ProgressBar progress={allowance.limitCents === 0 ? 0 : allowance.usedCents / allowance.limitCents}
          color={colors.primary} />
        <View style={styles.pendingBox}>
          <Text style={styles.pendingText}>Utilizado: {formatCurrency(allowance.usedCents)}</Text>
          <Text style={styles.pendingText}>Restante: {formatCurrency(allowance.remainingCents)}</Text>
        </View>
      </AppCard>
      : <Text style={styles.caption}>Nenhuma cota configurada para {period}.</Text>}
      <AppCard style={styles.configCard}>
        <Text style={styles.sectionTitle}>Configuração</Text>
        <Text style={styles.label}>Valor da cota mensal</Text>
        <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad"
          style={styles.input} accessibilityLabel="Valor da cota mensal" />
        <Text style={styles.caption}>Esta cota vale para o mês selecionado.</Text>
        {!!mutation.error && <Text accessibilityRole="alert" style={styles.caption}>{mutation.error}</Text>}
        <Pressable disabled={mutation.busy} onPress={save} style={styles.saveButton} accessibilityRole="button">
          <Text style={styles.saveText}>{mutation.busy ? 'Salvando…' : 'Salvar cota'}</Text>
        </Pressable>
      </AppCard>
      <AppCard style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <IconInfoCircle size={24} color={colors.primary} />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Como funciona?</Text>
          <Text style={styles.description}>
            Apenas despesas marcadas como gasto livre no cadastro consomem esta cota.
            Elas continuam compondo o saldo e os totais financeiros.
          </Text>
        </View>
      </AppCard>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.md },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.medium, fontSize: 20, color: colors.textPrimary },
  content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.lg },
  quotaCard: { gap: spacing.sm, padding: 20 },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  quota: { fontFamily: fontFamily.bold, fontSize: 28, color: colors.textPrimary },
  description: { fontFamily: fontFamily.regular, fontSize: fontSize.body,
    lineHeight: 20, color: colors.textSecondary },
  pendingBox: { marginTop: spacing.md, padding: spacing.md,
    borderRadius: radius.input, backgroundColor: colors.primaryTint },
  pendingText: { fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  configCard: { gap: spacing.md, padding: 20 },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  label: { marginTop: spacing.sm, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textSecondary },
  input: { minHeight: 50, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.bold,
    fontSize: fontSize.title, color: colors.textPrimary, backgroundColor: colors.surface },
  saveButton: { minHeight: 50, marginTop: spacing.md, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  saveText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
  infoCard: { flexDirection: 'row', gap: spacing.lg, padding: 20 },
  infoIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.icon, backgroundColor: colors.primaryTint },
  infoContent: { flex: 1, gap: spacing.xs },
  infoTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
});
