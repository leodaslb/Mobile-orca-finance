import {
    IconChartBar,
    IconHome,
    IconPlus,
    IconReceipt,
    IconTargetArrow,
} from '@tabler/icons-react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    colors,
    fontFamily,
    fontSize,
    radius,
    spacing,
} from '@/theme';

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: insets.bottom }],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => (
            <IconHome
              size={20}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="transacoes"
        options={{
          title: 'Transações',
          tabBarIcon: ({ color }) => (
            <IconReceipt
              size={20}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="nova"
        options={{
          title: '',
          tabBarButton: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nova transação"
              onPress={() => router.push('/transacao/nova')}
              style={styles.addButtonContainer}
            >
              <View style={styles.addButton}>
                <IconPlus
                  size={24}
                  color={colors.surface}
                  strokeWidth={2.5}
                />
              </View>

              <Text style={styles.addButtonLabel}>
                Adicionar
              </Text>
            </Pressable>
          ),
        }}
      />

      <Tabs.Screen
        name="planejamento"
        options={{
          title: 'Planejamento',
          tabBarIcon: ({ color }) => (
            <IconTargetArrow
              size={20}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="relatorios"
        options={{
          title: 'Relatórios',
          tabBarIcon: ({ color }) => (
            <IconChartBar
              size={20}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    paddingTop: spacing.xs,
  },

  tabBarLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.caption,
  },

  addButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },

  addButtonLabel: {
    marginTop: 2,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.caption,
    color: colors.primary,
  },
});
