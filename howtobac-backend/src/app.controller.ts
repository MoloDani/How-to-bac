import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppService } from './app.service.js';
import { Public } from './auth/decorators/public.decorator.js';
import { PrismaService } from './prisma/prisma.service.js';

@Public()
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * What a reverse proxy or uptime check should watch: answering here means
   * the API can reach Postgres, not just that Node is listening.
   * Not throttled, or a health check every few seconds would spend the bucket.
   */
  @Get('health')
  @SkipThrottle()
  @HttpCode(200)
  async health(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      res.status(503);
      return { status: 'degraded', db: 'down' };
    }
  }
}
