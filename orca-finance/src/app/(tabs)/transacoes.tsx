import { TransactionFiltersSheet } from '@/components/domain/TransactionFiltersSheet';
import { TransactionItem } from '@/components/domain/TransactionItem';
import { getTransactionCategories, getTransactionSections } from '@/services/transaction.service';
import { getReflectionItems } from '@/services/reflection.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { IconAdjustmentsHorizontal, IconCalendar, IconCategory, IconPlayerPause, IconSearch, IconTag, IconX } from '@tabler/icons-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Keyboard, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TransacoesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reflectionOnly, setReflectionOnly] = useState(false);
  const [dataRevision, setDataRevision] = useState(0);
  const closeFilters = () => setFiltersOpen(false);
  const openFilters = () => { Keyboard.dismiss(); setFiltersOpen(true); };

  useFocusEffect(
    useCallback(() => {
      setDataRevision((current) => current + 1);
    }, []),
  );

  const sections = useMemo(
    () => getTransactionSections(query),
    [dataRevision, query],
  );
  const reflectionItems = useMemo(() => reflectionOnly
    ? getReflectionItems(query)
    : [], [dataRevision, query, reflectionOnly]);
  const categoryNames = useMemo(() => new Map(getTransactionCategories()
    .map((category) => [category.id, category.name])), []);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <SectionList
        sections={reflectionOnly ? [] : sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Transações</Text>
              <Pressable onPress={() => router.push('/categorias')} style={styles.categoriesButton}
                accessibilityRole="button" accessibilityLabel="Gerenciar categorias e subcategorias">
                <IconCategory size={18} color={colors.primary} />
                <Text style={styles.categoriesText}>Categorias</Text>
              </Pressable>
            </View>
            <View style={styles.search}>
              <IconSearch size={20} color={colors.navInactive} />
              <TextInput style={styles.input} value={query} onChangeText={setQuery}
                placeholder="Buscar transações" placeholderTextColor={colors.navInactive}
                accessibilityLabel="Buscar transações por descrição" autoCorrect={false} returnKeyType="search" />
              {query.length > 0 && <Pressable onPress={() => setQuery('')} style={styles.clear}
                accessibilityRole="button" accessibilityLabel="Limpar busca">
                <IconX size={18} color={colors.textSecondary} />
              </Pressable>}
            </View>
            <View style={styles.filters}>
              <Pressable onPress={() => setReflectionOnly((current) => !current)}
                style={[styles.chip, reflectionOnly && styles.chipActive]} accessibilityRole="button"
                accessibilityState={{ selected: reflectionOnly }} accessibilityLabel="Filtrar itens em reflexão">
                <IconPlayerPause size={18} color={colors.primary} /><Text style={styles.chipText}>Em reflexão</Text>
              </Pressable>
              <Pressable onPress={openFilters} style={styles.chip} accessibilityRole="button" accessibilityLabel="Abrir filtros por data">
                <IconCalendar size={18} color={colors.primary} /><Text style={styles.chipText}>Data</Text>
              </Pressable>
              <Pressable onPress={openFilters} style={styles.chip} accessibilityRole="button" accessibilityLabel="Abrir filtros por categoria">
                <IconTag size={18} color={colors.primary} /><Text style={styles.chipText}>Categoria</Text>
              </Pressable>
              <Pressable onPress={openFilters} style={styles.chip} accessibilityRole="button" accessibilityLabel="Abrir todos os filtros">
                <IconAdjustmentsHorizontal size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            {reflectionOnly && reflectionItems.length > 0 && <View style={styles.reflectionResults}>
              <Text style={styles.sectionTitle}>AGUARDANDO REFLEXÃO</Text>
              {reflectionItems.map((item) => <TransactionItem key={item.id}
                description={item.transaction.description} categoryId={item.transaction.categoryId}
                categoryName={categoryNames.get(item.transaction.categoryId ?? '') ?? 'Sem categoria'}
                amountCents={item.transaction.amountCents} type="expense" status="reflection"
                variant="list" onPress={() => router.push('/reflexao')} />)}
            </View>}
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title.toLocaleUpperCase('pt-BR')}</Text>}
        renderItem={({ item }) => <TransactionItem {...item} variant="list"
          onPress={() => router.push({ pathname: '/transacao/[id]', params: { id: item.id } })} />}
        ListEmptyComponent={reflectionOnly
          ? reflectionItems.length === 0
            ? <Text style={styles.empty}>Nenhum item em reflexão encontrado.</Text>
            : null
          : <Text style={styles.empty}>Nenhuma transação encontrada.</Text>}
      />
      <TransactionFiltersSheet visible={filtersOpen} onCancel={closeFilters}
        onApply={closeFilters} onClear={closeFilters} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 24 },
  header: { gap: spacing.lg },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoriesButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center',
    gap: spacing.xs, paddingHorizontal: spacing.md },
  categoriesText: { fontFamily: fontFamily.bold, fontSize: fontSize.label, color: colors.primary },
  search: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.input, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 48, padding: spacing.md, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary },
  clear: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, backgroundColor: colors.primaryTint, borderRadius: radius.pill },
  chipActive: { borderWidth: 1, borderColor: colors.primary },
  chipText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.primary },
  reflectionResults: { marginTop: spacing.sm },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: colors.textSecondary },
  empty: { paddingVertical: spacing.lg, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
});
