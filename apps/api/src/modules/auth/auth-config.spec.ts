import { ConfigService } from "@nestjs/config";
import { accessTokenSecret, DEVELOPMENT_JWT_SECRET } from "./auth-config";

describe("accessTokenSecret", () => {
  it("rejects the development or a short JWT secret in production", () => {
    expect(() =>
      accessTokenSecret(
        new ConfigService({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: DEVELOPMENT_JWT_SECRET,
        }),
      ),
    ).toThrow("at least 32 characters");

    expect(() =>
      accessTokenSecret(
        new ConfigService({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: "too-short",
        }),
      ),
    ).toThrow("at least 32 characters");
  });

  it("accepts a sufficiently long production JWT secret", () => {
    const secret = "a-unique-production-secret-that-is-long-enough";
    expect(
      accessTokenSecret(
        new ConfigService({
          NODE_ENV: "production",
          JWT_ACCESS_SECRET: secret,
        }),
      ),
    ).toBe(secret);
  });
});
