import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class ReceiptDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  arquivoUrl!: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  mimeType?: string | null;
}
