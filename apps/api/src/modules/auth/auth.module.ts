import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService, ConfigModule } from "@nestjs/config";
import { AccountController, AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { accessTokenSecret } from "./auth-config";
import { TotpSecretService } from "./totp-secret.service";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: accessTokenSecret(configService),
        signOptions: {
          expiresIn: configService.get<string>("JWT_ACCESS_TTL", "15m") as any,
        },
      }),
    }),
  ],
  controllers: [AuthController, AccountController],
  providers: [AuthService, JwtStrategy, TotpSecretService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
