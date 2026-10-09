import { Test, type TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  const build = async (queryRaw: () => Promise<unknown>) => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();
    return app.get(AppController);
  };

  it('answers at the root', async () => {
    const controller = await build(() => Promise.resolve([{ 1: 1 }]));
    expect(controller.getHello()).toBe('Hello World!');
  });

  describe('health', () => {
    /** Just the bit of Response the handler touches. */
    const res = () => {
      const statuses: number[] = [];
      return {
        statuses,
        response: { status: (code: number) => statuses.push(code) },
      };
    };

    it('reports ok while the database answers', async () => {
      const controller = await build(() => Promise.resolve([{ 1: 1 }]));
      const { statuses, response } = res();

      expect(await controller.health(response as unknown as Response)).toEqual({
        status: 'ok',
        db: 'up',
      });
      expect(statuses).toEqual([]);
    });

    it('answers 503 when the database is unreachable', async () => {
      const controller = await build(() =>
        Promise.reject(new Error('ECONNREFUSED')),
      );
      const { statuses, response } = res();

      expect(await controller.health(response as unknown as Response)).toEqual({
        status: 'degraded',
        db: 'down',
      });
      expect(statuses).toEqual([503]);
    });
  });
});
