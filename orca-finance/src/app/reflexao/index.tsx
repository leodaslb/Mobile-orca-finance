import { IconArrowLeft, IconPlayerPause } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/common/AppCard';
import { discardRemoteReflectionItem, getRemoteReflectionItems } from '@/services/reflection.service';
import { useProfileMutation } from '@/hooks/useProfileMutation';
import { useProfileResource } from '@/hooks/useProfileResource';
import { AsyncState } from '@/components/common/AsyncState';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

export default function ReflectionListScreen() {
  const router = useRouter();
  const load = useCallback(() => getRemoteReflectionItems(), []);
  const { data, loading, refreshing, error, reload } = useProfileResource(load);
  const mutation = useProfileMutation();
  const items = data ?? [];
  useEffect(() => { const timer = setInterval(reload, 30000); return () => clearInterval(timer); }, [reload]);
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={10} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/transacoes')}>
        <IconArrowLeft size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title}>Itens em reflexão</Text>
      <View style={styles.spacer} />
    </View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      <Text style={styles.caption}>Após a espera, confirme a decisão e preencha novamente os dados da compra, ou desista. Nenhuma compra é registrada automaticamente.</Text>
      {(loading || error) && <AsyncState loading={loading} error={error} onRetry={reload} />}
      {!!mutation.error && <AsyncState error={mutation.error} />}
      {!loading && !error && items.length === 0 && <Text style={styles.caption}>Nenhum item aguardando reflexão.</Text>}
      {items.map((item) => {
        const released = item.liberado;
        return <AppCard key={item.id} style={styles.card}>
          <View style={styles.row}><IconPlayerPause size={24} color={colors.warning} />
            <Text style={styles.name}>{item.descricao}</Text></View>
          <Text style={styles.caption}>Entrada: {new Date(item.entradaEm).toLocaleString('pt-BR')}</Text>
          <Text style={styles.caption}>Liberação: {new Date(item.liberaEm).toLocaleString('pt-BR')} · {item.duracaoHoras} h</Text>
          <Text style={styles.caption}>{released ? 'Período concluído · escolha como continuar' : 'Aguarde o fim da reflexão'}</Text>
          {released && <>
            <Pressable accessibilityRole="button" disabled={mutation.busy} accessibilityState={{ disabled: mutation.busy }}
              style={[styles.button, mutation.busy && styles.disabled]}
              onPress={() => router.push({ pathname: '/transacao/nova', params: { reflectionItemId: item.id } })}>
              <Text style={styles.buttonText}>Confirmar decisão</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={mutation.busy} accessibilityState={{ disabled: mutation.busy, busy: mutation.busy }}
              style={[styles.button, styles.discard, mutation.busy && styles.disabled]}
              onPress={() => mutation.run(() => discardRemoteReflectionItem(item.id), reload)}>
              <Text style={styles.discardText}>{mutation.busy ? 'Aguarde…' : 'Desistir'}</Text>
            </Pressable>
          </>}
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
  discard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  discardText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textSecondary },
  buttonText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.surface },
});
