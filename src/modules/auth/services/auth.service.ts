import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/services/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { EmailService } from '../../../common/services/email.service';
import { createHash } from 'crypto';

function hashpw(p: string) {
  return createHash('sha256').update(p).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const created = await this.users.create(
      dto.email,
      dto.password,
      dto.displayName,
    );
    if (!created) throw new UnauthorizedException('User exists');

    // Send verification email
    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/verify-email?token=${created.emailVerificationToken}`;

    try {
      await this.emailService.sendVerificationEmail(
        created.email,
        verificationLink,
        created.displayName || undefined,
      );
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Continue with registration even if email fails
    }

    // Return user info without token - user needs to verify email first
    return {
      user: {
        id: created.id,
        email: created.email,
        displayName: created.displayName,
      },
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = user.passwordHash === hashpw(dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // Check if email is verified
    if (!user.emailVerified) {
      return {
        emailVerified: false,
        userId: user.id,
        email: user.email,
        message: 'Please verify your email before logging in.',
      };
    }

    const publicUser = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return { user: publicUser, token, emailVerified: true };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.users.verifyEmail(token);
    if (!user) {
      throw new BadRequestException(
        'Invalid or expired verification token. Please request a new one.',
      );
    }

    // Generate JWT token after successful verification (including already-verified case)
    const jwtToken = this.jwt.sign({ sub: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      token: jwtToken,
      message: 'Email verified successfully!',
    };
  }


  async getVerificationStatus(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return { verified: user.emailVerified };
  }

  async resendVerificationEmail(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    const userWithToken = await this.users.resendVerificationEmail(userId);

    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/verify-email?token=${userWithToken.emailVerificationToken}`;

    try {
      await this.emailService.sendVerificationEmail(
        userWithToken.email,
        verificationLink,
        userWithToken.displayName || undefined,
      );
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      throw new BadRequestException(
        'Failed to send verification email. Please try again.',
      );
    }

    return {
      message: 'Verification email sent successfully. Please check your inbox.',
      email: userWithToken.email,
    };
  }
}
