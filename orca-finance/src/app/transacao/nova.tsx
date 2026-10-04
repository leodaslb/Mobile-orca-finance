import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Alert, Pressable, StyleSheet, Text, View, } from 'react-native';

import { SafeAreaView, } from 'react-native-safe-area-context';

import { IconArrowLeft, } from '@tabler/icons-react-native';

import { TransactionForm, } from '@/components/domain/TransactionForm';

import { useCallback, useRef, useState } from 'react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { AsyncState } from '@/components/common/AsyncState';
import { useProfileResource } from '@/hooks/useProfileResource';
import { getTransactionCatalog } from '@/services/category.service';
import { createTransaction, getTransactionById, updateTransaction, PartialTransactionWriteError } from '@/services/transaction.service';
import { ApiError, errorMessage, getApiSession, SessionChangedError } from '@/services/api-client';
import { createRemoteReflectionItem, getRemoteReflectionItem } from '@/services/reflection.service';
import { colors, fontFamily, fontSize, spacing, } from '@/theme';

export default function NovaTransacaoScreen() {
  const router = useRouter();
  const { editId, reflectionItemId } = useLocalSearchParams<{ editId?: string; reflectionItemId?: string }>();
  const { account, activeProfileId } = useAppSession();
  const [busy, setBusy] = useState(false); const sending = useRef(false);
  const [submitError, setSubmitError] = useState('');
  const load = useCallback(async () => {
    if (editId && reflectionItemId) throw new ApiError(400, 'Abra uma nova compra para confirmar a reflexão.');
    const reflection = reflectionItemId ? await getRemoteReflectionItem(reflectionItemId) : undefined;
    if (reflection && !reflection.liberado) throw new ApiError(409, 'Aguarde o fim do período de reflexão.');
    return { catalog: await getTransactionCatalog(), reflection,
      original: editId ? await getTransactionById(editId) : undefined };
  }, [editId, reflectionItemId]);
  const { data, loading, error, reload } = useProfileResource(load);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView
        style={styles.screen}
        edges={['top']}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }

                router.replace('/transacoes');
              }}
            style={styles.backButton}
          >
            <IconArrowLeft
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>

          <Text style={styles.title}>
            {editId ? 'Editar transação' : 'Nova transação'}
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>


        {!data ? <AsyncState loading={loading} error={error} onRetry={reload} /> : <>
        {!!error && <AsyncState error={error} onRetry={reload} />}
        <TransactionForm
          key={`${account?.id}:${activeProfileId}:${editId ?? reflectionItemId ?? 'new'}`}
          {...data.catalog} initialValues={data.original} editing={!!editId} busy={busy} error={submitError}
          initialDescription={data.reflection?.descricao} expenseOnly={!!reflectionItemId}
          onPlaceInReflection={!editId && !reflectionItemId ? async (input, hours) => {
            if (sending.current) return;
            sending.current = true; setBusy(true); setSubmitError('');
            const revision = getApiSession().revision;
            try {
              await createRemoteReflectionItem(input.description, hours);
              if (revision !== getApiSession().revision) return;
              router.replace('/reflexao');
            } catch (caught) {
              if (revision === getApiSession().revision && !(caught instanceof SessionChangedError)) setSubmitError(errorMessage(caught));
            } finally { sending.current = false; setBusy(false); }
          } : undefined}
          onSubmit={async (input, recurrence) => {
            if (sending.current) return;
            sending.current = true; setBusy(true); setSubmitError('');
            const revision = getApiSession().revision;
            try {
              const saved = editId && data.original
                ? await updateTransaction(editId, input, data.original)
                : await createTransaction(input, recurrence, reflectionItemId);
              if (revision !== getApiSession().revision) return;
              router.replace({ pathname: '/transacao/[id]', params: { id: saved.id } });
            } catch (caught) {
              if (revision !== getApiSession().revision || caught instanceof SessionChangedError) return;
              if (caught instanceof PartialTransactionWriteError) {
                Alert.alert('Transação salva parcialmente', caught.message);
                router.replace({ pathname: '/transacao/[id]', params: { id: caught.transactionId } });
              } else { setSubmitError(errorMessage(caught)); }
            } finally { sending.current = false; setBusy(false); }
          }}
        /></>}

         </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    paddingHorizontal:
      spacing.md,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerSpacer: {
    width: 44,
  },

  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.title,
    color: colors.textPrimary,
  },
});
