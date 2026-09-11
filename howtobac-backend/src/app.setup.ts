import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { API_PREFIX } from './common/constants.js';
import type { Env } from './config/env.js';

/** HTTP-level setup shared by main.ts and the e2e tests. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Makes req.ip the real client IP behind a reverse proxy (for rate limits).
  // Leave at 0 if the API is exposed directly, or clients could spoof it.
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.enableShutdownHooks();
}
