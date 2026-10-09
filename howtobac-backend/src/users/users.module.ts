import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { AccountService } from './account.service.js';
import { AdminUsersController } from './admin-users.controller.js';
import { EmailChangeController } from './email-change.controller.js';
import { MeController } from './me.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [MeController, AdminUsersController, EmailChangeController],
  providers: [UsersService, AccountService],
})
export class UsersModule {}
