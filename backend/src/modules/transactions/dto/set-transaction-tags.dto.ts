import { IsArray, IsUUID } from 'class-validator';

export class SetTransactionTagsDto {
  @IsArray()
  @IsUUID('all', { each: true })
  tagIds!: string[];
}
