import { IsNotEmpty, Matches, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  nome!: string;
}
