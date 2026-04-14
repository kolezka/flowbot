import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { configure } from '@trigger.dev/sdk/v3';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Configure Trigger.dev SDK for self-hosted instance
if (process.env.TRIGGER_SECRET_KEY) {
  configure({
    secretKey: process.env.TRIGGER_SECRET_KEY,
    baseURL: process.env.TRIGGER_API_URL,
  });
}

async function pushSchema() {
  const { execFileSync } = await import('child_process');
  const schemaPath = require('path').resolve(__dirname, '../../packages/db/prisma/schema.prisma');
  try {
    console.log(`Pushing database schema from ${schemaPath}...`);
    const output = execFileSync('prisma', [
      'db', 'push', '--skip-generate', '--accept-data-loss', '--schema', schemaPath,
    ], { encoding: 'utf8', timeout: 30_000 });
    console.log(output);
    console.log('Schema push completed');
  } catch (err) {
    console.warn('WARNING: Schema push failed:', (err as Error).message?.slice(0, 500));
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  });

  // Configure Swagger API documentation (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('User Dashboard API')
      .setDescription('API for managing Telegram bot users')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`API documentation available at: http://localhost:${port}/api/docs`);
  }
}
pushSchema().then(() => bootstrap());
