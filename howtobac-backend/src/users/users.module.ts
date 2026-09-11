import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller.js';
import { MeController } from './me.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [MeController, AdminUsersController],
  providers: [UsersService],
})
export class UsersModule {}
