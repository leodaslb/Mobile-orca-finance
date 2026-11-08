import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString() @MaxLength(512) @Matches(/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/) token!: string;
  @IsIn(['ANDROID', 'IOS']) platform!: string;
}
