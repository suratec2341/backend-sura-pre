import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  FinishSessionDto,
  PushSessionDataDto,
  SessionListQueryDto,
  StartSessionDto,
  SyncBatchDto,
} from './dto/session.dto';
import { SessionService, UploadedSensorFile } from './session.service';

interface AuthenticatedUser {
  userId: string;
}

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post('start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() body: StartSessionDto) {
    return this.sessionService.start(user.userId, body);
  }

  @Post(':id/data')
  @HttpCode(HttpStatus.ACCEPTED)
  pushData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: PushSessionDataDto,
  ) {
    return this.sessionService.pushData(user.userId, id, body);
  }

  @Post(':id/finish')
  finish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: FinishSessionDto,
  ) {
    return this.sessionService.finish(user.userId, id, body);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Limit heavy batch sync operations
  @Post('sync-batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  }))
  syncBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SyncBatchDto,
    @UploadedFile() file?: UploadedSensorFile,
  ) {
    return this.sessionService.syncBatch(user.userId, body, file);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SessionListQueryDto,
  ) {
    return this.sessionService.list(user.userId, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sessionService.get(user.userId, id);
  }

  @Get(':id/pressure-map')
  pressureMap(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sessionService.pressureMap(user.userId, id);
  }

  @Get(':id/gait-analysis')
  gaitAnalysis(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sessionService.gaitAnalysis(user.userId, id);
  }

  @Get(':id/insight')
  insight(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sessionService.insight(user.userId, id);
  }
}
