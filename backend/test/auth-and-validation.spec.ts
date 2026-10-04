import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../src/modules/auth/auth.types';
import { RegisterDto } from '../src/modules/auth/dto/register.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { CreateProfileDto } from '../src/modules/profiles/dto/create-profile.dto';
import { UpdateProfileDto } from '../src/modules/profiles/dto/update-profile.dto';
import { CreateSubcategoryDto } from '../src/modules/categories/dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from '../src/modules/categories/dto/update-subcategory.dto';

describe('JwtAuthGuard', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const verifyAsync = jest.fn();
  const findById = jest.fn();
  let guard: JwtAuthGuard;
  let request: AuthenticatedRequest;
  let context: ExecutionContext;

  beforeEach(() => {
    verifyAsync.mockReset().mockResolvedValue({ sub: userId });
    findById.mockReset().mockResolvedValue({ id: userId });
    guard = new JwtAuthGuard({ verifyAsync } as unknown as JwtService,
      { findById } as unknown as UsersRepository);
    request = { headers: { authorization: 'Bearer token' } } as AuthenticatedRequest;
    context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
  });

  it('recusa token ausente antes de consultar o banco', async () => {
    delete request.headers.authorization;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each(['inválido', 'expirado'])('recusa token %s', async () => {
    verifyAsync.mockRejectedValue(new Error('verificação JWT falhou'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([{}, { sub: 'inválido' }])('recusa identidade inválida: %j', async (payload) => {
    verifyAsync.mockResolvedValue(payload);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('recusa usuário inexistente', async () => {
    findById.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('preserva erro de infraestrutura em vez de converter para 401', async () => {
    const error = new Error('conexão indisponível');
    findById.mockRejectedValue(error);
    await expect(guard.canActivate(context)).rejects.toBe(error);
  });

  it('identifica usuário com token válido', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: userId });
  });
});

describe('Nomes obrigatórios', () => {
  it.each([
    [RegisterDto, { email: 'teste@example.test', senha: 'senha' }],
    [CreateProfileDto, {}], [UpdateProfileDto, {}],
    [CreateSubcategoryDto, { categoriaId: '123e4567-e89b-12d3-a456-426614174000' }],
    [UpdateSubcategoryDto, {}],
  ])('rejeita espaços sem normalizar nomes válidos em %p', (Dto, fields) => {
    expect(validateSync(plainToInstance<{ nome?: string }, object>(Dto, { ...fields, nome: ' \t\n ' })))
      .toEqual(expect.arrayContaining([expect.objectContaining({ property: 'nome' })]));
    const valid = plainToInstance<{ nome?: string }, object>(Dto, { ...fields, nome: ' Nome válido ' });
    expect(validateSync(valid)).toHaveLength(0);
    expect(valid.nome).toBe(' Nome válido ');
  });
});
