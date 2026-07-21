import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TotpSecretService } from "./totp-secret.service";

describe("TotpSecretService", () => {
  it("encrypts TOTP seeds with authenticated encryption and decrypts them", () => {
    const service = new TotpSecretService(
      new ConfigService({
        TOTP_ENCRYPTION_KEY: "separate-test-encryption-key-with-32-chars",
      }),
    );

    const encrypted = service.encrypt("JBSWY3DPEHPK3PXP");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(service.decrypt(encrypted)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("keeps legacy plaintext seeds readable during migration", () => {
    const service = new TotpSecretService(new ConfigService({}));
    expect(service.decrypt("JBSWY3DPEHPK3PXP")).toBe("JBSWY3DPEHPK3PXP");
  });

  it("fails closed when the production encryption key is missing", () => {
    const service = new TotpSecretService(
      new ConfigService({ NODE_ENV: "production" }),
    );
    expect(() => service.encrypt("JBSWY3DPEHPK3PXP")).toThrow(
      ServiceUnavailableException,
    );
  });
});
