import { IsNotEmpty, Matches, IsString } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  nome!: string;
}
