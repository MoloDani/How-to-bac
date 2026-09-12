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
import { SubjectAccess } from '../auth/decorators/subject-access.decorator.js';
import { subjectParamSchema } from '../common/subjects.js';
import { PostThrottle } from '../common/throttle.js';
import type { Subject } from '../generated/prisma/enums.js';
import {
  createThreadSchema,
  idParamSchema,
  listThreadsQuerySchema,
  moderateThreadSchema,
  updateThreadSchema,
  type CreateThreadDto,
  type ListThreadsQuery,
  type ModerateThreadDto,
  type UpdateThreadDto,
} from './threads.schemas.js';
import { ThreadsService } from './threads.service.js';

@ApiTags('threads')
@ApiBearerAuth()
@Controller()
export class ThreadsController {
  constructor(private readonly threads: ThreadsService) {}

  @Get('subjects/:subject/threads')
  @SubjectAccess('view')
  list(
    @Param('subject', { schema: subjectParamSchema }) subject: Subject,
    @Query({ schema: listThreadsQuerySchema }) query: ListThreadsQuery,
  ) {
    return this.threads.list(subject, query);
  }

  @Post('subjects/:subject/threads')
  @SubjectAccess('view')
  @PostThrottle(5)
  create(
    @CurrentUser() user: AuthUser,
    @Param('subject', { schema: subjectParamSchema }) subject: Subject,
    @Body({ schema: createThreadSchema }) dto: CreateThreadDto,
  ) {
    return this.threads.create(user, subject, dto);
  }

  @Get('threads/:threadId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('threadId', { schema: idParamSchema }) threadId: string,
  ) {
    return this.threads.get(user, threadId);
  }

  @Patch('threads/:threadId')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('threadId', { schema: idParamSchema }) threadId: string,
    @Body({ schema: updateThreadSchema }) dto: UpdateThreadDto,
  ) {
    return this.threads.rename(user, threadId, dto);
  }

  @Patch('threads/:threadId/moderation')
  moderate(
    @CurrentUser() user: AuthUser,
    @Param('threadId', { schema: idParamSchema }) threadId: string,
    @Body({ schema: moderateThreadSchema }) dto: ModerateThreadDto,
  ) {
    return this.threads.moderate(user, threadId, dto);
  }

  @Delete('threads/:threadId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('threadId', { schema: idParamSchema }) threadId: string,
  ) {
    await this.threads.remove(user, threadId);
  }
}
