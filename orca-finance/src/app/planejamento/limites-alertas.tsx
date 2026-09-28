import { IconChevronLeft, IconPlus } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSwitch } from '@/components/common/AppSwitch';
import { getTransactionCategories } from '@/services/transaction.service';
import {
  getSpendingLimitsConfiguration,
  saveSpendingLimitsConfiguration,
} from '@/services/planning.service';
import type { SpendingLimitsConfiguration } from '@/types';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { formatCurrency, parseCurrencyToCents } from '@/utils/currency';

export default function SpendingLimitsScreen() {
  const router = useRouter();
  const initial = useMemo(() => getSpendingLimitsConfiguration(), []);
  const [configuration, setConfiguration] = useState(initial);
  const [dailyValue, setDailyValue] = useState(formatCurrency(initial.dailyLimitCents));
  const [categoryValues, setCategoryValues] = useState<Record<string, string>>(
    Object.fromEntries(initial.categoryLimits.map((item) => [
      item.categoryId, formatCurrency(item.limitCents),
    ])),
  );
  const categories = getTransactionCategories();
  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ?? 'Sem categoria';
  const update = (values: Partial<SpendingLimitsConfiguration>) =>
    setConfiguration((current) => ({ ...current, ...values }));

  const save = () => {
    const dailyLimitCents = parseCurrencyToCents(dailyValue);
    if (configuration.dailyEnabled && (!dailyLimitCents || dailyLimitCents <= 0)) {
      Alert.alert('Revise o limite diário', 'Informe um valor válido.');
      return;
    }
    const categoryLimits = configuration.categoryLimits.map((item) => ({
      ...item,
      limitCents: parseCurrencyToCents(categoryValues[item.categoryId] ?? '') ?? 0,
    }));
    try {
      saveSpendingLimitsConfiguration({
        ...configuration,
        dailyLimitCents: dailyLimitCents ?? configuration.dailyLimitCents,
        categoryLimits,
      });
      router.replace('/(tabs)/planejamento');
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
    }
  };

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/planejamento')} accessibilityRole="button"
        accessibilityLabel="Voltar" style={styles.iconButton}>
        <IconChevronLeft size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>Limites e alertas</Text>
      <View style={styles.iconButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Limite diário</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.label}>Ativar limite diário</Text>
            <Text style={styles.caption}>O acompanhamento reinicia a cada dia.</Text>
          </View>
          <AppSwitch value={configuration.dailyEnabled}
            onChange={(dailyEnabled) => update({ dailyEnabled })}
            accessibilityLabel="Ativar limite diário" />
        </View>
        <TextInput value={dailyValue} onChangeText={setDailyValue}
          editable={configuration.dailyEnabled} keyboardType="decimal-pad"
          accessibilityLabel="Valor do limite diário" style={[
            styles.input, !configuration.dailyEnabled && styles.disabled,
          ]} />
      </View>

      <Text style={styles.sectionTitle}>Limites por categoria</Text>
      {configuration.categoryLimits.map((item) => <View key={item.categoryId} style={styles.card}>
        <Text style={styles.label}>{categoryName(item.categoryId)}</Text>
        <TextInput value={categoryValues[item.categoryId]}
          onChangeText={(value) => setCategoryValues((current) => ({
            ...current, [item.categoryId]: value,
          }))} keyboardType="decimal-pad" style={styles.input}
          accessibilityLabel={`Limite de ${categoryName(item.categoryId)}`} />
        <Text style={styles.pending}>Configuração de período ainda indisponível nesta versão.</Text>
      </View>)}
      <View style={[styles.addLimit, styles.disabled]}>
        <IconPlus size={18} color={colors.textSecondary} />
        <View style={styles.flex}>
          <Text style={styles.addTitle}>Adicionar limite</Text>
          <Text style={styles.caption}>Cadastro de novos limites indisponível nesta versão.</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Receber alertas por</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Push</Text>
          <AppSwitch value={configuration.pushEnabled}
            onChange={(pushEnabled) => update({ pushEnabled })}
            accessibilityLabel="Receber alertas por push" />
        </View>
        <View style={[styles.row, styles.divider]}>
          <Text style={styles.label}>E-mail</Text>
          <AppSwitch value={configuration.emailEnabled}
            onChange={(emailEnabled) => update({ emailEnabled })}
            accessibilityLabel="Receber alertas por e-mail" />
        </View>
      </View>
      <Pressable onPress={save} style={styles.saveButton} accessibilityRole="button">
        <Text style={styles.saveText}>Salvar configurações</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.md },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.md },
  sectionTitle: { marginTop: spacing.sm, fontFamily: fontFamily.bold,
    fontSize: fontSize.title, color: colors.textPrimary },
  card: { padding: spacing.lg, gap: spacing.md, borderWidth: 0.5,
    borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.md },
  flex: { flex: 1 },
  label: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  caption: { marginTop: 2, fontFamily: fontFamily.regular,
    fontSize: fontSize.caption, color: colors.textSecondary },
  input: { minHeight: 46, paddingHorizontal: spacing.lg, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.input, fontFamily: fontFamily.medium,
    fontSize: fontSize.body, color: colors.textPrimary, backgroundColor: colors.surface },
  pending: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.warning },
  disabled: { opacity: 0.55 },
  addLimit: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.border, borderRadius: radius.card },
  addTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textSecondary },
  divider: { paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.border },
  saveButton: { minHeight: 50, marginTop: spacing.md, alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.input, backgroundColor: colors.primary },
  saveText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
});
