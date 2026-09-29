import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('categories')
  listCategories() {
    return this.categories.listCategories();
  }

  @Get('profiles/:profileId/subcategories')
  listSubcategories(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.categories.listSubcategories(request.user.id, profileId);
  }

  @Post('profiles/:profileId/subcategories')
  createSubcategory(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.categories.createSubcategory(request.user.id, profileId, dto.categoriaId, dto.nome);
  }

  @Patch('profiles/:profileId/subcategories/:subcategoryId')
  updateSubcategory(
    @Req() request: AuthenticatedRequest,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('subcategoryId', ParseUUIDPipe) subcategoryId: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.categories.updateSubcategory(request.user.id, profileId, subcategoryId, dto);
  }
}
