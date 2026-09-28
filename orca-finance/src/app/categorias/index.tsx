import { IconChevronDown, IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSubcategory, getCategoriesWithSubcategories } from '@/services/category.service';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export default function CategoriesScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(() => new Set(['category-food']));
  const [revision, setRevision] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const categories = useMemo(() => getCategoriesWithSubcategories(), [revision]);
  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const close = () => { setCategoryId(null); setName(''); };
  const save = () => {
    if (!categoryId) return;
    try {
      createSubcategory({ categoryId, name });
      setExpanded((current) => new Set(current).add(categoryId));
      setRevision((current) => current + 1);
      close();
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
    }
  };

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
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Organize suas transações com subcategorias personalizadas.</Text>
      {categories.map((category) => <View key={category.id} style={styles.card}>
        <Pressable onPress={() => toggle(category.id)} style={styles.cardHeader}
          accessibilityRole="button" accessibilityState={{ expanded: expanded.has(category.id) }}>
          <Text style={styles.category}>{category.name}</Text>
          {expanded.has(category.id)
            ? <IconChevronDown size={20} color={colors.textSecondary} />
            : <IconChevronRight size={20} color={colors.textSecondary} />}
        </Pressable>
        {expanded.has(category.id) && <View style={styles.subcategories}>
          {category.subcategories.length === 0
            ? <Text style={styles.muted}>Nenhuma subcategoria.</Text>
            : category.subcategories.map((item) =>
              <Text key={item.id} style={styles.item}>• {item.name}</Text>)}
          <Pressable onPress={() => setCategoryId(category.id)} style={styles.addButton}
            accessibilityRole="button">
            <IconPlus size={18} color={colors.primary} />
            <Text style={styles.addText}>Nova subcategoria</Text>
          </Pressable>
        </View>}
      </View>)}
    </ScrollView>
    <SubcategoryModal visible={categoryId !== null} categoryName={
      categories.find((item) => item.id === categoryId)?.name
    } name={name} onNameChange={setName} onClose={close} onSave={save} />
  </SafeAreaView>;
}

function SubcategoryModal(props: {
  visible: boolean;
  categoryName?: string;
  name: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return <Modal visible={props.visible} transparent animationType="fade"
    onRequestClose={props.onClose}>
    <View style={styles.overlay}><View style={styles.modal}>
      <Text style={styles.modalTitle}>Nova subcategoria</Text>
      <Text style={styles.muted}>{props.categoryName}</Text>
      <Text style={styles.label}>Nome</Text>
      <TextInput value={props.name} onChangeText={props.onNameChange} autoFocus maxLength={50}
        placeholder="Ex.: Feira" placeholderTextColor={colors.navInactive} style={styles.input} />
      <View style={styles.actions}>
        <Pressable onPress={props.onClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={props.onSave} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Salvar</Text>
        </Pressable>
      </View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
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
  subcategories: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
    borderTopWidth: 0.5, borderTopColor: colors.border },
  item: { paddingTop: spacing.md, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textPrimary },
  muted: { paddingTop: spacing.md, fontFamily: fontFamily.regular,
    fontSize: fontSize.body, color: colors.textSecondary },
  addButton: { minHeight: 44, marginTop: spacing.sm, flexDirection: 'row',
    alignItems: 'center', gap: spacing.xs },
  addText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(16,32,46,0.35)' },
  modal: { borderRadius: radius.sheet, padding: 20, backgroundColor: colors.surface },
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
