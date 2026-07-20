import { NestFactory } from '@nestjs/core';
import { WorkerHealthSyncModule } from './worker-health-sync.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerHealthSyncModule);
  console.log('🏥 Health Sync Worker started — listening for jobs');
}

bootstrap().catch((error) => {
  console.error('Failed to start Health Sync Worker', error);
  process.exit(1);
});
