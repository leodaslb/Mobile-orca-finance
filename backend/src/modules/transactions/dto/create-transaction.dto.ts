import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Essencialidade, MetodoPagamento, StatusTransacao, TipoTransacao } from '../../../generated/prisma/client';

export class CreateTransactionDto {
  @IsEnum(TipoTransacao)
  tipo!: TipoTransacao;

  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valor!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  dataHora!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  descricao!: string;

  @IsOptional()
  @IsString()
  anotacao?: string | null;

  @IsOptional()
  @IsUUID()
  categoriaId?: string | null;

  @IsOptional()
  @IsUUID()
  subcategoriaId?: string | null;

  @IsOptional()
  @IsEnum(MetodoPagamento)
  metodoPagamento?: MetodoPagamento | null;

  @IsOptional()
  @IsEnum(Essencialidade)
  essencialidade?: Essencialidade;

  @IsOptional()
  @IsBoolean()
  ehGastoLivre?: boolean;

  @IsEnum(StatusTransacao)
  status!: StatusTransacao;
}
