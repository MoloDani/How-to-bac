import { timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from './config/env.js';

const DOCS_PATH = 'docs';

/**
 * Swagger UI at /docs and the OpenAPI JSON at /docs-json. Request bodies are
 * documented straight from the zod schemas on @Body / @Query.
 */
export function setupSwagger(app: NestExpressApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  if (!config.get('SWAGGER_ENABLED', { infer: true })) return;

  const user = config.get('SWAGGER_USER', { infer: true });
  const password = config.get('SWAGGER_PASSWORD', { infer: true });
  if (user && password) {
    app.use([`/${DOCS_PATH}`, `/${DOCS_PATH}-json`], basicAuth(user, password));
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('How to Bac API')
      .setVersion('1')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'The accessToken returned by POST /v1/auth/login',
      })
      .build(),
  );

  SwaggerModule.setup(DOCS_PATH, app, document, {
    customSiteTitle: 'How to Bac API',
    // Keep the pasted access token across page reloads.
    swaggerOptions: { persistAuthorization: true },
  });
}

/** Asks the browser for a username and password before showing the docs. */
function basicAuth(user: string, password: string) {
  const expected = Buffer.from(`${user}:${password}`);

  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.get('authorization') ?? '';
    const given = header.startsWith('Basic ')
      ? Buffer.from(header.slice(6), 'base64')
      : Buffer.alloc(0);

    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return next();
    }
    res
      .set('WWW-Authenticate', 'Basic realm="How to Bac API docs"')
      .status(401)
      .send('Authentication required');
  };
}
