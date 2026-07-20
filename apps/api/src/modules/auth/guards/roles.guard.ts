import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@blansole/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Support both single role and array of roles
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    if (!userRoles.length || !userRoles[0]) {
      return false;
    }

    // Allow ADMIN to bypass, or check if user has required role
    return userRoles.includes(Role.ADMIN)
      || requiredRoles.some((role) => userRoles.includes(role));
  }
}
