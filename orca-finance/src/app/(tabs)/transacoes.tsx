import { TransactionFiltersSheet } from '@/components/domain/TransactionFiltersSheet';
import { TransactionItem } from '@/components/domain/TransactionItem';
import { getTransactions, groupTransactions, type TransactionFilters } from '@/services/transaction.service';
import { getTransactionCatalog } from '@/services/category.service';
import { getRemoteReflectionItems } from '@/services/reflection.service';
import { useProfileResource } from '@/hooks/useProfileResource';
import { AsyncState } from '@/components/common/AsyncState';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { IconAdjustmentsHorizontal, IconCalendar, IconCategory, IconPlayerPause, IconSearch, IconTag, IconX } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Keyboard, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TransacoesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reflectionOnly, setReflectionOnly] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const closeFilters = () => setFiltersOpen(false);
  const openFilters = () => { Keyboard.dismiss(); setFiltersOpen(true); };
  const load = useCallback(async () => {
    const [transactions, catalog, reflections] = await Promise.all([
      getTransactions(query, filters), getTransactionCatalog(),
      reflectionOnly ? getRemoteReflectionItems() : Promise.resolve([]),
    ]);
    return { transactions, catalog, reflections };
  }, [query, filters, reflectionOnly]);
  const { data, loading, refreshing, error, reload } = useProfileResource(load);
  const sections = groupTransactions(data?.transactions ?? []);
  const reflectionItems = data?.reflections.filter(item => item.descricao.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))) ?? [];
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <SectionList
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} colors={[colors.primary]} />}
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
              {reflectionItems.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push('/reflexao')}><Text style={styles.empty}>{item.descricao} ? {item.liberado ? 'Liberado' : 'Em espera'}</Text></Pressable>)}
            </View>}
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title.toLocaleUpperCase('pt-BR')}</Text>}
        renderItem={({ item }) => <TransactionItem {...item} variant="list"
          onPress={() => router.push({ pathname: '/transacao/[id]', params: { id: item.id } })} />}
        ListEmptyComponent={loading || error ? <AsyncState loading={loading} error={error} onRetry={reload} /> : reflectionOnly
          ? reflectionItems.length === 0
            ? <Text style={styles.empty}>Nenhum item em reflexão encontrado.</Text>
            : null
          : <Text style={styles.empty}>Nenhuma transação encontrada.</Text>}
      />
      <TransactionFiltersSheet visible={filtersOpen} onCancel={closeFilters}
        value={filters} categories={data?.catalog.categories ?? []}
        onApply={value => { setFilters(value); closeFilters(); }} onClear={() => { setFilters({}); closeFilters(); }} />
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
