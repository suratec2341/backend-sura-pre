import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule, RedisModule } from '@blansole/shared';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

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

    // Shared (both @Global — available everywhere)
    PrismaModule,
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
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
