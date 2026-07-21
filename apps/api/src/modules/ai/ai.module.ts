import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { ProgramRecommendationService } from "./program-recommendation.service";

@Module({
  controllers: [AiController],
  providers: [AiService, ProgramRecommendationService],
  exports: [AiService],
})
export class AiModule {}
