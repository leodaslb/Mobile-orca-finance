import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { IconCalendar, IconClock } from '@tabler/icons-react-native';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '@/theme';
import { formatDateInput, isValidTime, localDate, parseBrazilianDateToISO } from '@/utils/date';

interface Props { mode: 'date' | 'time'; value: string; onChange: (value: string) => void; disabled?: boolean }

export function DateTimeField({ mode, value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const selected = new Date();
  if (mode === 'date') {
    const iso = parseBrazilianDateToISO(value);
    if (iso) { const [year, month, day] = iso.split('-').map(Number); selected.setFullYear(year, month - 1, day); }
  } else if (isValidTime(value)) {
    const [hour, minute] = value.split(':').map(Number); selected.setHours(hour, minute, 0, 0);
  }
  function change(_event: DateTimePickerChangeEvent, next: Date) {
    setOpen(false);
    onChange(mode === 'date' ? localDate(next).split('-').reverse().join('/')
      : `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`);
  }
  function show() {
    if (disabled) return;
    Keyboard.dismiss();
    if (Platform.OS === 'android') DateTimePickerAndroid.open({ value: selected, mode, is24Hour: true, onValueChange: change, onDismiss: () => setOpen(false) });
    else setOpen(true);
  }
  const label = mode === 'date' ? 'Selecionar data' : 'Selecionar horário';
  // Mantém o teclado como alternativa no web, onde não há diálogo nativo.
  if (Platform.OS === 'web') return <TextInput accessibilityLabel={label} editable={!disabled}
    value={value} placeholder={mode === 'date' ? 'dd/mm/aaaa' : 'hh:mm'} style={styles.value}
    onChangeText={text => onChange(mode === 'date' ? formatDateInput(text)
      : text.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d+)/, '$1:$2'))} />;
  const Icon = mode === 'date' ? IconCalendar : IconClock;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value }}
      accessibilityState={{ disabled }} disabled={disabled} onPress={show} style={styles.field}>
      <Text style={[styles.value, !value && styles.placeholder]}>{value || (mode === 'date' ? 'dd/mm/aaaa' : 'hh:mm')}</Text>
      <Icon size={20} color={colors.textSecondary} />
    </Pressable>
    {open && <View><DateTimePicker value={selected} mode={mode} is24Hour onValueChange={change} onDismiss={() => setOpen(false)} /></View>}
  </>;
}

const styles = StyleSheet.create({
  field: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textPrimary },
  placeholder: { color: colors.navInactive },
});
