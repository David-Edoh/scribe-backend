import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';
import morgan from 'morgan';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpLogger = new Logger('HTTP');

  // Increase request body size limits to allow large manuscript/version payloads
  app.use(bodyParser.json({ limit: process.env.BODY_LIMIT || '25mb' }));
  app.use(
    bodyParser.urlencoded({
      limit: process.env.BODY_LIMIT || '25mb',
      extended: true,
    }),
  );
  app.use(
    morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      skip: (req) =>
        process.env.NODE_ENV === 'test' || req.url === '/health',
      stream: {
        write: (message) => httpLogger.log(message.trim()),
      },
    }),
  );

  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Setup Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Scribe AI Writing Assistant API')
    .setDescription('API documentation for the Scribe AI writing assistant for Christian authors')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  // Expose the OpenAPI JSON document at convenient endpoints
  app.use('/swagger-json', (_req, res) => res.json(document));
  app.use('/swagger.json', (_req, res) => res.json(document));

  const port = process.env.PORT ? +process.env.PORT : 3000;
  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}`);
}

bootstrap();
