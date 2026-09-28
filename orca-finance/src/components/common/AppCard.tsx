import { PropsWithChildren } from 'react';
import {
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';

import {
    colors,
    radius,
    spacing,
} from '@/theme';

interface AppCardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
}

export function AppCard({
  children,
  style,
}: AppCardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
});