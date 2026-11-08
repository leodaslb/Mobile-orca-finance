import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { IMPORT_MAX_ROWS } from './import.dto';

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MULTIPART_LIMITS = { fileSize: IMPORT_MAX_BYTES, files: 1, fields: 0, parts: 1 };

// CSV com ;, campos entre aspas, aspas duplicadas e quebras de linha em descrições.
// rowNumber identifica a linha física inicial do registro no arquivo original.
export function parseCsv(buffer: Buffer): { rowNumber: number; cells: string[] }[] {
  if (buffer.length > IMPORT_MAX_BYTES) throw new PayloadTooLargeException('CSV excede 5 MiB.');
  let content: string;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { throw new BadRequestException('CSV deve utilizar UTF-8 válido.'); }
  const rows: { rowNumber: number; cells: string[] }[] = [];
  let cells: string[] = []; let field = ''; let quoted = false; let closed = false; let line = 1; let rowNumber = 1;
  const flush = () => { cells.push(field); rows.push({ rowNumber, cells }); cells = []; field = ''; closed = false; };
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; }
      } else { field += char; if (char === '\n') line++; }
    } else if (char === ';') { cells.push(field); field = ''; closed = false; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') i++;
      flush(); line++; rowNumber = line;
    } else if (char === '"' && field === '' && !closed) quoted = true;
    else {
      if (closed || char === '"' || char === '\0') throw new BadRequestException(`CSV inválido na linha ${line}.`);
      field += char;
    }
  }
  if (quoted) throw new BadRequestException('CSV contém aspas não fechadas.');
  if (field || cells.length || closed) flush();
  if (rows.shift()?.cells.join(';') !== 'tipo;valor;data_hora;descricao;categoria') throw new BadRequestException('Cabeçalho CSV inválido.');
  if (!rows.length) throw new BadRequestException('CSV sem registros.');
  if (rows.length > IMPORT_MAX_ROWS) throw new PayloadTooLargeException(`Envie até ${IMPORT_MAX_ROWS} registros por lote.`);
  return rows;
}
