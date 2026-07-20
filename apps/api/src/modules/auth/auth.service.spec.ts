import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync, sign } from 'node:crypto';
import { AuthService } from './auth.service';

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('AuthService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('verifies a Google id token, links the provider, and returns an app JWT', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' });
    const header = encode({ alg: 'RS256', kid: 'google-key-1' });
    const payload = encode({
      sub: 'google-user-1',
      email: 'USER@Example.com',
      email_verified: true,
      name: 'Test User',
      aud: 'mobile-client-id',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    const token = `${header}.${payload}.${signature}`;
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      keys: [{ ...jwk, kid: 'google-key-1', alg: 'RS256' }],
    }), { status: 200 }));

    const createdUser = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
      status: 'active',
      profile: null,
    };
    const tx = {
      authProvider: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(createdUser) },
      userProfile: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const config = new ConfigService({ GOOGLE_CLIENT_ID: 'mobile-client-id', JWT_ACCESS_TTL: '15m' });
    const service = new AuthService(prisma as any, new JwtService({ secret: 'test-secret' }), config);

    const result = await service.loginWithGoogle(token);

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user.email).toBe('user@example.com');
    expect(tx.authProvider.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ provider: 'google', providerUid: 'google-user-1', userId: 'user-1' }),
    });
  });

  it('rejects a correctly signed token for another audience', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' });
    const header = encode({ alg: 'RS256', kid: 'key-1' });
    const payload = encode({
      sub: 'google-user-1', email: 'user@example.com', email_verified: true,
      aud: 'wrong-client', iss: 'accounts.google.com', exp: Math.floor(Date.now() / 1000) + 300,
    });
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      keys: [{ ...jwk, kid: 'key-1', alg: 'RS256' }],
    }), { status: 200 }));
    const service = new AuthService(
      {} as any,
      new JwtService({ secret: 'test-secret' }),
      new ConfigService({ GOOGLE_CLIENT_ID: 'expected-client' }),
    );

    await expect(service.loginWithGoogle(`${header}.${payload}.${signature}`)).rejects.toThrow('Invalid or expired identity token');
  });
});
