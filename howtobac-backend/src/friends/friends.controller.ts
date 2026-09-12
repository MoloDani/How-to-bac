import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PostThrottle } from '../common/throttle.js';
import {
  listQuerySchema,
  sendRequestSchema,
  userIdParamSchema,
  type ListQuery,
  type SendRequestDto,
} from './friends.schemas.js';
import { FriendsService } from './friends.service.js';

@ApiTags('friends')
@ApiBearerAuth()
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query({ schema: listQuerySchema }) query: ListQuery,
  ) {
    return this.friends.listFriends(user, query);
  }

  @Get('requests/incoming')
  incoming(
    @CurrentUser() user: AuthUser,
    @Query({ schema: listQuerySchema }) query: ListQuery,
  ) {
    return this.friends.listRequests(user, 'incoming', query);
  }

  @Get('requests/outgoing')
  outgoing(
    @CurrentUser() user: AuthUser,
    @Query({ schema: listQuerySchema }) query: ListQuery,
  ) {
    return this.friends.listRequests(user, 'outgoing', query);
  }

  @Get('status/:userId')
  status(
    @CurrentUser() user: AuthUser,
    @Param('userId', { schema: userIdParamSchema }) userId: string,
  ) {
    return this.friends.status(user, userId);
  }

  /** 201 with REQUEST_SENT, or 200 with FRIENDS when they had already asked you. */
  @Post('requests')
  @PostThrottle(10)
  async sendRequest(
    @CurrentUser() user: AuthUser,
    @Body({ schema: sendRequestSchema }) dto: SendRequestDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { created, view } = await this.friends.sendRequest(
      user,
      dto.friendCode,
    );
    res.status(created ? 201 : 200);
    return view;
  }

  @Post('requests/:userId/accept')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('userId', { schema: userIdParamSchema }) userId: string,
  ) {
    return this.friends.accept(user, userId);
  }

  /** Decline their request, or cancel yours. */
  @Delete('requests/:userId')
  @HttpCode(204)
  async removeRequest(
    @CurrentUser() user: AuthUser,
    @Param('userId', { schema: userIdParamSchema }) userId: string,
  ) {
    await this.friends.removeRequest(user, userId);
  }

  @Delete(':userId')
  @HttpCode(204)
  async unfriend(
    @CurrentUser() user: AuthUser,
    @Param('userId', { schema: userIdParamSchema }) userId: string,
  ) {
    await this.friends.unfriend(user, userId);
  }
}
