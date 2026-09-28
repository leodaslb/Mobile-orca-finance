import {
    StyleSheet,
    View,
} from 'react-native';

import {
    colors,
    radius,
} from '@/theme';

interface ProgressBarProps {
  progress: number;
  accessibilityLabel?: string;
  color?: string;
}

export function ProgressBar({
  progress,
  accessibilityLabel,
  color = colors.primary,
}: ProgressBarProps) {
  const normalizedProgress = Math.min(
    Math.max(progress, 0),
    1
  );

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(normalizedProgress * 100),
      }}
      style={styles.track}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${normalizedProgress * 100}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
    borderRadius: radius.icon,
    backgroundColor: colors.border,
  },

  fill: {
    height: '100%',
    borderRadius: radius.icon,
  },
});
