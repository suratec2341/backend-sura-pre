import { Module, Global } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";

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
