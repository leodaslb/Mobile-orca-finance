import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

export function KeyboardLayout({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, style]}>
    {children}
  </KeyboardAvoidingView>;
}

export function FormScrollView({ children, style, contentContainerStyle, ...props }: ScrollViewProps) {
  return <KeyboardLayout>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      {...props} style={[styles.container, style]} contentContainerStyle={[styles.content, contentContainerStyle]}>
      {children}
    </ScrollView>
  </KeyboardLayout>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { flexGrow: 1 } });
