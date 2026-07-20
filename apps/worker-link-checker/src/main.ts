import { NestFactory } from '@nestjs/core';
import { WorkerLinkCheckerModule } from './worker-link-checker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerLinkCheckerModule);
  console.log('🔗 Link Checker Worker started — listening for jobs');
}

bootstrap().catch((error) => {
  console.error('Failed to start Link Checker Worker', error);
  process.exit(1);
});
