import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PasswordService } from '../auth/password.service.js';
import { TokenService, type TokenPair } from '../auth/token.service.js';
import { AuthTokenPurpose } from '../generated/prisma/enums.js';
import { MailService } from '../mail/mail.service.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangeEmailDto, ChangePasswordDto } from './users.schemas.js';

/**
 * The things people do to their own account that need their password again:
 * changing it, moving to another address, and closing the account.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  /**
   * Returns a fresh pair: every other session ends, but the tab that made the
   * change stays signed in.
   */
  async changePassword(
    user: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<TokenPair> {
    await this.verifyPassword(user.id, dto.currentPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.passwords.hash(dto.newPassword),
        sessionsValidFrom: new Date(),
      },
    });
    await this.tokens.revokeAllForUser(user.id);

    return this.tokens.issuePair(user.id);
  }

  /**
   * Parks the new address until it's confirmed from its own inbox, so a typo
   * can't take the account away. The old address is told it happened.
   */
  async requestEmailChange(user: AuthUser, dto: ChangeEmailDto): Promise<void> {
    await this.verifyPassword(user.id, dto.currentPassword);

    if (dto.newEmail === user.email) {
      throw new BadRequestException('email_unchanged');
    }
    const taken = await this.prisma.user.findUnique({
      where: { email: dto.newEmail },
      select: { id: true },
    });
    if (taken) throw new ConflictException('email_taken');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: dto.newEmail },
    });

    const token = await this.tokens.issueAuthToken(
      user.id,
      AuthTokenPurpose.EMAIL_CHANGE,
    );
    void this.mail.sendEmailChangeEmail(dto.newEmail, token);
    void this.mail.sendEmailChangeNotice(user.email, dto.newEmail);
  }

  /** The link in the new inbox. Ends every session: the next login uses it. */
  async confirmEmailChange(token: string): Promise<void> {
    const userId = await this.tokens.consumeAuthToken(
      token,
      AuthTokenPurpose.EMAIL_CHANGE,
    );
    if (!userId) throw new BadRequestException('invalid_or_expired_token');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pendingEmail: true },
    });
    // The change was cancelled, or already applied by an earlier link.
    if (!user?.pendingEmail) {
      throw new BadRequestException('invalid_or_expired_token');
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: user.pendingEmail,
          pendingEmail: null,
          // They just proved they own it.
          emailVerifiedAt: new Date(),
          sessionsValidFrom: new Date(),
        },
      });
    } catch (err) {
      // Someone else claimed the address while this link was waiting.
      if (isUniqueViolation(err)) throw new ConflictException('email_taken');
      throw err;
    }

    await this.tokens.revokeAllForUser(userId);
  }

  /**
   * Hard delete. The cascades take the subjects, tokens, friendships and
   * blocks with it; threads and messages keep their rows with no author, so
   * the discussions other people took part in survive.
   */
  async deleteAccount(user: AuthUser, currentPassword: string): Promise<void> {
    await this.verifyPassword(user.id, currentPassword);
    await this.prisma.user.delete({ where: { id: user.id } });
  }

  private async verifyPassword(userId: string, password: string) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await this.passwords.verify(row.passwordHash, password))) {
      throw new UnauthorizedException('invalid_credentials');
    }
  }
}
