import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { HealthSyncQueueService } from "./health-sync-queue.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService, HealthSyncQueueService],
})
export class HealthModule {}
