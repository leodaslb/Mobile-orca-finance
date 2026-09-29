import { ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/database/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CategoriesRepository } from '../src/modules/categories/categories.repository';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { ProfilesRepository } from '../src/modules/profiles/profiles.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { UsersRepository } from '../src/modules/users/users.repository';

describe('Regras da fundação funcional', () => {
  it('recusa e-mail duplicado antes de criar usuário ou perfil', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue({ id: 'existente' }),
      createWithFirstProfile: jest.fn(),
    } as unknown as UsersRepository;
    const auth = new AuthService(users, {} as JwtService);
    await expect(auth.register({ nome: 'Nome', email: 'ja@example.test', senha: 'senha' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(users.createWithFirstProfile).not.toHaveBeenCalled();
  });

  it('executa criação de usuário e perfil dentro da mesma transação', async () => {
    const tx = {
      usuario: { create: jest.fn().mockResolvedValue({ id: 'usuario' }) },
      perfilFinanceiro: { create: jest.fn().mockRejectedValue(new Error('falha no perfil')) },
    };
    const transaction = jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const users = new UsersRepository({ $transaction: transaction } as unknown as PrismaService);
    await expect(users.createWithFirstProfile('Nome', 'email@example.test', 'hash'))
      .rejects.toThrow('falha no perfil');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.usuario.create).toHaveBeenCalledTimes(1);
    expect(tx.perfilFinanceiro.create).toHaveBeenCalledTimes(1);
  });

  it('bloqueia acesso a perfil de outro usuário', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({ id: 'perfil', usuarioId: 'dono' }),
    } as unknown as ProfilesRepository;
    const profiles = new ProfilesService(repository);
    await expect(profiles.assertOwnership('intruso', 'perfil'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida ownership antes de acessar subcategorias', async () => {
    const repository = { listSubcategories: jest.fn() } as unknown as CategoriesRepository;
    const profiles = {
      assertOwnership: jest.fn().mockRejectedValue(new ForbiddenException()),
    } as unknown as ProfilesService;
    const categories = new CategoriesService(repository, profiles);
    await expect(categories.listSubcategories('intruso', 'perfil'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.listSubcategories).not.toHaveBeenCalled();
  });
});
