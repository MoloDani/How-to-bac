import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { publicUserSelect, toPublicUser } from '../../users/public-user.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TokenService, type AccessPayload } from '../token.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing_token');
    }

    let payload: AccessPayload;
    try {
      payload = await this.tokens.verifyAccess(header.slice(7).trim());
    } catch (err) {
      // Separate code for expiry so the client knows to refresh silently
      // instead of bouncing the user to the login screen.
      throw new UnauthorizedException(
        (err as Error)?.name === 'TokenExpiredError'
          ? 'token_expired'
          : 'invalid_token',
      );
    }

    // Loaded on every request so role and subject changes apply immediately.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: publicUserSelect,
    });
    if (!user) throw new UnauthorizedException('invalid_token');

    req.user = toPublicUser(user);
    return true;
  }
}
