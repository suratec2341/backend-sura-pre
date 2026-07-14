import { Module, Global } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";

// Queue name constants — ใช้ตรงนี้เป็น single source of truth
export const QUEUES = {
  SESSION_PROCESS: 'session-process',
  AI_SUMMARY: 'ai-summary',
  AI_CHAT: 'ai-chat',
  NOTIFICATION: 'notification-send',
  HEALTH_SYNC: 'health-sync',
  LINK_CHECK: 'link-check',
  EPISODE_SUMMARY: 'episode-summary',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisPort = Number(config.get<string>("REDIS_PORT") ?? 6379);

        return {
          connection: {
            host: config.get<string>("REDIS_HOST", "localhost"),
            port: Number.isNaN(redisPort) ? 6379 : redisPort,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class RedisModule {}
