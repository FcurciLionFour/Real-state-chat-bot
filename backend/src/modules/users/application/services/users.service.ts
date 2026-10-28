import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../../infrastructure/repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string) {
    return this.usersRepository.findById(id);
  }

  findByEmail(email: string) {
    return this.usersRepository.findByEmail(this.normalizeEmail(email));
  }

  createUser(email: string, passwordHash: string | null) {
    return this.usersRepository.create(this.normalizeEmail(email), passwordHash);
  }

  async getOrCreateDevelopmentUser(email?: string) {
    const normalizedEmail = this.normalizeEmail(email || 'demo@local.test');
    const existingUser = await this.usersRepository.findByEmail(normalizedEmail);

    if (existingUser) {
      return existingUser;
    }

    return this.usersRepository.createDevelopmentUser(normalizedEmail);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
