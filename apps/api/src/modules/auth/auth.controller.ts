import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as speakeasy from 'speakeasy';

@Controller('auth')
export class AuthController {
  // POST /api/v1/auth/google
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('google')
  async loginGoogle(@Body() body: unknown) {
    // TODO: implement Google OAuth
    return { message: 'Google auth — not implemented yet' };
  }

  // POST /api/v1/auth/facebook
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('facebook')
  async loginFacebook(@Body() body: unknown) {
    // TODO: implement Facebook OAuth
    return { message: 'Facebook auth — not implemented yet' };
  }

  // POST /api/v1/auth/logout
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout() {
    // TODO: implement logout
  }

  // POST /api/v1/auth/2fa/generate
  @Post('2fa/generate')
  async generate2fa() {
    // Note: In a real app, you would associate this secret with the currently logged-in admin user
    const secret = speakeasy.generateSecret({ length: 20, name: 'Blansole Admin' });
    return {
      message: 'Store this secret securely and use the otpauth_url in an authenticator app',
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    };
  }

  // POST /api/v1/auth/2fa/verify
  @Post('2fa/verify')
  async verify2fa(@Body() body: { secret: string; token: string }) {
    if (!body.secret || !body.token) {
      return { verified: false, message: 'Missing secret or token' };
    }
    const verified = speakeasy.totp.verify({
      secret: body.secret,
      encoding: 'base32',
      token: body.token,
    });
    return { verified };
  }
}

@Controller('account')
export class AccountController {
  // DELETE /api/v1/account
  @Delete()
  async deleteAccount() {
    // TODO: trigger cascading purge job (§11)
    return { message: 'Account deletion — not implemented yet' };
  }
}
