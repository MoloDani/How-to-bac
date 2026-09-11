import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import {
  setMySubjectsSchema,
  updateMeSchema,
  type SetMySubjectsDto,
  type UpdateMeDto,
} from './users.schemas.js';
import { UsersService } from './users.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body({ schema: updateMeSchema }) dto: UpdateMeDto,
  ) {
    return this.users.updateProfile(user.id, dto);
  }

  @Put('subjects')
  setSubjects(
    @CurrentUser() user: AuthUser,
    @Body({ schema: setMySubjectsSchema }) dto: SetMySubjectsDto,
  ) {
    return this.users.setOwnSubjects(user, dto.subjects);
  }
}
