import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { BlocksService } from './blocks.service.js';
import {
  listQuerySchema,
  userIdParamSchema,
  type ListQuery,
} from './friends.schemas.js';

@ApiTags('friends')
@ApiBearerAuth()
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: listQuerySchema }) query: ListQuery,
  ) {
    return this.blocks.list(user, query);
  }

  @Put(':userId')
  @HttpCode(204)
  async block(
    @CurrentUser() user: AuthUser,
    @Param('userId', { schema: userIdParamSchema }) userId: string,
  ) {
    await this.blocks.block(user, userId);
  }

  @Delete(':userId')
  @HttpCode(204)
  async unblock(
    @CurrentUser() user: AuthUser,
    @Param('userId', { schema: userIdParamSchema }) userId: string,
  ) {
    await this.blocks.unblock(user, userId);
  }
}
