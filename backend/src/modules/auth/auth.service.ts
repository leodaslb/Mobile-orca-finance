import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '../../generated/prisma/client';
import { UsersRepository } from '../users/users.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (bcrypt.truncates(dto.senha)) {
      throw new BadRequestException('Senha excede o tamanho aceito pelo algoritmo de hash.');
    }
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);
    try {
      const { user, profile } = await this.users.createWithFirstProfile(dto.nome, dto.email, senhaHash);
      return {
        user: { id: user.id, nome: user.nome, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt },
        profile: { id: profile.id, nome: profile.nome, moedaBase: profile.moedaBase, createdAt: profile.createdAt, updatedAt: profile.updatedAt },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.senha, user.senhaHash))) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), tokenType: 'Bearer' };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return { id: user.id, nome: user.nome, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt };
  }
}
