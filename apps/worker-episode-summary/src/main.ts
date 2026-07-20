import { NestFactory } from '@nestjs/core';
import { WorkerEpisodeSummaryModule } from './worker-episode-summary.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerEpisodeSummaryModule);
  console.log('📊 Episode Summary Worker started — listening for jobs');
}

bootstrap().catch((error) => {
  console.error('Failed to start Episode Summary Worker', error);
  process.exit(1);
});
