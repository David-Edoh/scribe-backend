import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info, context) {
    if (err || !user) {
      const message = info?.message || err?.message || 'Unauthorized';
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
