import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { UsersRepository } from '../users/users.repository';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: { sub?: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub?: string }>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (typeof payload.sub !== 'string' || !isUUID(payload.sub) || !(await this.users.findById(payload.sub))) {
      throw new UnauthorizedException();
    }
    request.user = { id: payload.sub };
    return true;
  }
}
