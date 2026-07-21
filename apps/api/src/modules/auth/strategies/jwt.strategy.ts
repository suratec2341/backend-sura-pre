import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { accessTokenSecret } from "../auth-config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessTokenSecret(configService),
    });
  }

  async validate(payload: any) {
    // This payload will be attached to the request object as `req.user`
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      twoFactorVerified: payload.twoFactorVerified === true,
    };
  }
}
