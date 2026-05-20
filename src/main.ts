import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import {
  json,
  text,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  // Tracking hub: navigator.sendBeacon envia text/plain (sem preflight CORS).
  // Parseia o corpo text/plain como JSON para os endpoints /tracking/*.
  app.use(text({ type: ['text/plain'], limit: '64kb' }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (typeof req.body === 'string' && req.body.length > 0) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // deixa como string — a validação do DTO rejeita com 400
      }
    }
    next();
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  // serve uploads dir publicly (apenas dev — em prod usar R2)
  const express = require('express');
  app.use('/uploads', express.static(uploadsDir));

  const config = new DocumentBuilder()
    .setTitle('SEO Blog API')
    .setDescription('CMS multi-tenant para publicação automatizada com SEO')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.use('/reference', apiReference({ spec: { content: document } }));

  const port = Number(process.env.PORT) || 3333;
  await app.listen(port);
  console.log(`[seo-blog-backend] running on http://localhost:${port}`);
  console.log(`[seo-blog-backend] docs at  http://localhost:${port}/reference`);
}
bootstrap();
