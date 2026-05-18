import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (!admin || !admin.active) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, admin.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        siteAccess: admin.siteAccess,
      },
    };
  }

  async me(userId: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!admin) throw new UnauthorizedException('User not found');
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      siteAccess: admin.siteAccess,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!admin) throw new UnauthorizedException('User not found');

    const ok = await bcrypt.compare(dto.currentPassword, admin.password);
    if (!ok) throw new BadRequestException('Current password incorrect');

    const password = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.adminUser.update({ where: { id: userId }, data: { password } });
    return { ok: true };
  }
}
