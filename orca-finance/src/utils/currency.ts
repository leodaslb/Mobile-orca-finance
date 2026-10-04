const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(cents: number): string {
  const [whole, fraction] = centsToDecimal(cents).split('.');
  // Formatar somente a parte inteira evita perder centavos perto de MAX_SAFE_INTEGER.
  return brlFormatter.formatToParts(Number(whole))
    .map(part => part.type === 'fraction' ? fraction : part.value).join('');
}

/**
 * Converte um valor digitado em reais para centavos inteiros.
 *
 * Exemplos:
 * "187"        -> 18700
 * "187,5"      -> 18750
 * "187,50"     -> 18750
 * "1.234,56"   -> 123456
 * "R$ 187,50"  -> 18750
 *
 * Retorna null quando o valor não é válido.
 */
export function parseCurrencyToCents(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/^R\$\s?/, '')
    .replace(/\s/g, '');

  if (!normalized) {
    return null;
  }

  const validBRLPattern =
    /^(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/;

  if (!validBRLPattern.test(normalized)) {
    return null;
  }

  const withoutThousands = normalized.replace(/\./g, '');

  const [reaisPart, centsPart = ''] =
    withoutThousands.split(',');

  const totalCents = BigInt(reaisPart) * 100n + BigInt(centsPart.padEnd(2, '0'));
  return totalCents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(totalCents) : null;
}
// Decimal REST é uma string de reais, enquanto a UI usa centavos inteiros.
export function decimalToCents(value: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Valor monetário inválido na API.');
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));
  const signed = match[1] ? -cents : cents;
  const result = Number(signed);
  if (!Number.isSafeInteger(result)) throw new Error('Valor fora da precisão suportada pela UI.');
  return result;
}

export function centsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Valor monetário inválido.');
  const integer = BigInt(cents);
  const absolute = integer < 0n ? -integer : integer;
  return `${integer < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
