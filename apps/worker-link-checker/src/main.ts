import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { NestFactory } from "@nestjs/core";
import { PrismaService, QUEUES, RedisModule } from "@blansole/shared";
import { LinkCheckerProcessor } from "./processors/link-checker.processor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    BullModule.registerQueue({ name: QUEUES.LINK_CHECK }),
  ],
  providers: [PrismaService, LinkCheckerProcessor],
})
class WorkerLinkCheckerModule {}

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerLinkCheckerModule);
  console.log("Link Checker Worker started - listening for jobs");
}

bootstrap().catch((error) => {
  console.error("Failed to start Link Checker Worker", error);
  process.exit(1);
});
