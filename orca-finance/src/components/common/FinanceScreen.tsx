import { IconArrowLeft, IconChevronRight, IconArrowUpRight, IconAlertTriangle, IconFolderOpen } from '@tabler/icons-react-native';
import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from './AppCard';
import { DateTimeField } from './DateTimeField';
import { FormScrollView } from './KeyboardLayout';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { centsToDecimal, decimalToCents, formatCurrency, parseCurrencyToCents } from '@/utils/currency';
import { parseBrazilianDateToISO } from '@/utils/date';
import { ApiError } from '@/services/api-client';

export function money(value: string) {
  try { return formatCurrency(decimalToCents(value)); }
  catch { const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value); return match ? `${match[1]}R$ ${match[2].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${(match[3] ?? '').padEnd(2, '0')}` : 'Valor indisponível'; }
}
export function moneyDifference(left: string, right: string) {
  try {
    const cents = (value: string) => { const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value); if (!match) throw new Error('Decimal inválido'); return (BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))) * (match[1] ? -1n : 1n); };
    const difference = cents(left) - cents(right), absolute = difference < 0n ? -difference : difference;
    return money(`${difference < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`);
  } catch { return 'Não calculável'; }
}
export function moneyInput(value: string, allowZero = false) {
  const cents = parseCurrencyToCents(value);
  if (cents === null || (allowZero ? cents < 0 : cents <= 0)) throw new ApiError(400, allowZero ? 'Informe um valor válido.' : 'Informe um valor maior que zero.');
  return centsToDecimal(cents);
}
export function inputDate(value: string) {
  const result = parseBrazilianDateToISO(value);
  if (!result) throw new ApiError(400, 'Informe uma data válida.');
  return result;
}
export function FinanceScreen({ title, subtitle, children, refresh, refreshing = false }: {
  title: string; subtitle?: string; children: ReactNode; refresh?: () => void; refreshing?: boolean;
}) {
  const router = useRouter();
  return <SafeAreaView style={ui.screen} edges={['top', 'bottom']}>
    <View style={ui.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={({ pressed }) => [ui.back, pressed && ui.pressed]}
      onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}><IconArrowLeft size={23} color={colors.textPrimary} /></Pressable>
      <Text accessibilityRole="header" style={ui.title}>{title}</Text><View style={ui.headerSpacer} /></View>
    <FormScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ui.content}
      refreshControl={refresh ? <RefreshControl tintColor={colors.primary} colors={[colors.primary]} refreshing={refreshing} onRefresh={refresh} /> : undefined}>
      {subtitle && <Text style={ui.subtitle}>{subtitle}</Text>}{children}
    </FormScrollView></SafeAreaView>;
}
export function Action({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.action, secondary && ui.secondary, pressed && ui.pressed, disabled && { opacity: 0.5 }]}><Text style={[ui.actionText, secondary && { color: colors.primary }]}>{label}</Text></Pressable>;
}
export function Destination({ title, caption, href }: { title: string; caption?: string; href: Href }) {
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => pressed && ui.pressed} onPress={() => router.push(href)}><AppCard style={ui.row}>
    <View style={ui.iconTile}><IconArrowUpRight size={21} color={colors.primary} /></View>
    <View style={{ flex: 1, gap: 4 }}><Text style={ui.heading}>{title}</Text>{caption && <Text style={ui.caption}>{caption}</Text>}</View>
    <IconChevronRight size={20} color={colors.primary} /></AppCard></Pressable>;
}
export function Field({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return <View style={ui.field}><Text style={ui.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value}
    placeholder={numeric ? '0,00' : undefined} placeholderTextColor={colors.navInactive} selectionColor={colors.primary}
    onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} style={ui.input} /></View>;
}
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <View style={ui.field}><Text style={ui.fieldLabel}>{label}</Text><View style={[ui.input, { paddingVertical: 2 }]}><DateTimeField mode="date" value={value} onChange={onChange} /></View></View>;
}
export function Choices<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return <View style={{ gap: 8 }}><Text style={ui.fieldLabel}>{label}</Text><View style={ui.wrap}>{options.map(option => <Pressable key={option.value}
    accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)}
    style={({ pressed }) => [ui.chip, value === option.value && ui.selected, pressed && ui.pressed]}><Text style={[ui.choiceText, value === option.value && { color: colors.surface }]}>{option.label}</Text></Pressable>)}</View></View>;
}
export function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'warning' }) {
  const color = tone === 'warning' ? colors.warning : colors.negative;
  return <View style={[ui.notice, { borderColor: `${color}44`, backgroundColor: `${color}08` }]}><IconAlertTriangle size={18} color={color} /><Text accessibilityRole="alert" style={ui.noticeText}>{children}</Text></View>;
}
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <AppCard style={ui.empty}><View style={ui.iconTile}><IconFolderOpen size={24} color={colors.primary} /></View><Text style={ui.heading}>{title}</Text>{description && <Text style={[ui.caption, { textAlign: 'center' }]}>{description}</Text>}</AppCard>;
}
export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <View style={ui.section}><View style={{ gap: 4 }}><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>{description && <Text style={ui.caption}>{description}</Text>}</View>{children}</View>;
}
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'positive' | 'warning' | 'negative' }) {
  const color = { neutral: colors.primary, positive: colors.positive, warning: colors.warning, negative: colors.negative }[tone];
  return <View style={[ui.badge, { backgroundColor: `${color}12` }]}><View style={[ui.dot, { backgroundColor: color }]} /><Text style={[ui.badgeText, { color: tone === 'warning' ? colors.textPrimary : color }]}>{label}</Text></View>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, gap: 16, paddingBottom: 36, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { height: 44, width: 44, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, headerSpacer: { width: 44 },
  title: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.body, lineHeight: 22, color: colors.textSecondary, paddingBottom: 2 },
  heading: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.textPrimary },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  amount: { fontFamily: fontFamily.bold, fontSize: 28, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  card: { padding: 16, gap: 12, borderWidth: 0.5 }, row: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { gap: 8 }, fieldLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.label, color: colors.textPrimary },
  input: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, backgroundColor: colors.surface, fontFamily: fontFamily.regular, fontSize: 15, color: colors.textPrimary },
  action: { minHeight: 50, borderRadius: radius.input, padding: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  actionText: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.surface },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.surface, maxWidth: '100%' },
  choiceText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  selected: { borderColor: colors.primary, backgroundColor: colors.primary }, pressed: { opacity: 0.72 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 0.5, borderColor: `${colors.negative}44`, borderRadius: radius.card, backgroundColor: `${colors.negative}08`, padding: 14 },
  noticeText: { flex: 1, color: colors.textPrimary, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 20 },
  iconTile: { width: 42, height: 42, borderRadius: radius.card, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, gap: 12, alignItems: 'center' }, section: { gap: 12, paddingTop: 4 }, sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 }, badgeText: { fontFamily: fontFamily.medium, fontSize: 11 }, dot: { width: 6, height: 6, borderRadius: 3 },
  split: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, divider: { height: 0.5, backgroundColor: colors.border },
});
