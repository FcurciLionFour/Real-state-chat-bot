import { UserRole } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
  iat: number;
  exp: number;
};
