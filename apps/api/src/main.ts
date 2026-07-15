import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { API_PREFIX } from "@blansole/shared";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  const corsOrigins = process.env.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  });

  // Global prefix: /api/v1; keep /healthz outside the prefix for Docker/LB checks.
  app.setGlobalPrefix(API_PREFIX, { exclude: ["healthz"] });

  // Validation pipe — auto-validate DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true, // auto-transform payloads to DTO instances
    }),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Blansole API')
    .setDescription('API documentation for Blansole Smart Insole Health App')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(
    `🚀 Blansole API running on http://localhost:${port}/${API_PREFIX}`,
  );
}

bootstrap().catch((error) => {
  console.error("Failed to start Blansole API", error);
  process.exit(1);
});
