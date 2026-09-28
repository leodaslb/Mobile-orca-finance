import {
  IconBell,
  IconCamera,
  IconCar,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconDots,
  IconHome,
  IconRefresh,
  IconShoppingCart,
  IconTicket,
  IconWallet,
} from '@tabler/icons-react-native';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppSwitch } from '@/components/common/AppSwitch';
import { PurchaseReflectionModal } from '@/components/domain/PurchaseReflectionModal';
import {
  RecurrenceConfigurationModal,
  type RecurrenceConfiguration,
} from '@/components/domain/RecurrenceConfigurationModal';
import {
  getTransactionCategories,
  getTransactionSubcategories,
  requiresPurchaseReflection,
} from '@/services/transaction.service';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  spacing,
} from '@/theme';
import type {
  CreateTransactionInput,
  Essentiality,
  PaymentMethod,
  TransactionType,
} from '@/types/transaction';
import { parseCurrencyToCents } from '@/utils/currency';
import {
  formatDateInput,
  formatTransactionDate,
  isValidTime,
  parseBrazilianDateToISO,
} from '@/utils/date';

interface TransactionFormProps {
  onSubmit?: (transaction: CreateTransactionInput, recurrence: RecurrenceConfiguration) => void;
  onPlaceInReflection?: (transaction: CreateTransactionInput, durationHours: number, recurrence: RecurrenceConfiguration) => void;
  onAddReceipt?: () => void;
}

const initialRecurrenceConfiguration: RecurrenceConfiguration = {
  recurring: false,
  frequency: 'monthly',
  nextOccurrence: null,
  reminder: false,
  dueDate: null,
};

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'bank_transfer', label: 'Transferência' },
  { value: 'other', label: 'Outro' },
];

function formatMoneyInput(value: string): string {
  const normalized = value
    .replace(/[^\d,.]/g, '')
    .replace('.', ',');

  const [reais = '', cents] = normalized.split(',');

  if (cents === undefined) {
    return reais;
  }

  return `${reais},${cents.slice(0, 2)}`;
}

function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function TransactionForm({
  onSubmit,
  onPlaceInReflection,
  onAddReceipt,
}: TransactionFormProps) {
  const categories = getTransactionCategories();

  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [description, setDescription] = useState('');

  const [categoryId, setCategoryId] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);

  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const [tagsInput, setTagsInput] = useState('');
  const [essentiality, setEssentiality] =
    useState<Essentiality | null>(null);
  const [freeSpending, setFreeSpending] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(true);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [recurrenceConfiguration, setRecurrenceConfiguration] =
    useState<RecurrenceConfiguration>(initialRecurrenceConfiguration);
  const [recurrenceConfigurationBeforeEdit, setRecurrenceConfigurationBeforeEdit] =
    useState<RecurrenceConfiguration | null>(null);
  const [reflectionInput, setReflectionInput] =
    useState<CreateTransactionInput | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const amountCents = parseCurrencyToCents(amountInput);
  const date = parseBrazilianDateToISO(dateInput);

  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );

  const subcategories = categoryId
    ? getTransactionSubcategories(categoryId)
    : [];

  const selectedSubcategory = subcategories.find(
    (subcategory) => subcategory.id === subcategoryId,
  );

  const selectedPayment = paymentMethods.find(
    (method) => method.value === paymentMethod,
  );

  const valid =
    amountCents !== null &&
    amountCents > 0 &&
    date !== null &&
    isValidTime(timeInput) &&
    description.trim().length > 0 &&
    (categoryId.length > 0 || (type === 'expense' && freeSpending));

  function handleTypeChange(nextType: TransactionType) {
    setType(nextType);

    if (nextType === 'income') {
      setEssentiality(null);
      setFreeSpending(false);
    }
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setSubcategoryId(null);
    setCategoryOpen(false);
    setSubcategoryOpen(false);
  }

  function renderCategoryIcon() {
    const iconProps = {
      size: 22,
      strokeWidth: 2,
    };

    switch (categoryId) {
      case 'category-food':
        return (
          <IconShoppingCart
            {...iconProps}
            color={colors.categories.food.icon}
          />
        );

      case 'category-transport':
        return (
          <IconCar
            {...iconProps}
            color={colors.categories.transport.icon}
          />
        );

      case 'category-housing':
        return (
          <IconHome
            {...iconProps}
            color={colors.categories.housing.icon}
          />
        );

      case 'category-leisure':
        return (
          <IconTicket
            {...iconProps}
            color={colors.categories.leisure.icon}
          />
        );

      case 'category-income':
        return (
          <IconWallet
            {...iconProps}
            color={colors.positive}
          />
        );

      default:
        return (
          <IconDots
            {...iconProps}
            color={colors.textSecondary}
          />
        );
    }
  }

  function handleSubmit() {
    setShowErrors(true);

    if (!valid || amountCents === null || date === null) {
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean);

    const input: CreateTransactionInput = {
      type,
      amountCents,
      date,
      time: timeInput,
      description: description.trim(),
      categoryId: categoryId || null,
      subcategoryId,
      paymentMethod,
      tags,
      notes: null,
      essentiality: type === 'expense' ? essentiality : null,
      receiptUri: null,
      freeSpending: type === 'expense' && freeSpending,
    };

    if (requiresPurchaseReflection(input)) {
      setReflectionInput(input);
      return;
    }

    onSubmit?.(input, recurrenceConfiguration);
  }

  function handleFinalizeReflection() {
    if (!reflectionInput) return;
    const input = reflectionInput;
    setReflectionInput(null);
    onSubmit?.(input, recurrenceConfiguration);
  }

  function handleRecurringChange(value: boolean) {
    if (value) {
      openRecurrenceConfiguration({ recurring: true });
      return;
    }

    setRecurrenceConfiguration((current) => ({
      ...current,
      recurring: false,
      nextOccurrence: null,
    }));
  }

  function handleReminderChange(value: boolean) {
    if (value) {
      openRecurrenceConfiguration({ reminder: true });
      return;
    }

    setRecurrenceConfiguration((current) => ({
      ...current,
      reminder: false,
      dueDate: null,
    }));
  }

  function openRecurrenceConfiguration(
    changes: Partial<RecurrenceConfiguration> = {},
  ) {
    setRecurrenceConfigurationBeforeEdit(recurrenceConfiguration);
    setRecurrenceConfiguration({ ...recurrenceConfiguration, ...changes });
    setRecurrenceOpen(true);
  }

  function cancelRecurrenceConfiguration() {
    if (recurrenceConfigurationBeforeEdit) {
      setRecurrenceConfiguration(recurrenceConfigurationBeforeEdit);
    }

    setRecurrenceConfigurationBeforeEdit(null);
    setRecurrenceOpen(false);
  }

  const amountColor =
    type === 'expense'
      ? colors.negative
      : colors.positive;

  return (
    <>
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* RECEITA / DESPESA */}
      <View style={styles.typeSelector}>
        <Pressable
          onPress={() => handleTypeChange('income')}
          accessibilityRole="radio"
          accessibilityState={{ selected: type === 'income' }}
          style={[
            styles.typeOption,
            type === 'income' && styles.incomeActive,
          ]}
        >
          <Text
            style={[
              styles.typeText,
              type === 'income' && styles.typeTextActive,
            ]}
          >
            Receita
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleTypeChange('expense')}
          accessibilityRole="radio"
          accessibilityState={{ selected: type === 'expense' }}
          style={[
            styles.typeOption,
            type === 'expense' && styles.expenseActive,
          ]}
        >
          <Text
            style={[
              styles.typeText,
              type === 'expense' && styles.typeTextActive,
            ]}
          >
            Despesa
          </Text>
        </Pressable>
      </View>

      {/* VALOR */}
      <View style={styles.amountSection}>
        <Text style={styles.amountLabel}>valor</Text>

        <TextInput
          value={amountInput ? `R$ ${amountInput}` : ''}
          onChangeText={(value) =>
            setAmountInput(formatMoneyInput(value))
          }
          placeholder="R$ 0,00"
          placeholderTextColor={amountColor}
          keyboardType="decimal-pad"
          style={[
            styles.amountInput,
            { color: amountColor },
          ]}
        />

        {showErrors &&
          (amountCents === null || amountCents <= 0) && (
            <Text style={styles.error}>
              Informe um valor válido.
            </Text>
          )}
      </View>

      {/* DATA / HORA */}
      <View style={styles.row}>
        <View style={styles.inputCardHalf}>
          <Text style={styles.inputLabel}>data</Text>

          <TextInput
            value={dateInput}
            onChangeText={(value) =>
              setDateInput(formatDateInput(value))
            }
            placeholder="dd/mm/aaaa"
            placeholderTextColor={colors.navInactive}
            keyboardType="numeric"
            maxLength={10}
            style={styles.cardInput}
          />

          {showErrors && date === null && (
            <Text style={styles.error}>
              Data inválida.
            </Text>
          )}
        </View>

        <View style={styles.inputCardHalf}>
          <Text style={styles.inputLabel}>hora</Text>

          <TextInput
            value={timeInput}
            onChangeText={(value) =>
              setTimeInput(formatTimeInput(value))
            }
            placeholder="hh:mm"
            placeholderTextColor={colors.navInactive}
            keyboardType="numeric"
            maxLength={5}
            style={styles.cardInput}
          />

          {showErrors && !isValidTime(timeInput) && (
            <Text style={styles.error}>
              Hora inválida.
            </Text>
          )}
        </View>
      </View>

      {/* DESCRIÇÃO */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>
          descrição
        </Text>

        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Ex: Supermercado Extra"
          placeholderTextColor={colors.navInactive}
          style={styles.cardInput}
        />

        {showErrors && !description.trim() && (
          <Text style={styles.error}>
            Informe uma descrição.
          </Text>
        )}
      </View>

      {/* CATEGORIA */}
      <View style={styles.dropdownBlock}>
        <Pressable
          onPress={() =>
            setCategoryOpen(!categoryOpen)
          }
          style={styles.dropdownField}
        >
          <View style={styles.categoryIcon}>
            {renderCategoryIcon()}
          </View>

          <Text
            style={[
              styles.categoryValue,
              !selectedCategory &&
                styles.placeholder,
            ]}
          >
            {selectedCategory?.name ??
              (type === 'expense' && freeSpending ? 'Categoria opcional para gasto livre' : 'Selecione a categoria')}
          </Text>

          <IconChevronDown
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>

        {categoryOpen && (
          <View style={styles.dropdownOptions}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() =>
                  handleCategoryChange(
                    category.id,
                  )
                }
                style={styles.dropdownOption}
              >
                <Text
                  style={
                    styles.dropdownOptionText
                  }
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {showErrors && !categoryId && !(type === 'expense' && freeSpending) && (
          <Text style={styles.error}>
            Selecione uma categoria.
          </Text>
        )}
      </View>

      {/* SUBCATEGORIA — exibida somente quando existir */}
      {subcategories.length > 0 && (
        <View style={styles.dropdownBlock}>
          <Pressable
            onPress={() =>
              setSubcategoryOpen(
                !subcategoryOpen,
              )
            }
            style={styles.dropdownField}
          >
            <View style={styles.dropdownTextArea}>
              <Text style={styles.inputLabel}>
                Subcategoria
              </Text>

              <Text
                style={[
                  styles.dropdownValue,
                  !selectedSubcategory &&
                    styles.placeholder,
                ]}
              >
                {selectedSubcategory?.name ??
                  'Selecione a subcategoria'}
              </Text>
            </View>

            <IconChevronDown
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {subcategoryOpen && (
            <View style={styles.dropdownOptions}>
              {subcategories.map(
                (subcategory) => (
                  <Pressable
                    key={subcategory.id}
                    onPress={() => {
                      setSubcategoryId(
                        subcategory.id,
                      );
                      setSubcategoryOpen(
                        false,
                      );
                    }}
                    style={
                      styles.dropdownOption
                    }
                  >
                    <Text
                      style={
                        styles.dropdownOptionText
                      }
                    >
                      {subcategory.name}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          )}
        </View>
      )}

      {/* MAIS DETALHES */}
      <View style={styles.detailsCard}>
        <Pressable
          onPress={() =>
            setDetailsOpen(!detailsOpen)
          }
          style={styles.detailsHeader}
        >
          <Text style={styles.detailsTitle}>
            Mais detalhes
          </Text>

          {detailsOpen ? (
            <IconChevronUp
              size={22}
              color={colors.textSecondary}
            />
          ) : (
            <IconChevronDown
              size={22}
              color={colors.textSecondary}
            />
          )}
        </Pressable>

        {detailsOpen && (
          <View style={styles.detailsBody}>
            {/* PAGAMENTO */}
            <View style={styles.dropdownBlock}>
              <Pressable
                onPress={() =>
                  setPaymentOpen(!paymentOpen)
                }
                style={styles.dropdownField}
              >
                <View
                  style={
                    styles.dropdownTextArea
                  }
                >
                  <Text
                    style={styles.inputLabel}
                  >
                    Método de pagamento
                  </Text>

                  <Text
                    style={[
                      styles.dropdownValue,
                      !selectedPayment &&
                        styles.placeholder,
                    ]}
                  >
                    {selectedPayment?.label ??
                      'Selecione o método'}
                  </Text>
                </View>

                <IconChevronDown
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>

              {paymentOpen && (
                <View
                  style={
                    styles.dropdownOptions
                  }
                >
                  {paymentMethods.map(
                    (method) => (
                      <Pressable
                        key={method.value}
                        onPress={() => {
                          setPaymentMethod(
                            method.value,
                          );
                          setPaymentOpen(
                            false,
                          );
                        }}
                        style={
                          styles.dropdownOption
                        }
                      >
                        <Text
                          style={
                            styles.dropdownOptionText
                          }
                        >
                          {method.label}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              )}
            </View>

            {/* TAGS */}
            <View style={styles.detailInput}>
              <View style={styles.flex}>
                <Text style={styles.inputLabel}>
                  Tags
                </Text>

                <TextInput
                  value={tagsInput}
                  onChangeText={setTagsInput}
                  placeholder="#viagem, #urgente"
                  placeholderTextColor={
                    colors.textSecondary
                  }
                  style={
                    styles.detailTextInput
                  }
                />
              </View>
            </View>

            {/* RECIBO */}
            <Pressable
              accessibilityState={{ disabled: !onAddReceipt }}
              disabled={!onAddReceipt}
              onPress={onAddReceipt}
              style={[
                styles.actionRow,
                !onAddReceipt && styles.actionDisabled,
              ]}
            >
              <IconCamera
                size={24}
                color={colors.textSecondary}
              />

              <Text
                style={[
                  styles.actionTitle,
                  styles.actionInfo,
                ]}
              >
                Adicionar recibo
              </Text>

              <IconChevronRight
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {type === 'expense' && <View style={styles.actionRow}>
              <IconWallet size={24} color={colors.primary} />
              <Text style={[styles.actionTitle, styles.actionInfo]}>Contabilizar como gasto livre</Text>
              <AppSwitch accessibilityLabel="Contabilizar como gasto livre" value={freeSpending} onChange={setFreeSpending} />
            </View>}

            {/* RECORRÊNCIA */}
            <View style={styles.actionRow}>
              <IconRefresh
                size={26}
                color={colors.textPrimary}
              />

              <Pressable
                style={styles.actionInfo}
                onPress={() => openRecurrenceConfiguration()}
              >
                <Text style={styles.actionTitle}>
                  Transação recorrente
                </Text>

                {recurrenceConfiguration.recurring && (
                  <Text
                    style={
                      styles.actionSubtitle
                    }
                  >
                    Mensal
                    {recurrenceConfiguration.nextOccurrence
                      ? ` • ${formatTransactionDate(
                          recurrenceConfiguration.nextOccurrence,
                        )}`
                      : ''}
                  </Text>
                )}
              </Pressable>

              <View
                style={
                  styles.recurrenceControls
                }
              >
                <AppSwitch
                  accessibilityLabel="Ativar transação recorrente"
                  value={recurrenceConfiguration.recurring}
                  onChange={handleRecurringChange}
                />

                {recurrenceConfiguration.recurring && (
                  <Pressable
                    onPress={() => openRecurrenceConfiguration()}
                    style={
                      styles.recurrenceChevron
                    }
                  >
                    <IconChevronRight
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
            </View>

            {/* LEMBRETE */}
            <View style={styles.actionRow}>
              <IconBell
                size={24}
                color={colors.textSecondary}
              />

              <Pressable
                onPress={() => openRecurrenceConfiguration()}
                style={styles.actionInfo}
              >
                <Text style={styles.actionTitle}>Lembrete de vencimento</Text>
                {recurrenceConfiguration.reminder &&
                  recurrenceConfiguration.dueDate && (
                    <Text style={styles.actionSubtitle}>
                      {formatTransactionDate(recurrenceConfiguration.dueDate)}
                    </Text>
                  )}
              </Pressable>

              <AppSwitch
                accessibilityLabel="Ativar lembrete de vencimento"
                value={recurrenceConfiguration.reminder}
                onChange={handleReminderChange}
              />
            </View>

            {/* ESSENCIAL */}
            {type === 'expense' && (
              <View
                style={styles.essentialRow}
              >
                <Text
                  style={
                    styles.essentialTitle
                  }
                >
                  Esta compra é essencial?
                </Text>

                <View
                  style={
                    styles.essentialSelector
                  }
                >
                  <Pressable
                    onPress={() =>
                      setEssentiality(
                        'essential',
                      )
                    }
                    accessibilityRole="radio"
                    accessibilityLabel="Compra essencial"
                    accessibilityState={{ selected: essentiality === 'essential' }}
                    style={[
                      styles.essentialOption,
                      essentiality ===
                        'essential' &&
                        styles.essentialYes,
                    ]}
                  >
                    <Text
                      style={[
                        styles.essentialText,
                        essentiality ===
                          'essential' &&
                          styles.essentialTextActive,
                      ]}
                    >
                      Sim
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setEssentiality(
                        'non_essential',
                      )
                    }
                    accessibilityRole="radio"
                    accessibilityLabel="Compra não essencial"
                    accessibilityState={{ selected: essentiality === 'non_essential' }}
                    style={[
                      styles.essentialOption,
                      essentiality ===
                        'non_essential' &&
                        styles.essentialNo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.essentialText,
                        essentiality ===
                          'non_essential' &&
                          styles.essentialTextActive,
                      ]}
                    >
                      Não
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <Pressable
        onPress={handleSubmit}
        accessibilityRole="button"
        style={styles.saveButton}
      >
        <Text
          style={styles.saveButtonText}
        >
          Salvar transação
        </Text>
      </Pressable>
    </ScrollView>
    <RecurrenceConfigurationModal
      onCancel={cancelRecurrenceConfiguration}
      onSave={(configuration) => {
        setRecurrenceConfiguration(configuration);
        setRecurrenceConfigurationBeforeEdit(null);
        setRecurrenceOpen(false);
      }}
      value={recurrenceConfiguration}
      visible={recurrenceOpen}
    />
    <PurchaseReflectionModal
      categoryName={selectedCategory?.name ?? 'Sem categoria'}
      onFinalize={handleFinalizeReflection}
      onPlaceInReflection={onPlaceInReflection && reflectionInput
        ? (durationHours) => {
            onPlaceInReflection(reflectionInput, durationHours, recurrenceConfiguration);
            setReflectionInput(null);
          }
        : undefined}
      onReview={() => setReflectionInput(null)}
      transaction={reflectionInput}
      visible={reflectionInput !== null}
    />
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.lg,
  },

  typeSelector: {
    flexDirection: 'row',
    minHeight: 48,
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },

  typeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },

  incomeActive: {
    backgroundColor: colors.positive,
  },

  expenseActive: {
    backgroundColor: colors.negative,
  },

  typeText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },

  typeTextActive: {
    color: colors.surface,
  },

  amountSection: {
    alignItems: 'center',
  },

  amountLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },

  amountInput: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    fontFamily: fontFamily.bold,
    fontSize: 34,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  inputCardHalf: {
    flex: 1,
    minHeight: 74,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },

  inputCard: {
    minHeight: 74,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },

  inputLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },

  cardInput: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 0,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },

  dropdownBlock: {
    width: '100%',
  },

  dropdownField: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },

  dropdownTextArea: {
    flex: 1,
    justifyContent: 'center',
  },

  categoryIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.icon,
    backgroundColor: colors.primaryTint,
  },

  categoryValue: {
    flex: 1,
    marginLeft: spacing.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },

  dropdownValue: {
    marginTop: 3,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },

  placeholder: {
    color: colors.textSecondary,
  },

  dropdownOptions: {
    marginTop: spacing.xs,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },

  dropdownOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },

  dropdownOptionText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },

  detailsCard: {
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },

  detailsHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },

  detailsTitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.title,
    color: colors.textSecondary,
  },

  detailsBody: {
    padding: spacing.md,
    gap: spacing.md,
  },

  detailInput: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },

  detailTextInput: {
    minHeight: 34,
    paddingVertical: 0,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },

  actionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },

  actionDisabled: {
    opacity: 0.5,
  },

  actionInfo: {
    flex: 1,
  },

  actionTitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },

  actionSubtitle: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },

  recurrenceControls: {
    width: 46,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },

  recurrenceChevron: {
    width: 46,
    height: 18,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  essentialRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },

  essentialTitle: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },

  essentialSelector: {
    flexDirection: 'row',
    minWidth: 142,
    padding: 2,
    borderRadius: radius.input,
    backgroundColor: colors.primaryTint,
  },

  essentialOption: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
  },

  essentialYes: {
    backgroundColor: colors.positive,
  },

  essentialNo: {
    backgroundColor: colors.negative,
  },

  essentialText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textSecondary,
  },

  essentialTextActive: {
    color: colors.surface,
  },

  saveButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
    backgroundColor: colors.primary,
  },

  saveButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.surface,
  },

  error: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.negative,
  },
});
