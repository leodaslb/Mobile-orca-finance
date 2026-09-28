# Orca Finance Backend

Bootstrap técnico do monólito modular NestJS + Fastify + Prisma + PostgreSQL.
A migration inicial foi gerada em modo `--create-only` e ainda não foi aplicada.
Não contém funcionalidades de negócio ou seed.

## Preparação

Use Node.js 22.12+ da linha 22 (validado com 22.19.0) ou Node.js 24 e npm.

```powershell
npm ci
npm run prisma:generate
Copy-Item .env.example .env
```

Preencha `DATABASE_URL` com a URL do seu PostgreSQL e ajuste `PORT` (padrão 3000).
O exemplo mantém a URL vazia: nenhuma credencial real é fornecida ou criada.
Não versione `.env`. O Prisma CLI e `main.ts` carregam o ambiente com `dotenv`.

```powershell
npm run start:dev
```

`GET /health` retorna `{"status":"ok"}` e verifica somente a aplicação HTTP.
Não atesta disponibilidade do banco. O Prisma abre conexão sob demanda, na
primeira operação de persistência, e encerra o client no shutdown do Nest.
`DATABASE_URL` é obrigatória para iniciar a aplicação, mas não para formatar,
validar o schema ou gerar o client. Nenhum desses comandos modifica o banco.

## Comandos

| Comando | Finalidade |
|---|---|
| `npm run start` | Compilar e iniciar com Nest CLI |
| `npm run start:dev` | Desenvolvimento com watch |
| `npm run start:prod` | Executar o build de `dist/main.js` |
| `npm run build` | Compilar TypeScript |
| `npm run lint` | Verificar código, sem correções automáticas |
| `npm test` | Testes HTTP em memória usando Fastify inject |
| `npm run prisma:format` | Formatar o schema |
| `npm run prisma:validate` | Validar o schema |
| `npm run prisma:generate` | Gerar client em `src/generated/prisma` |

Após alterar o schema, gere novamente o client antes de build/test/start.
O código gerado e `dist` não são versionados. As versões exatas das dependências
e o lockfile permitem reproduzir a instalação com `npm ci`.

## Organização

```text
prisma/schema.prisma
prisma.config.ts
src/
  main.ts
  app.module.ts
  app.controller.ts
  common/configure-app.ts
  database/prisma.module.ts
  database/prisma.service.ts
test/bootstrap.spec.ts
```

Os módulos de negócio serão criados em `src/modules` quando implementados.
O `PrismaModule` exporta o service explicitamente, sem ser global. O helper de
configuração aplica o mesmo ValidationPipe ao bootstrap e aos testes.

## Modelo e rastreabilidade

A fonte oficial é `../docs/Orca_Finance_Modelo_de_Dados.md`. O schema mantém os
30 modelos físicos já descritos e usa os nomes de tabelas, colunas, índices e
constraints do SQL PostgreSQL de referência por `@map`, `@@map` e `map`.
Não implementa os comportamentos de negócio dessas entidades.

| Origem | US / RN | Representação estrutural |
|---|---|---|
| Decisão aprovada, sem RF original próprio | US60; RN-ID-01 a RN-ID-04 | Usuario, e-mail único e vínculo com perfil |
| RF11 | US18; RN-PERFIL-01/02, RN-ID-03 | PerfilFinanceiro, moeda BRL, sem saldo inicial |
| RF02 | US05; RN-CAT-01 | Categoria global, Subcategoria por perfil com `ativa` |
| RF01, RF21, RF36, RF58 | US01/02/03; RN-TRANS-02, RN-CAT-02 | Transacao, descrição, anotação, tags e método de pagamento |
| RF23, RF40 | US04/44; RN-AUD-01, RN-TRANS-03 | Auditoria nullable com SET NULL; filhos com CASCADE |
| RF20, RF64 | US24; RN-REC-01 | Chave única de recorrência + ocorrência |
| RF57 | US45; RN-ORC-05 | Cota única por perfil, ano e mês |
| RF04 | US10; RN-META-01/02 | Meta e AporteMeta separados de Transacao |

Nesta etapa a validação é estrutural (`prisma validate` e geração/compilação).
Os testes HTTP verificam health, transformação de DTO e rejeição de entradas
inválidas e campos desconhecidos. Não são testes das regras financeiras.
Ownership, auditoria transacional, valores positivos, regras condicionais e
unicidade de automação ativa serão implementados e testados nos Services.
Não se presume que FKs isoladamente garantam o isolamento entre perfis.

## Referências e decisões do bootstrap

- `../docs/schema.prisma` citado no pedido não estava presente. O schema foi
  criado a partir do modelo oficial e conferido com o SQL PostgreSQL.
- A arquitetura ainda cita `Orca_Finance_Modelo_de_Dados_Final.md`; o arquivo
  vigente é `Orca_Finance_Modelo_de_Dados.md`.
- A menção antiga a saldo inicial nas planilhas não foi transportada para o
  schema, conforme a decisão do usuário de seguir o modelo vigente.
- Prisma 7 usa `prisma.config.ts` para a URL e `@prisma/adapter-pg` para acesso
  ao PostgreSQL. O generator `prisma-client` usa `moduleFormat = "cjs"` para
  compilar junto da aplicação Nest em CommonJS.
- A referência de config usa `env("DATABASE_URL")`, que falha até em comandos
  sem conexão quando a variável está ausente. O bootstrap usa
  `process.env.DATABASE_URL`, suportado pelo Prisma, e exige a variável no
  PrismaService ao iniciar a aplicação. Não há fallback de conexão real.
- `@default(uuid())` gera IDs no Prisma. `@updatedAt` atualiza timestamps em
  escritas do ORM. SQL executado diretamente não recebe esses comportamentos.
- Nenhuma alteração foi feita nos documentos compartilhados. As referências
  e decisões acima devem ser incorporadas a `../docs/` na manutenção documental.

O PostgreSQL de desenvolvimento já foi configurado localmente. A próxima etapa
é revisar `prisma/migrations/20260928150948_init/migration.sql` e, somente
depois, decidir a aplicação da migration. Decisões abertas de autenticação,
anexos e demais domínios permanecem para suas respectivas implementações.

## Validação do bootstrap — 27/09/2026

| Verificação executada | Resultado |
|---|---|
| `npm run prisma:format` | Passou |
| `npm run prisma:validate` | Passou sem URL de banco |
| `npm run prisma:generate` | Passou, client 7.10.0 |
| `npm run build` | Passou |
| `npm run lint` | Passou |
| `npm test` | 1 suíte, 5 testes passaram |
| `npx tsc --noEmit` | Passou |
| Aplicação compilada + Fastify inject | GET /health retornou 200 |
| Comparação estática SQL/schema | 30 tabelas, 208 colunas; nomes, nulabilidade, tipos nativos e nomes de constraints conferidos |
| Campos das tabelas documentadas no modelo | 208 campos presentes nos 30 modelos |
| `git diff --check` | Não foi executado no bootstrap de 27/09; Git inicializado na raiz em 28/09 |

Na validação do bootstrap de 27/09, nenhum banco foi acessado. Em 28/09, o
banco local `orca_finance_dev` foi criado e a migration inicial foi gerada,
mas permanece pendente. Constraints ainda precisam ser validadas no
PostgreSQL após a aplicação da migration. O frontend e os documentos
compartilhados permaneceram intocados nesta etapa.

### Dependências: resultado real do npm audit

`npm audit --json` reportou 6 entradas vulneráveis (2 moderadas e 4 altas),
incluindo os pacotes afetados e seus dependentes:

- Fastify transitivo de `@nestjs/platform-fastify`: avisos de coerção na
  validação de schema e de cabeçalhos forwarded com trustProxy por saltos.
- `deepmerge-ts`, via `@prisma/config`/Prisma CLI: exaustão de pilha em merge
  de grafos recursivos.
- `mysql2`, transitivo do Prisma CLI: avisos de autenticação e descompressão.
  A aplicação usa exclusivamente o adapter PostgreSQL, não MySQL.

Não foi executado `npm audit fix --force`: o npm propôs alterações de versão
principal. Esses avisos permanecem abertos para revisão de compatibilidade de
dependências antes de publicar a aplicação. O npm também avisou que ESLint 9
e algumas dependências transitivas de teste estão descontinuados.
