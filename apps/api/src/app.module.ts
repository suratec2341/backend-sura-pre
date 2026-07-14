import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService, RedisModule } from '@blansole/shared';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DeviceModule } from './modules/device/device.module';
import { SessionModule } from './modules/session/session.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthCheckController } from './health-check.controller';

@Module({
  imports: [
    // Config — reads .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate Limiting (Global defaults: 100 requests per 60 seconds)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Shared
    RedisModule,

    // Feature modules (ตรงกับ §2 System Architecture Diagram)
    AuthModule,
    UserModule,
    DeviceModule,
    SessionModule,
    AiModule,
    NotificationModule,
    HealthModule,
    AdminModule,
  ],
  controllers: [HealthCheckController],
  providers: [
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PrismaService],
})
export class AppModule {}
