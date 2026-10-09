import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { RefreshTokenTransport } from '../auth/refresh-token-transport.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PostThrottle } from '../common/throttle.js';
import { AccountService } from './account.service.js';
import {
  changeEmailSchema,
  confirmPasswordSchema,
  changePasswordSchema,
  setMySubjectsSchema,
  updateMeSchema,
  type ChangeEmailDto,
  type ChangePasswordDto,
  type ConfirmPasswordDto,
  type SetMySubjectsDto,
  type UpdateMeDto,
} from './users.schemas.js';
import { UsersService } from './users.service.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly account: AccountService,
    private readonly refreshTransport: RefreshTokenTransport,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Patch()
  @PostThrottle(10)
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

  /** Ends every other session and keeps this one signed in. */
  @Post('password')
  @HttpCode(200)
  @PostThrottle(5)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body({ schema: changePasswordSchema }) dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.account.changePassword(user, dto);
    return {
      accessToken: tokens.accessToken,
      ...this.refreshTransport.send(req, res, tokens.refreshToken),
    };
  }

  /** Starts an email change; nothing moves until the new address confirms. */
  @Post('email')
  @HttpCode(202)
  @PostThrottle(5)
  async changeEmail(
    @CurrentUser() user: AuthUser,
    @Body({ schema: changeEmailSchema }) dto: ChangeEmailDto,
  ) {
    await this.account.requestEmailChange(user, dto);
    return { ok: true };
  }

  @Delete()
  @HttpCode(204)
  @PostThrottle(5)
  async remove(
    @CurrentUser() user: AuthUser,
    @Body({ schema: confirmPasswordSchema }) dto: ConfirmPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.deleteAccount(user, dto.currentPassword);
    this.refreshTransport.clear(res);
  }
}
