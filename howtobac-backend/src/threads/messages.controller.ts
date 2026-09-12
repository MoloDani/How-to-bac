import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PostThrottle } from '../common/throttle.js';
import { MessagesService } from './messages.service.js';
import {
  createMessageSchema,
  idParamSchema,
  listMessagesQuerySchema,
  updateMessageSchema,
  type CreateMessageDto,
  type ListMessagesQuery,
  type UpdateMessageDto,
} from './threads.schemas.js';

@ApiTags('messages')
@ApiBearerAuth()
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('threads/:threadId/messages')
  list(
    @CurrentUser() user: AuthUser,
    @Param('threadId', { schema: idParamSchema }) threadId: string,
    @Query({ schema: listMessagesQuerySchema }) query: ListMessagesQuery,
  ) {
    return this.messages.list(user, threadId, query);
  }

  @Post('threads/:threadId/messages')
  @PostThrottle(20)
  create(
    @CurrentUser() user: AuthUser,
    @Param('threadId', { schema: idParamSchema }) threadId: string,
    @Body({ schema: createMessageSchema }) dto: CreateMessageDto,
  ) {
    return this.messages.create(user, threadId, dto);
  }

  @Patch('messages/:messageId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('messageId', { schema: idParamSchema }) messageId: string,
    @Body({ schema: updateMessageSchema }) dto: UpdateMessageDto,
  ) {
    return this.messages.update(user, messageId, dto);
  }

  @Delete('messages/:messageId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('messageId', { schema: idParamSchema }) messageId: string,
  ) {
    await this.messages.remove(user, messageId);
  }
}
