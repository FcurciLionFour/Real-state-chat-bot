import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../../auth/presentation/guards/access-token.guard';
import { AuthenticatedUser } from '../../../auth/domain/types/authenticated-user.type';
import { FavoritesService } from '../../application/services/favorites.service';
import { CreateFavoriteDto } from '../dto/create-favorite.dto';
import { ListFavoritesQueryDto } from '../dto/list-favorites-query.dto';

type HttpResponse = {
  status: (statusCode: number) => void;
};

@Controller('favorites')
@UseGuards(AccessTokenGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  listFavorites(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFavoritesQueryDto,
  ) {
    return this.favoritesService.listByUserId(user.id, query.page, query.limit);
  }

  @Post()
  async createFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFavoriteDto,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    const result = await this.favoritesService.create(user.id, body.propertyId);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.favorite;
  }

  @Delete(':propertyId')
  deleteFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', new ParseUUIDPipe()) propertyId: string,
  ) {
    return this.favoritesService.delete(user.id, propertyId);
  }
}
