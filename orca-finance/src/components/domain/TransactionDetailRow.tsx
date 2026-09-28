import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  showDivider?: boolean;
}

export function TransactionDetailRow({ icon, label, value, showDivider = true }: Props) {
  return (
    <View style={[styles.row, showDivider && styles.divider]}>
      {icon}
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, minHeight: 58 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  content: { flex: 1, gap: spacing.xs },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textSecondary },
  value: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary },
});
