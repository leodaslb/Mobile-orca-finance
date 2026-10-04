import writeExcelFile from 'write-excel-file/node';

export const exportHeaders = ['Data e hora (UTC)', 'Tipo', 'Descrição', 'Valor', 'Categoria', 'Subcategoria',
  'Método de pagamento', 'Essencialidade', 'Status', 'Gasto livre', 'Anotação', 'Tags'];

// Neutraliza células que uma planilha poderia interpretar como fórmula.
// Valores financeiros continuam texto decimal, preservando a precisão em Excel.
export function csvCell(value: string) {
  const formula = ['=', '+', '-', '@'].includes(value.trimStart()[0]);
  const safe = formula || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvFile(rows: string[][]) {
  return Buffer.from(`\uFEFF${[exportHeaders, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`, 'utf8');
}

export function xlsxFile(rows: string[][]) {
  return writeExcelFile([exportHeaders, ...rows], { sheet: 'Transações' }).toBuffer();
}
