import type { CreateTransactionInput, Transaction } from '@/types/transaction';
import { formatTransactionDate } from '@/utils/date';
import { apiRequest, ApiError, getApiSession, profilePath, SessionChangedError } from '@/services/api-client';
import { getTransactionCatalog } from '@/services/category.service';
import { centsToDecimal, decimalToCents } from '@/utils/currency';
import { validateReceiptFile } from '@/utils/receipt-file';
import { filterDateBoundary, localDate, localDateTimeToISO, timestampToLocal } from '@/utils/date';
import type { Essentiality, PaymentMethod, RecurrenceConfiguration } from '@/types/transaction';

export const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro', debit_card: 'Cartão de débito', credit_card: 'Cartão de crédito',
  pix: 'Pix', bank_transfer: 'Transferência', other: 'Outro',
};
export const paymentEnums: Record<PaymentMethod, string> = {
  cash: 'DINHEIRO', debit_card: 'CARTAO_DEBITO', credit_card: 'CARTAO_CREDITO',
  pix: 'PIX', bank_transfer: 'TRANSFERENCIA', other: 'OUTRO',
};
export const essentialityEnums: Record<Essentiality, string> = {
  essential: 'ESSENCIAL', non_essential: 'NAO_ESSENCIAL', unclassified: 'NAO_CLASSIFICADA',
};
export interface ApiTransaction {
  id: string; perfilId: string; tipo: 'RECEITA' | 'DESPESA'; valor: string; dataHora: string;
  descricao: string; anotacao: string | null; categoriaId: string | null; subcategoriaId: string | null;
  metodoPagamento: string | null; essencialidade: string; ehGastoLivre: boolean;
  status: 'EFETIVADA' | 'PREVISTA'; recorrenciaId: string | null;
  tags?: { id: string; nome: string }[];
  recibos?: { id: string; arquivoUrl: string; mimeType: string | null }[];
}
export type RemoteTransaction = TransactionRead & {
  timestamp: string; receipts: NonNullable<ApiTransaction['recibos']>;
};
export function mapTransaction(item: ApiTransaction, catalog: Awaited<ReturnType<typeof getTransactionCatalog>>): RemoteTransaction {
  return {
    id: item.id, profileId: item.perfilId, type: item.tipo === 'RECEITA' ? 'income' : 'expense',
    amountCents: decimalToCents(item.valor), ...timestampToLocal(item.dataHora), timestamp: item.dataHora,
    description: item.descricao, notes: item.anotacao, categoryId: item.categoriaId, subcategoryId: item.subcategoriaId,
    categoryName: catalog.categories.find(c => c.id === item.categoriaId)?.name ?? 'Sem categoria',
    subcategoryName: catalog.subcategories.find(c => c.id === item.subcategoriaId)?.name ?? null,
    paymentMethod: (Object.keys(paymentEnums) as PaymentMethod[]).find(k => paymentEnums[k] === item.metodoPagamento) ?? null,
    essentiality: (Object.keys(essentialityEnums) as Essentiality[]).find(k => essentialityEnums[k] === item.essencialidade) ?? 'unclassified',
    freeSpending: item.ehGastoLivre, status: item.status === 'EFETIVADA' ? 'effective' : 'scheduled',
    recurrenceId: item.recorrenciaId, tags: (item.tags ?? []).map(t => t.nome),
    receiptUri: item.recibos?.[0]?.arquivoUrl ?? null, receipts: item.recibos ?? [],
  };
}

export interface TransactionFilters { startDate?: string; endDate?: string; categoryId?: string; amountCents?: number; paymentMethod?: PaymentMethod }
export function transactionQuery(query: string, filters: TransactionFilters = {}) {
  const parameters = new URLSearchParams();
  if (query.trim()) parameters.set('descricao', query.trim());
  if (filters.startDate) parameters.set('dataInicial', filterDateBoundary(filters.startDate));
  if (filters.endDate) parameters.set('dataFinal', filterDateBoundary(filters.endDate, true));
  if (filters.categoryId) parameters.set('categoriaId', filters.categoryId);
  if (filters.amountCents !== undefined) parameters.set('valor', centsToDecimal(filters.amountCents));
  if (filters.paymentMethod) parameters.set('metodoPagamento', paymentEnums[filters.paymentMethod]);
  return parameters.toString();
}
export async function getTransactions(query = '', filters: TransactionFilters = {}): Promise<RemoteTransaction[]> {
  const profile = getApiSession().profileId;
  const [items, catalog] = await Promise.all([
    apiRequest<ApiTransaction[]>(`${profilePath('transactions', profile)}?${transactionQuery(query, filters)}`),
    getTransactionCatalog(profile ?? undefined),
  ]);
  return items.map(item => mapTransaction(item, catalog));
}
export async function getTransactionById(id: string): Promise<RemoteTransaction> {
  const profile = getApiSession().profileId;
  const [item, catalog] = await Promise.all([
    apiRequest<ApiTransaction>(profilePath(`transactions/${encodeURIComponent(id)}`, profile)),
    getTransactionCatalog(profile ?? undefined),
  ]);
  return mapTransaction(item, catalog);
}
export function groupTransactions(items: TransactionRead[], referenceDate = localDate()) {
  const groups = new Map<string, { date: string; title: string; data: TransactionRead[] }>();
  for (const item of items) {
    let group = groups.get(item.date);
    if (!group) { group = { date: item.date, title: getTransactionDateLabel(item.date, referenceDate), data: [] }; groups.set(item.date, group); }
    group.data.push(item);
  }
  return [...groups.values()];
}
export function transactionPayload(input: CreateTransactionInput) {
  return { tipo: input.type === 'income' ? 'RECEITA' : 'DESPESA', valor: centsToDecimal(input.amountCents),
    dataHora: localDateTimeToISO(input.date, input.time), descricao: input.description.trim(),
    anotacao: input.notes ?? null, categoriaId: input.categoryId, subcategoriaId: input.subcategoryId ?? null,
    metodoPagamento: input.paymentMethod ? paymentEnums[input.paymentMethod] : null,
    essencialidade: essentialityEnums[input.essentiality ?? 'unclassified'], ehGastoLivre: input.freeSpending ?? false };
}

export class PartialTransactionWriteError extends ApiError {
  constructor(public readonly transactionId: string, operation: string) {
    super(0, `Transação salva. Não foi possível concluir ${operation}. Confira o detalhe antes de tentar novamente.`);
  }
}
async function resolveTags(names: string[], path: string) {
  const revision = getApiSession().revision;
  const clean = [...new Set(names.map(n => n.trim().replace(/^#/, '')).filter(Boolean))];
  let tags = await apiRequest<{ id: string; nome: string }[]>(path);
  const ids: string[] = [];
  for (const nome of clean) {
    if (revision !== getApiSession().revision) throw new SessionChangedError();
    let tag = tags.find(t => t.nome === nome);
    if (!tag) {
      try { tag = await apiRequest<{ id: string; nome: string }>(path, { method: 'POST', body: { nome } }); }
      catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error;
        tags = await apiRequest<{ id: string; nome: string }[]>(path); tag = tags.find(t => t.nome === nome);
        if (!tag) throw error;
      }
    }
    ids.push(tag.id);
  }
  return ids;
}
export async function createTransaction(input: CreateTransactionInput, configuration?: RecurrenceConfiguration, reflectionItemId?: string): Promise<RemoteTransaction> {
  const revision = getApiSession().revision;
  if (reflectionItemId && input.type !== 'expense') throw new ApiError(400, 'A compra após reflexão deve ser uma despesa.');
  if (input.type === 'expense' && input.receiptFile) validateReceiptFile(input.receiptFile);
  if (configuration?.recurring) {
    if (!configuration.nextOccurrence) throw new ApiError(400, 'Informe a próxima ocorrência.');
    localDateTimeToISO(configuration.nextOccurrence, input.time);
  }
  if (configuration?.reminder) {
    if (!configuration.dueDate || !configuration.reminderTime) throw new ApiError(400, 'Informe data e horário do lembrete.');
    localDateTimeToISO(configuration.dueDate, configuration.reminderTime);
  }
  const profile = getApiSession().profileId;
  const path = profilePath('transactions', profile);
  // Resolver tags antes do POST evita criar a transação quando o catálogo falha.
  const tagIds = input.tags?.length ? await resolveTags(input.tags, profilePath('tags', profile)) : [];
  if (revision !== getApiSession().revision) throw new SessionChangedError();
  const now = Date.now();
  const payload = transactionPayload(input);
  const createPath = reflectionItemId ? profilePath(`reflection-items/${encodeURIComponent(reflectionItemId)}/transactions`, profile) : path;
  const created = await apiRequest<ApiTransaction>(createPath, { method: 'POST', body: {
    ...payload, status: reflectionItemId ? 'EFETIVADA' : Date.parse(payload.dataHora) > now ? 'PREVISTA' : 'EFETIVADA',
  } });
  let operation = 'a consulta do detalhe';
  try {
    if (tagIds.length) { operation = 'a associação de tags'; await apiRequest(`${path}/${created.id}/tags`, { method: 'PUT', body: { tagIds } }); }
    if (configuration && (configuration.recurring || configuration.reminder)) {
      operation = 'a configuração de recorrência/lembrete';
      const { configureRemoteRecurrence } = await import('@/services/recurrence.service');
      await configureRemoteRecurrence(created.id, input, configuration, profile!);
    }
    if (input.type === 'expense' && input.receiptFile) {
      operation = 'o envio do comprovante';
      const { uploadReceipt } = await import('@/services/receipt.service');
      await uploadReceipt(created.id, input.receiptFile);
    }
    if (revision !== getApiSession().revision) throw new SessionChangedError();
    return await getTransactionById(created.id);
  } catch (error) {
    if (error instanceof SessionChangedError) throw error;
    throw new PartialTransactionWriteError(created.id, operation);
  }
}
export async function updateTransaction(id: string, input: CreateTransactionInput, original: RemoteTransaction): Promise<RemoteTransaction> {
  const revision = getApiSession().revision;
  const profile = getApiSession().profileId;
  if (original.profileId !== profile || original.id !== id) throw new SessionChangedError();
  const path = profilePath(`transactions/${encodeURIComponent(id)}`, profile);
  const before = transactionPayload(original);
  const after = transactionPayload(input);
  // Preserve segundos/offset originais quando a data e hora visíveis não mudarem.
  if (input.date === original.date && input.time === original.time) after.dataHora = before.dataHora = original.timestamp;
  const changes = Object.fromEntries(Object.entries(after).filter(([key, value]) => value !== before[key as keyof typeof before]));
  if (Object.keys(changes).length && !after.categoriaId && !after.ehGastoLivre && !original.recurrenceId) {
    throw new ApiError(400, 'Selecione uma categoria para editar os dados deste registro. Para alterar apenas tags, mantenha os demais campos.');
  }
  const tagsChanged = JSON.stringify([...(input.tags ?? [])].sort()) !== JSON.stringify([...original.tags].sort());
  const tagIds = tagsChanged ? await resolveTags(input.tags ?? [], profilePath('tags', profile)) : [];
  if (revision !== getApiSession().revision) throw new SessionChangedError();
  let saved = false;
  try {
    if (Object.keys(changes).length) { await apiRequest(path, { method: 'PATCH', body: changes }); saved = true; }
    if (revision !== getApiSession().revision) throw new SessionChangedError();
    if (tagsChanged) { await apiRequest(`${path}/tags`, { method: 'PUT', body: { tagIds } }); saved = true; }
    return await getTransactionById(id);
  } catch (error) {
    if (error instanceof SessionChangedError || !saved) throw error;
    throw new PartialTransactionWriteError(id, 'a atualização de tags ou a consulta do detalhe');
  }
}
export async function reverseTransaction(id: string) {
  await apiRequest(profilePath(`transactions/${encodeURIComponent(id)}`), { method: 'DELETE' });
}

export type TransactionRead = Transaction & {
  categoryName: string;
  subcategoryName: string | null;
};

export function getTransactionDateLabel(date: string, referenceDate: string): string {
  if (date === referenceDate) return 'Hoje';
  const [year, month, day] = referenceDate.split('-').map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  return date === yesterday ? 'Ontem' : formatTransactionDate(date);
}

export function requiresPurchaseReflection(
  input: Pick<CreateTransactionInput, 'type' | 'essentiality'>,
): boolean {
  return input.type === 'expense' && input.essentiality === 'non_essential';
}
