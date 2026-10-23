import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../prisma.service';
import { UserModel } from '../models/user.model';

function hashpw(p: string) {
  return createHash('sha256').update(p).digest('hex');
}

function generateVerificationToken() {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, password: string, displayName?: string): Promise<UserModel | null> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return null;
    const passwordHash = hashpw(password);
    const verificationToken = generateVerificationToken();
    const user = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name: displayName,
        emailVerificationToken: verificationToken,
        emailVerificationSentAt: new Date(),
      },
    });
    const mapped = {
      id: user.id,
      email: user.email,
      displayName: user.name,
      emailVerificationToken: verificationToken,
    };
    return plainToInstance(UserModel, mapped);
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    // Map DB shape to existing service expectations
    const mapped = {
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      displayName: user.name,
      emailVerified: user.emailVerified,
      emailVerificationToken: user.emailVerificationToken,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return plainToInstance(UserModel, mapped);
  }

  async findById(id: string): Promise<UserModel | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    const mapped = {
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      displayName: user.name,
      emailVerified: user.emailVerified,
      emailVerificationToken: user.emailVerificationToken,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return plainToInstance(UserModel, mapped);
  }

  async verifyEmail(token: string): Promise<(UserModel & { alreadyVerified?: boolean }) | null> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    // If no user found by token, the token may already have been consumed
    // (e.g. a double-submit from the frontend). Return null so the caller
    // can decide how to handle it.
    if (!user) return null;

    // Check if email is already verified (token was consumed by a prior call)
    if (user.emailVerified) {
      const mapped = {
        id: user.id,
        email: user.email,
        displayName: user.name,
        emailVerified: user.emailVerified,
      };
      const modelInstance = plainToInstance(UserModel, mapped);
      return Object.assign(modelInstance, { alreadyVerified: true });
    }

    // Check if token is still valid (within 24 hours)
    if (!user.emailVerificationSentAt) return null;

    const tokenAge = Date.now() - user.emailVerificationSentAt.getTime();
    const tokenExpirationTime = 24 * 60 * 60 * 1000; // 24 hours

    if (tokenAge > tokenExpirationTime) {
      return null;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationSentAt: null,
      },
    });

    const mapped = {
      id: updatedUser.id,
      email: updatedUser.email,
      displayName: updatedUser.name,
      emailVerified: updatedUser.emailVerified,
    };
    return plainToInstance(UserModel, mapped);
  }

  async resendVerificationEmail(userId: string): Promise<UserModel> {
    const verificationToken = generateVerificationToken();
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationSentAt: new Date(),
      },
    });
    const mapped = {
      id: user.id,
      email: user.email,
      displayName: user.name,
      emailVerificationToken: verificationToken,
    };
    return plainToInstance(UserModel, mapped);
  }
}
