import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AccountThrottle, TokenThrottle } from '../common/throttle.js';
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tagAvailableQuerySchema,
  tokenOnlySchema,
  type EmailOnlyDto,
  type LoginDto,
  type RegisterDto,
  type ResetPasswordDto,
  type TagAvailableQuery,
  type TokenOnlyDto,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { RefreshTokenTransport } from './refresh-token-transport.js';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly refreshTransport: RefreshTokenTransport,
  ) {}

  @Post('register')
  @HttpCode(202)
  @AccountThrottle()
  async register(@Body({ schema: registerSchema }) dto: RegisterDto) {
    await this.auth.register(dto);
    return { ok: true };
  }

  /**
   * Live check for the sign-up form. Tags are public, so this reveals nothing
   * an account page wouldn't; the limit is only there to stop bulk scraping.
   */
  @Get('tag-available')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async tagAvailable(
    @Query({ schema: tagAvailableQuerySchema }) query: TagAvailableQuery,
  ) {
    return { available: await this.auth.isTagAvailable(query.tag) };
  }

  @Post('verify-email')
  @HttpCode(200)
  @TokenThrottle()
  async verifyEmail(@Body({ schema: tokenOnlySchema }) dto: TokenOnlyDto) {
    await this.auth.verifyEmail(dto.token);
    return { ok: true };
  }

  @Post('resend-verification')
  @HttpCode(200)
  @AccountThrottle()
  async resendVerification(
    @Body({ schema: emailOnlySchema }) dto: EmailOnlyDto,
  ) {
    await this.auth.resendVerification(dto.email);
    return { ok: true };
  }

  @Post('login')
  @HttpCode(200)
  @AccountThrottle()
  async login(
    @Body({ schema: loginSchema }) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.login(dto);
    return {
      user,
      accessToken: tokens.accessToken,
      ...this.refreshTransport.send(req, res, tokens.refreshToken),
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.auth.refresh(this.refreshTransport.read(req));
      return {
        accessToken: tokens.accessToken,
        ...this.refreshTransport.send(req, res, tokens.refreshToken),
      };
    } catch (err) {
      this.refreshTransport.clear(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(this.refreshTransport.read(req));
    this.refreshTransport.clear(res);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @AccountThrottle()
  async forgotPassword(@Body({ schema: emailOnlySchema }) dto: EmailOnlyDto) {
    await this.auth.forgotPassword(dto.email);
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  @TokenThrottle()
  async resetPassword(
    @Body({ schema: resetPasswordSchema }) dto: ResetPasswordDto,
  ) {
    await this.auth.resetPassword(dto);
    return { ok: true };
  }
}
