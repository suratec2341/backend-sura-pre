import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import * as speakeasy from "speakeasy";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { PrismaService } from "@blansole/shared";
import { AuthService } from "./auth.service";
import { TotpSecretService } from "./totp-secret.service";
import {
  AppleLoginDto,
  FacebookLoginDto,
  GoogleLoginDto,
  VerifyTwoFactorDto,
} from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly totpSecrets: TotpSecretService,
  ) {}

  // POST /api/v1/auth/google
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("google")
  @HttpCode(HttpStatus.OK)
  loginGoogle(@Body() body: GoogleLoginDto) {
    return this.authService.loginWithGoogle(body.idToken);
  }

  // POST /api/v1/auth/facebook
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("facebook")
  @HttpCode(HttpStatus.OK)
  loginFacebook(@Body() body: FacebookLoginDto) {
    return this.authService.loginWithFacebook(body.accessToken);
  }

  // POST /api/v1/auth/apple
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("apple")
  @HttpCode(HttpStatus.OK)
  loginApple(@Body() body: AppleLoginDto) {
    return this.authService.loginWithApple(body.identityToken);
  }

  // POST /api/v1/auth/logout
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  logout() {}

  // POST /api/v1/auth/2fa/generate
  @Post("2fa/generate")
  async generate2fa(@CurrentUser() user: any) {
    if (!user || !user.userId) {
      throw new UnauthorizedException("User not found in request");
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });
    if (userRecord?.twoFactorEnabled) {
      throw new BadRequestException("2FA is already enabled for this account");
    }

    const secret = speakeasy.generateSecret({
      length: 20,
      name: "Blansole Admin",
    });

    // Store secret server-side
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { twoFactorSecret: this.totpSecrets.encrypt(secret.base32) },
    });

    return {
      message:
        "Store this secret securely and use the otpauth_url in an authenticator app",
      otpauth_url: secret.otpauth_url,
    };
  }

  // POST /api/v1/auth/2fa/verify
  @Post("2fa/verify")
  async verify2fa(@CurrentUser() user: any, @Body() body: VerifyTwoFactorDto) {
    if (!user || !user.userId) {
      throw new UnauthorizedException("User not found in request");
    }
    if (!body.token) {
      throw new BadRequestException("Missing token");
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });
    if (!userRecord || !userRecord.twoFactorSecret) {
      throw new BadRequestException("2FA not generated");
    }

    const verified = speakeasy.totp.verify({
      secret: this.totpSecrets.decrypt(userRecord.twoFactorSecret),
      encoding: "base32",
      token: body.token,
      window: 1, // Allow 1 step before/after to handle clock drift
    });

    if (!verified) {
      throw new UnauthorizedException("Invalid 2FA token");
    }

    if (!userRecord.twoFactorEnabled) {
      await this.prisma.user.update({
        where: { id: user.userId },
        data: { twoFactorEnabled: true },
      });
    }

    const token = await this.authService.issueAccessToken(userRecord, true);
    return {
      message: "2FA verified successfully",
      ...token,
      twoFactorVerified: true,
    };
  }
}

@Controller("account")
export class AccountController {
  constructor(private readonly authService: AuthService) {}

  // DELETE /api/v1/account
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: { userId: string }) {
    await this.authService.deleteAccount(user.userId);
  }
}
