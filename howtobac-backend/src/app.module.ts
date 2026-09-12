import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { throttlers } from './common/throttle.js';
import { validateEnv } from './config/env.js';
import { MailModule } from './mail/mail.module.js';
import { observeImports } from './observe.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ThreadsModule } from './threads/threads.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Telemetry, only when OBSERVE_APP_KEY and OBSERVE_APP_SECRET are set.
    ...observeImports,
    ThrottlerModule.forRoot({ throttlers }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ThreadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Validates every @Body/@Query that declares a `schema` (zod).
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    // Order matters: rate limit first, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
