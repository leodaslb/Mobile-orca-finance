import { IsString, IsUUID, Matches } from 'class-validator';

export class CreateEssentialExpenseChallengeDto {
  @IsUUID() categoriaId!: string;
}
export class UpdateEssentialExpenseChallengeDto {
  @IsString() @Matches(/\S/) nome!: string;
}
