import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { ThreadsController } from './threads.controller.js';
import { ThreadsService } from './threads.service.js';

@Module({
  controllers: [ThreadsController, MessagesController],
  providers: [ThreadsService, MessagesService],
})
export class ThreadsModule {}
