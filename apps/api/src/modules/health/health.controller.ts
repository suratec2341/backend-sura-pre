import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import {
  ConnectHealthIntegrationDto,
  SyncHealthIntegrationDto,
} from "./dto/health.dto";
import { HealthService } from "./health.service";

interface AuthenticatedUser {
  userId: string;
}

@Controller("health-integrations")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.healthService.list(user.userId);
  }

  @Post("connect")
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ConnectHealthIntegrationDto,
  ) {
    return this.healthService.connect(user.userId, body);
  }

  @Post("sync")
  @HttpCode(HttpStatus.ACCEPTED)
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SyncHealthIntegrationDto,
  ) {
    return this.healthService.sync(user.userId, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    await this.healthService.disconnect(user.userId, id);
  }
}
