import { JwtService } from "@nestjs/jwt";
import { Role } from "@blansole/shared";
import * as supertest from "supertest";

export const getTestJwtSecret = () =>
  process.env.JWT_ACCESS_SECRET ?? "CHANGE_ME_DEV_ACCESS_SECRET";

function requestWithRole(server: Parameters<typeof supertest>[0], role: Role) {
  const jwt = new JwtService({ secret: getTestJwtSecret() });
  const token = jwt.sign({
    sub: `${role}-test-user`,
    email: `${role}@example.com`,
    role,
    twoFactorVerified: role === Role.ADMIN || role === Role.CONTENT_EDITOR,
  });
  const authenticated = (test: supertest.Test) =>
    test.set("Authorization", `Bearer ${token}`);

  return {
    get: (path: string) => authenticated(supertest(server).get(path)),
    post: (path: string) => authenticated(supertest(server).post(path)),
    put: (path: string) => authenticated(supertest(server).put(path)),
    delete: (path: string) => authenticated(supertest(server).delete(path)),
    patch: (path: string) => authenticated(supertest(server).patch(path)),
  };
}

export const authenticatedRequest = (server: Parameters<typeof supertest>[0]) =>
  requestWithRole(server, Role.USER);

export const adminRequest = (server: Parameters<typeof supertest>[0]) =>
  requestWithRole(server, Role.ADMIN);
