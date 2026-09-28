import { IconArrowLeft, IconPlayerPause } from '@tabler/icons-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/common/AppCard';
import { finalizeReflectionItem, getReflectionItems, isReflectionReleased } from '@/services/reflection.service';
import { colors, fontFamily, fontSize, spacing } from '@/theme';
import { formatCurrency } from '@/utils/currency';

export default function ReflectionListScreen() {
  const router = useRouter();
  const [, setRevision] = useState(0);
  useFocusEffect(useCallback(() => { setRevision((value) => value + 1); }, []));
  useEffect(() => {
    const timer = setInterval(() => setRevision((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const items = getReflectionItems();
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/transacoes')}>
        <IconArrowLeft size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>Itens em reflexão</Text>
      <View style={styles.spacer} />
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {items.length === 0 && <Text style={styles.caption}>Nenhum item aguardando reflexão.</Text>}
      {items.map((item) => {
        const released = isReflectionReleased(item);
        return <AppCard key={item.id} style={styles.card}>
          <View style={styles.row}><IconPlayerPause size={24} color={colors.warning} />
            <Text style={styles.name}>{item.transaction.description}</Text></View>
          <Text style={styles.amount}>{formatCurrency(item.transaction.amountCents)}</Text>
          <Text style={styles.caption}>Entrada: {new Date(item.enteredAt).toLocaleString('pt-BR')}</Text>
          <Text style={styles.caption}>Liberação: {new Date(item.releaseAt).toLocaleString('pt-BR')} · {item.durationHours} h</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !released }} disabled={!released}
            style={[styles.button, !released && styles.disabled]} onPress={() => {
              try {
                const transaction = finalizeReflectionItem(item.id);
                router.replace({ pathname: '/transacao/[id]', params: { id: transaction.id } });
              } catch (error) {
                Alert.alert('Não foi possível concluir', error instanceof Error ? error.message : 'Tente novamente.');
              }
            }}>
            <Text style={styles.buttonText}>{released ? 'Finalizar compra' : 'Aguarde o fim da reflexão'}</Text>
          </Pressable>
        </AppCard>;
      })}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  spacer: { width: 24 },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.textPrimary },
  amount: { fontFamily: fontFamily.bold, fontSize: 21, color: colors.negative },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textSecondary },
  button: { minHeight: 46, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  disabled: { opacity: 0.5 },
  buttonText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
});
