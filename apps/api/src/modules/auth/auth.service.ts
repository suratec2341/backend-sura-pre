import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  createPublicKey,
  verify,
  type JsonWebKey as CryptoJsonWebKey,
} from "node:crypto";
import { PrismaService } from "@blansole/shared";

interface ProviderIdentity {
  provider: "google" | "facebook" | "apple";
  providerUid: string;
  email?: string;
  name?: string;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface IdTokenClaims {
  sub?: string;
  email?: string;
  name?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  email_verified?: boolean | string;
}

interface JwkResponse {
  keys?: Array<CryptoJsonWebKey & { kid?: string; alg?: string }>;
}

@Injectable()
export class AuthService {
  private readonly jwksCache = new Map<
    string,
    { expiresAt: number; keys: JwkResponse["keys"] }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginWithGoogle(idToken: string) {
    const clientIds = this.configuredAudiences(
      "GOOGLE_CLIENT_IDS",
      "GOOGLE_CLIENT_ID",
    );
    const claims = await this.verifyIdToken(
      idToken,
      "https://www.googleapis.com/oauth2/v3/certs",
      clientIds,
      ["accounts.google.com", "https://accounts.google.com"],
    );
    if (
      !claims.sub ||
      !claims.email ||
      !this.isEmailVerified(claims.email_verified)
    ) {
      throw new UnauthorizedException("Google account email is not verified");
    }
    return this.completeLogin({
      provider: "google",
      providerUid: claims.sub,
      email: claims.email,
      name: claims.name,
    });
  }

  async loginWithFacebook(accessToken: string) {
    const appId = this.requiredConfig("FACEBOOK_APP_ID");
    const appSecret = this.requiredConfig("FACEBOOK_APP_SECRET");
    const appToken = `${appId}|${appSecret}`;
    const debug = await this.fetchJson<{
      data?: {
        is_valid?: boolean;
        app_id?: string;
        user_id?: string;
        expires_at?: number;
      };
    }>(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
    );

    if (
      !debug.data?.is_valid ||
      debug.data.app_id !== appId ||
      !debug.data.user_id
    ) {
      throw new UnauthorizedException("Invalid Facebook access token");
    }
    if (debug.data.expires_at && debug.data.expires_at * 1000 <= Date.now()) {
      throw new UnauthorizedException("Facebook access token has expired");
    }

    const profile = await this.fetchJson<{
      id?: string;
      email?: string;
      name?: string;
    }>(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!profile.id || profile.id !== debug.data.user_id || !profile.email) {
      throw new UnauthorizedException(
        "Facebook account did not provide a verified email",
      );
    }
    return this.completeLogin({
      provider: "facebook",
      providerUid: profile.id,
      email: profile.email,
      name: profile.name,
    });
  }

  async loginWithApple(identityToken: string) {
    const audiences = this.configuredAudiences(
      "APPLE_CLIENT_IDS",
      "APPLE_CLIENT_ID",
    );
    const claims = await this.verifyIdToken(
      identityToken,
      "https://appleid.apple.com/auth/keys",
      audiences,
      ["https://appleid.apple.com"],
    );
    if (!claims.sub)
      throw new UnauthorizedException("Apple identity token has no subject");
    return this.completeLogin({
      provider: "apple",
      providerUid: claims.sub,
      email: claims.email,
      name: claims.name,
    });
  }

  async deleteAccount(userId: string) {
    try {
      await this.prisma.user.delete({ where: { id: userId } });
    } catch (error) {
      if (this.isNotFoundError(error))
        throw new NotFoundException("User not found");
      throw error;
    }
  }

  async issueAccessToken(
    user: { id: string; email: string; role: string },
    twoFactorVerified: boolean,
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      twoFactorVerified,
    });
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
    };
  }

  private async completeLogin(identity: ProviderIdentity) {
    const normalizedEmail = identity.email?.trim().toLowerCase();
    const user = await this.prisma.$transaction(async (tx) => {
      const provider = await tx.authProvider.findUnique({
        where: {
          provider_providerUid: {
            provider: identity.provider,
            providerUid: identity.providerUid,
          },
        },
        include: { user: { include: { profile: true } } },
      });
      if (provider) return provider.user;
      if (!normalizedEmail) {
        throw new UnauthorizedException(
          "Email is required the first time this account signs in",
        );
      }

      let linkedUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        include: { profile: true },
      });
      if (!linkedUser) {
        linkedUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            profile: identity.name
              ? { create: { name: identity.name.trim() } }
              : undefined,
          },
          include: { profile: true },
        });
      }

      await tx.authProvider.create({
        data: {
          userId: linkedUser.id,
          provider: identity.provider,
          providerUid: identity.providerUid,
        },
      });
      if (identity.name && !linkedUser.profile?.name) {
        await tx.userProfile.upsert({
          where: { userId: linkedUser.id },
          create: { userId: linkedUser.id, name: identity.name.trim() },
          update: { name: identity.name.trim() },
        });
      }
      return linkedUser;
    });

    if (user.status !== "active")
      throw new UnauthorizedException("Account is not active");
    const privileged = user.role === "admin" || user.role === "content_editor";
    const token = await this.issueAccessToken(user, !privileged);
    return {
      ...token,
      twoFactorRequired: privileged,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        onboardingComplete: Boolean(user.profile?.name),
      },
    };
  }

  private async verifyIdToken(
    token: string,
    jwksUrl: string,
    acceptedAudiences: string[],
    acceptedIssuers: string[],
  ): Promise<IdTokenClaims> {
    const parts = token.split(".");
    if (parts.length !== 3)
      throw new UnauthorizedException("Malformed identity token");

    let header: JwtHeader;
    let claims: IdTokenClaims;
    try {
      header = JSON.parse(
        Buffer.from(parts[0], "base64url").toString("utf8"),
      ) as JwtHeader;
      claims = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8"),
      ) as IdTokenClaims;
    } catch {
      throw new UnauthorizedException("Malformed identity token");
    }
    if (header.alg !== "RS256" || !header.kid) {
      throw new UnauthorizedException("Unsupported identity token signature");
    }

    const keys = await this.getJwks(jwksUrl);
    const jwk = keys?.find(
      (candidate) =>
        candidate.kid === header.kid &&
        (!candidate.alg || candidate.alg === "RS256"),
    );
    if (!jwk)
      throw new UnauthorizedException(
        "Identity token signing key was not found",
      );

    const validSignature = verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    );
    const audience = Array.isArray(claims.aud)
      ? claims.aud
      : claims.aud
        ? [claims.aud]
        : [];
    const validAudience = audience.some((value) =>
      acceptedAudiences.includes(value),
    );
    if (
      !validSignature ||
      !claims.exp ||
      claims.exp * 1000 <= Date.now() ||
      !claims.iss ||
      !acceptedIssuers.includes(claims.iss) ||
      !validAudience
    ) {
      throw new UnauthorizedException("Invalid or expired identity token");
    }
    return claims;
  }

  private async getJwks(url: string) {
    const cached = this.jwksCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.keys;
    const result = await this.fetchJson<JwkResponse>(url);
    if (!result.keys?.length)
      throw new ServiceUnavailableException(
        "OAuth signing keys are unavailable",
      );
    this.jwksCache.set(url, {
      keys: result.keys,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    return result.keys;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new ServiceUnavailableException("OAuth provider is unavailable");
    }
    if (!response.ok)
      throw new UnauthorizedException("OAuth provider rejected the token");
    return response.json() as Promise<T>;
  }

  private configuredAudiences(...names: string[]) {
    const values = names.flatMap((name) =>
      (this.config.get<string>(name) ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (!values.length)
      throw new ServiceUnavailableException(
        `${names.join(" or ")} is not configured`,
      );
    return [...new Set(values)];
  }

  private requiredConfig(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value)
      throw new ServiceUnavailableException(`${name} is not configured`);
    return value;
  }

  private isEmailVerified(value: boolean | string | undefined) {
    return value === true || value === "true";
  }

  private isNotFoundError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    );
  }
}
