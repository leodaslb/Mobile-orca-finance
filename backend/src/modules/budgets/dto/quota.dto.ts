import { IsString, Matches } from 'class-validator';

export class QuotaDto {
  @IsString()
  @Matches(/^\d{1,17}(?:\.\d{1,2})?$/)
  valorLimite!: string;
}
