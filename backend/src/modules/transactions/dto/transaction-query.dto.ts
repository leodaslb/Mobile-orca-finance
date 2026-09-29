import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { MetodoPagamento, StatusTransacao, TipoTransacao } from '../../../generated/prisma/client';

export class TransactionQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  dataInicial?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  dataFinal?: string;

  @IsOptional()
  @IsEnum(TipoTransacao)
  tipo?: TipoTransacao;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsEnum(MetodoPagamento)
  metodoPagamento?: MetodoPagamento;

  @IsOptional()
  @IsEnum(StatusTransacao)
  status?: StatusTransacao;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  descricao?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valor?: string;
}
