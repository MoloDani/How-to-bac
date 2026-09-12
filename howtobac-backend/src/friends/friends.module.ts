import { Module } from '@nestjs/common';
import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';

@Module({
  controllers: [FriendsController, BlocksController],
  providers: [FriendsService, BlocksService],
})
export class FriendsModule {}
