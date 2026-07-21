import { ConfigService } from "@nestjs/config";

export const DEVELOPMENT_JWT_SECRET = "CHANGE_ME_DEV_ACCESS_SECRET";

export function accessTokenSecret(config: ConfigService) {
  const secret = config
    .get<string>("JWT_ACCESS_SECRET", DEVELOPMENT_JWT_SECRET)
    .trim();
  if (
    config.get<string>("NODE_ENV") === "production" &&
    (secret === DEVELOPMENT_JWT_SECRET || secret.length < 32)
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET must be a unique production secret of at least 32 characters",
    );
  }
  return secret;
}
