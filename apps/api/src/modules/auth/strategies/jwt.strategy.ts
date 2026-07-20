import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', 'CHANGE_ME_DEV_ACCESS_SECRET'),
    });
  }

  async validate(payload: any) {
    // This payload will be attached to the request object as `req.user`
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
