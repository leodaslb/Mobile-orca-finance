import { SubcategoryModal } from '@/components/domain/SubcategoryModal';
import { categoryPresentation } from '@/utils/category-presentation';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconPlus, IconPencil } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createRemoteSubcategory, updateRemoteSubcategory, getTransactionCatalog, type CatalogSubcategory } from '@/services/category.service';
import { useProfileResource } from '@/hooks/useProfileResource';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { AppSwitch } from '@/components/common/AppSwitch';
import { useAppSession } from '@/contexts/AppSessionContext';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export default function CategoriesScreen() {
  const { activeProfileId } = useAppSession();
  return <CategoriesContent key={activeProfileId} />;
}
function CategoriesContent() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const mutation = useProfileMutation();
  const [editing, setEditing] = useState<CatalogSubcategory | null>(null);
  const [active, setActive] = useState(true);
  const [validation, setValidation] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const load = useCallback(() => getTransactionCatalog(), []);
  const { data, loading, refreshing, error, reload } = useProfileResource(load);
  const categories = data?.categories.map(c => ({ ...c, subcategories: data.subcategories.filter(sub => sub.categoryId === c.id) })) ?? [];
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const close = () => { if (mutation.busy) return; setCategoryId(null); setName(''); setEditing(null); setValidation(''); };
  function open(category: string, item?: CatalogSubcategory) {
    setCategoryId(category); setEditing(item ?? null); setName(item?.name ?? ''); setActive(item?.active ?? true); setValidation('');
  }
  function save() {
    if (!categoryId) return;
    if (!name.trim()) { setValidation('Informe o nome da subcategoria.'); return; }
    setValidation('');
    void mutation.run(() => editing ? updateRemoteSubcategory(editing.id, { name, active }) : createRemoteSubcategory(categoryId, name), () => {
      setExpanded(current => new Set(current).add(categoryId));
      setCategoryId(null); setName(''); setEditing(null); reload();
    });
  }

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={() => router.canGoBack()
        ? router.back()
        : router.replace('/(tabs)/transacoes')} style={styles.iconButton}
        accessibilityRole="button" accessibilityLabel="Voltar">
        <IconChevronLeft size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>Categorias</Text><View style={styles.iconButton} />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>As categorias principais são fixas. Você pode gerenciar suas subcategorias.</Text>
      {(loading || error) && <AsyncState loading={loading} error={error} onRetry={reload} />}
      {!loading && !error && !categories.length && <Text style={styles.muted}>Nenhuma categoria disponível.</Text>}
      {categories.filter(c => c.active).map((category) => <View key={category.id} style={styles.card}>
        <Pressable onPress={() => toggle(category.id)} style={styles.cardHeader}
          accessibilityRole="button" accessibilityState={{ expanded: expanded.has(category.id) }}>
          <View style={styles.categoryHeading}><View style={[styles.categoryIcon, { backgroundColor: categoryPresentation(category.name).background }]}><CategoryIcon name={category.name} /></View><Text style={styles.category}>{category.name}</Text></View>
          {expanded.has(category.id)
            ? <IconChevronDown size={20} color={colors.textSecondary} />
            : <IconChevronRight size={20} color={colors.textSecondary} />}
        </Pressable>
        {expanded.has(category.id) && <View style={styles.subcategories}>
          {category.subcategories.length === 0
            ? <Text style={styles.muted}>Nenhuma subcategoria.</Text>
            : category.subcategories.map((item) =>
              <Pressable key={item.id} onPress={() => open(category.id, item)} style={styles.subcategoryRow} accessibilityRole="button" accessibilityLabel={`Editar subcategoria ${item.name}`}>
                <Text style={[styles.item, !item.active && styles.muted]}>{item.name}{!item.active ? ' · Inativa' : ''}</Text><IconPencil size={18} color={colors.textSecondary} />
              </Pressable>)}
          <Pressable onPress={() => open(category.id)} style={styles.addButton}
            accessibilityRole="button">
            <IconPlus size={18} color={colors.primary} />
            <Text style={styles.addText}>Nova subcategoria</Text>
          </Pressable>
        </View>}
      </View>)}
    </ScrollView>
    <SubcategoryModal visible={categoryId !== null} categoryName={
      categories.find((item) => item.id === categoryId)?.name
    } editing={!!editing} active={active} onActiveChange={setActive} error={validation || mutation.error} busy={mutation.busy} name={name} onNameChange={setName} onClose={close} onSave={save} />
  </SafeAreaView>;
}


const styles = StyleSheet.create({
  categoryHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  categoryIcon: { width: 38, height: 38, borderRadius: radius.icon, alignItems: 'center', justifyContent: 'center' },
  subcategoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: spacing.md },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  content: { padding: spacing.lg, paddingBottom: 32, gap: spacing.md },
  intro: { marginBottom: spacing.sm, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  card: { overflow: 'hidden', borderRadius: radius.card, borderWidth: 0.5,
    borderColor: colors.border, backgroundColor: colors.surface },
  cardHeader: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between' },
  category: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  subcategories: { paddingLeft: 66, paddingRight: spacing.lg, paddingBottom: spacing.lg },
  item: { flex: 1, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textPrimary },
  muted: { paddingTop: spacing.md, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  addButton: { minHeight: 44, marginTop: spacing.sm, flexDirection: 'row',
    alignItems: 'center', gap: spacing.xs },
  addText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
});
