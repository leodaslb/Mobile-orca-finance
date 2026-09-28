import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

interface AppSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function AppSwitch({
  value,
  onChange,
  disabled = false,
  accessibilityLabel,
}: AppSwitchProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onChange(!value)}
      style={[
        styles.track,
        value && styles.trackActive,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.thumb, value && styles.thumbActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  trackActive: {
    backgroundColor: colors.primary,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  thumbActive: {
    alignSelf: 'flex-end',
  },
  disabled: {
    opacity: 0.55,
  },
});
