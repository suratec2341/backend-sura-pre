import { NestFactory } from '@nestjs/core';
import { WorkerNotificationModule } from './worker-notification.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerNotificationModule);
  console.log('🔔 Notification Worker started — listening for jobs');
}

bootstrap().catch((error) => {
  console.error('Failed to start Notification Worker', error);
  process.exit(1);
});
