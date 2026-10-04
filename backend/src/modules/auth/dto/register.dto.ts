import { IsEmail, IsNotEmpty, Matches, IsString } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  senha!: string;
}
