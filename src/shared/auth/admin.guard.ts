import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma/prisma.service';
import { IS_ADMIN_KEY } from '../decorators/IsAdmin.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresAdmin = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiresAdmin) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.adminAuth) throw new ForbiddenException('User not authenticated');

    if (request.adminAuth.role === 'ADMIN') {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: request.adminAuth.sub },
      });
      if (admin && admin.active) return true;
      throw new ForbiddenException('Admin user not found or inactive');
    }
    throw new ForbiddenException('Admin access required');
  }
}
