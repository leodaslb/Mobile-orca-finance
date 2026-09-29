import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsString, IsUUID, Matches, ValidateIf } from 'class-validator';
import { Essencialidade, MetodoPagamento, StatusTransacao, TipoTransacao } from '../../../generated/prisma/client';

export class UpdateTransactionDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TipoTransacao)
  tipo?: TipoTransacao;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valor?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/)
  dataHora?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  descricao?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  anotacao?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  categoriaId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  subcategoriaId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsEnum(MetodoPagamento)
  metodoPagamento?: MetodoPagamento | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(Essencialidade)
  essencialidade?: Essencialidade;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  ehGastoLivre?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(StatusTransacao)
  status?: StatusTransacao;
}
