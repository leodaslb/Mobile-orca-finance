import { Stack, useRouter } from 'expo-router';

import { Pressable, StyleSheet, Text, View, } from 'react-native';

import { SafeAreaView, } from 'react-native-safe-area-context';

import { IconArrowLeft, } from '@tabler/icons-react-native';

import { TransactionForm, } from '@/components/domain/TransactionForm';

import { createTransactionWithRecurrence } from '@/services/recurrence.service';
import { placeInReflection } from '@/services/reflection.service';
import { colors, fontFamily, fontSize, spacing, } from '@/theme';

export default function NovaTransacaoScreen() {
  const router = useRouter();

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
            Nova transação
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>


        <TransactionForm
          onPlaceInReflection={(input, durationHours, recurrence) => {
            placeInReflection(input, durationHours, new Date(), recurrence);
            router.replace('/reflexao');
          }}
          onSubmit={(input, recurrence) => {
            const created =
              createTransactionWithRecurrence(input, recurrence);

            router.replace({
              pathname: '/transacao/[id]',
              params: {
                id: created.id,
              },
            });
          }}
        />
        
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
