import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthTokenPurpose } from '../generated/prisma/enums.js';
import { MailService } from '../mail/mail.service.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  publicUserSelect,
  toPublicUser,
  type PublicUser,
} from '../users/public-user.js';
import type {
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './auth.schemas.js';
import { PasswordService } from './password.service.js';
import { TokenService, type TokenPair } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  /**
   * Same response whether or not the email is taken, so sign-up can't be used
   * to discover accounts. The email itself tells the real owner what happened.
   */
  async register(dto: RegisterDto): Promise<void> {
    // Hash up front so every branch costs roughly the same time.
    const passwordHash = await this.passwords.hash(dto.password);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, emailVerifiedAt: true },
    });

    if (existing?.emailVerifiedAt) {
      void this.mail.sendAccountExistsEmail(dto.email);
      return;
    }
    if (existing) {
      await this.sendVerification(existing.id, dto.email);
      return;
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          userName: dto.userName,
          subjects: {
            create: dto.subjects.map((subject) => ({ subject })),
          },
        },
        select: { id: true },
      });
      await this.sendVerification(user.id, dto.email);
    } catch (err) {
      // A concurrent sign-up with the same email won the race.
      if (!isUniqueViolation(err)) throw err;
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.tokens.consumeAuthToken(
      token,
      AuthTokenPurpose.EMAIL_VERIFY,
    );
    if (!userId) throw new BadRequestException('invalid_or_expired_token');

    await this.markVerified(userId);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt) {
      await this.sendVerification(user.id, email);
    }
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...publicUserSelect, passwordHash: true },
    });

    // Always run one argon2 verify so both paths cost the same.
    const ok = user
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : await this.passwords.verifyDummy(dto.password);

    if (!user || !ok) throw new UnauthorizedException('invalid_credentials');

    // Only reachable with the right password, so this doesn't leak anything.
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('email_not_verified');
    }

    return {
      user: toPublicUser(user),
      tokens: await this.tokens.issuePair(user.id),
    };
  }

  async refresh(refreshToken: string | null): Promise<TokenPair> {
    const pair = refreshToken
      ? await this.tokens.rotateRefresh(refreshToken)
      : null;
    if (!pair) throw new UnauthorizedException('invalid_refresh_token');
    return pair;
  }

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken) await this.tokens.revokeByToken(refreshToken);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) return;

    const token = await this.tokens.issueAuthToken(
      user.id,
      AuthTokenPurpose.PASSWORD_RESET,
    );
    void this.mail.sendPasswordResetEmail(email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.tokens.consumeAuthToken(
      dto.token,
      AuthTokenPurpose.PASSWORD_RESET,
    );
    if (!userId) throw new BadRequestException('invalid_or_expired_token');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(dto.password) },
    });
    // Whoever completed this owns the inbox, so treat the email as verified.
    await this.markVerified(userId);

    // If the reset happened because the account was compromised, the
    // attacker's sessions must die too.
    await this.tokens.revokeAllForUser(userId);
  }

  private async sendVerification(userId: string, email: string) {
    const token = await this.tokens.issueAuthToken(
      userId,
      AuthTokenPurpose.EMAIL_VERIFY,
    );
    void this.mail.sendVerificationEmail(email, token);
  }

  private async markVerified(userId: string) {
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }
}
