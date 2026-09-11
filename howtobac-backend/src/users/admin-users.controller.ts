import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  listUsersQuerySchema,
  setRoleSchema,
  setSubjectsSchema,
  type ListUsersQuery,
  type SetRoleDto,
  type SetSubjectsDto,
} from './users.schemas.js';
import { UsersService } from './users.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query({ schema: listUsersQuerySchema }) query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Patch(':id/role')
  setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: setRoleSchema }) dto: SetRoleDto,
  ) {
    return this.users.setRole(id, dto.role);
  }

  @Put(':id/subjects')
  setSubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: setSubjectsSchema }) dto: SetSubjectsDto,
    @CurrentUser() admin: AuthUser,
  ) {
    return this.users.setSubjects(id, dto.subjects, admin.id);
  }
}
