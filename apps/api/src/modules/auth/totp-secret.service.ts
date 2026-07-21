import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { accessTokenSecret } from "./auth-config";

@Injectable()
export class TotpSecretService {
  constructor(private readonly config: ConfigService) {}

  encrypt(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
  }

  decrypt(value: string) {
    if (!value.startsWith("enc:v1:")) return value;
    const [, , ivValue, tagValue, encryptedValue] = value.split(":");
    if (!ivValue || !tagValue || !encryptedValue)
      throw new Error("Malformed encrypted TOTP secret");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private key() {
    const configured = this.config.get<string>("TOTP_ENCRYPTION_KEY")?.trim();
    if (!configured && this.config.get<string>("NODE_ENV") === "production") {
      throw new ServiceUnavailableException(
        "TOTP_ENCRYPTION_KEY is not configured",
      );
    }
    return createHash("sha256")
      .update(configured || accessTokenSecret(this.config))
      .digest();
  }
}
