import { UserRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAdminUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
