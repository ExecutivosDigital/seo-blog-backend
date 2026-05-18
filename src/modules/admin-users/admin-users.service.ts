import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

const PUBLIC_SELECT: Prisma.AdminUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  siteAccess: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_SELECT,
    });
  }

  async get(id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('Admin not found');
    return user;
  }

  async create(dto: CreateAdminUserDto) {
    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.adminUser.create({
      data: {
        email: dto.email,
        password,
        name: dto.name,
        role: dto.role ?? AdminRole.EDITOR,
        siteAccess: dto.siteAccess ?? [],
        active: dto.active ?? true,
      },
      select: PUBLIC_SELECT,
    });
  }

  update(id: string, dto: UpdateAdminUserDto) {
    return this.prisma.adminUser.update({
      where: { id },
      data: dto,
      select: PUBLIC_SELECT,
    });
  }

  async resetPassword(id: string, newPassword: string) {
    const password = await bcrypt.hash(newPassword, 10);
    await this.prisma.adminUser.update({ where: { id }, data: { password } });
    return { ok: true };
  }

  remove(id: string) {
    return this.prisma.adminUser.delete({ where: { id }, select: PUBLIC_SELECT });
  }
}
