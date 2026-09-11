import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { MailModule } from '../mail/mail.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenTransport } from './refresh-token-transport.js';
import { TokenService } from './token.service.js';

const JWT_ISSUER = 'howtobac';

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_TTL', {
            infer: true,
          }) as JwtSignOptions['expiresIn'],
          issuer: JWT_ISSUER,
        },
        verifyOptions: { issuer: JWT_ISSUER, algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenTransport,
  ],
  exports: [TokenService],
})
export class AuthModule {}
