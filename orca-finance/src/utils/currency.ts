const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(cents: number): string {
  return brlFormatter.format(cents / 100);
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

  const reais = Number(reaisPart);

  const cents = Number(
    centsPart.padEnd(2, '0'),
  );

  if (
    !Number.isSafeInteger(reais) ||
    !Number.isSafeInteger(cents)
  ) {
    return null;
  }

  const totalCents =
    reais * 100 + cents;

  if (!Number.isSafeInteger(totalCents)) {
    return null;
  }

  return totalCents;
}