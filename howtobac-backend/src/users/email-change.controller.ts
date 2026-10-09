import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { tokenOnlySchema, type TokenOnlyDto } from '../auth/auth.schemas.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { TokenThrottle } from '../common/throttle.js';
import { AccountService } from './account.service.js';

/**
 * Sits under /auth beside the other token links, but lives here with the rest
 * of the account code — putting it in AuthModule would make it and UsersModule
 * import each other.
 */
@ApiTags('auth')
@Public()
@Controller('auth')
export class EmailChangeController {
  constructor(private readonly account: AccountService) {}

  /** The link sent to the address someone is moving their account to. */
  @Post('confirm-email-change')
  @HttpCode(200)
  @TokenThrottle()
  async confirm(@Body({ schema: tokenOnlySchema }) dto: TokenOnlyDto) {
    await this.account.confirmEmailChange(dto.token);
    return { ok: true };
  }
}
