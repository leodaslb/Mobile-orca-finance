import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TagsController } from './tags.controller';
import { TagsRepository } from './tags.repository';
import { TagsService } from './tags.service';

@Module({
  imports: [PrismaModule, AuthModule, ProfilesModule],
  controllers: [TagsController],
  providers: [TagsRepository, TagsService],
  exports: [TagsRepository],
})
export class TagsModule {}
