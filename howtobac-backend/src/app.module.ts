import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { buildThrottlers } from './common/throttle.js';
import { validateEnv, type Env } from './config/env.js';
import { FriendsModule } from './friends/friends.module.js';
import { MailModule } from './mail/mail.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { observeImports } from './observe.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ThreadsModule } from './threads/threads.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Telemetry, only when OBSERVE_APP_KEY and OBSERVE_APP_SECRET are set.
    ...observeImports,
    // The tracker needs the JWT secret, so the throttlers are built from config.
    ThrottlerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: buildThrottlers(
          config.get('JWT_ACCESS_SECRET', { infer: true }),
        ),
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ThreadsModule,
    FriendsModule,
    MaintenanceModule,
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
