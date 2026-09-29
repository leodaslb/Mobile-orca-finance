# Orca Finance Backend

API NestJS + Fastify + Prisma + PostgreSQL do Orca Finance. A migration inicial
está aplicada no banco local de desenvolvimento. O seed contém somente o catálogo
global de categorias principais. Esta versão implementa conta, login, perfis,
subcategorias e o núcleo manual de transações.

## Preparação

Use Node.js 22.12+ da linha 22 (validado com 22.19.0) ou Node.js 24 e npm.

```powershell
npm ci
npm run prisma:generate
Copy-Item .env.example .env
```

Preencha `DATABASE_URL` com a URL do seu PostgreSQL, configure `JWT_SECRET` com um
segredo local forte e ajuste `PORT` (padrão 3000). `JWT_EXPIRES_IN` é o prazo do
access token em segundos; o exemplo usa `3600` (uma hora).
O exemplo mantém a URL vazia: nenhuma credencial real é fornecida ou criada.
Não versione `.env`. O Prisma CLI e `main.ts` carregam o ambiente com `dotenv`.
Sem `JWT_SECRET` ou `JWT_EXPIRES_IN` válidos, a aplicação falha ao iniciar.

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
| `npm run test:e2e` | Fluxo HTTP com PostgreSQL local; limpa somente registros criados pelo teste |
| `npm run prisma:format` | Formatar o schema |
| `npm run prisma:validate` | Validar o schema |
| `npm run prisma:generate` | Gerar client em `src/generated/prisma` |
| `npx prisma db seed` | Gerar client, compilar e inserir/atualizar as categorias globais |

Após alterar o schema, gere novamente o client antes de build/test/start.
O código gerado e `dist` não são versionados. As versões exatas das dependências
e o lockfile permitem reproduzir a instalação com `npm ci`.
O seed usa os sete nomes de `../docs/Orca_Finance_Catalogo_Categorias.md`,
sem criar subcategorias, usuários ou dados de demonstração. Pode ser executado
novamente sem duplicar categorias; categorias já existentes são identificadas
pelo nome e têm apenas `ordem` e `ativa` atualizadas. `icone` e `cor` ficam
nulos até que seus valores persistidos sejam definidos.

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
  modules/auth/
  modules/users/
  modules/profiles/
  modules/categories/
  modules/transactions/
test/bootstrap.spec.ts
test/foundation.spec.ts
test/foundation.e2e.ts
test/transactions.spec.ts
```

Controllers cuidam de HTTP/DTOs; Services validam regras e ownership; Repositories
usam Prisma. O `PrismaModule` exporta o service explicitamente, sem ser global.
O helper de configuração aplica o mesmo ValidationPipe ao bootstrap e aos testes.

## API desta etapa

| Método | Rota | Acesso |
|---|---|---|
| POST | `/auth/register` | Público; cria conta e primeiro perfil em uma transação |
| POST | `/auth/login` | Público; retorna `accessToken` e `tokenType` |
| GET | `/me` | Bearer token |
| GET, POST | `/profiles` | Bearer token; somente perfis da conta |
| GET, PATCH | `/profiles/:profileId` | Bearer token; exige ownership |
| GET | `/categories` | Bearer token; lê catálogo global ativo |
| GET, POST | `/profiles/:profileId/subcategories` | Bearer token; exige ownership |
| PATCH | `/profiles/:profileId/subcategories/:subcategoryId` | Bearer token; permite `nome` e `ativa` |
| POST, GET | `/profiles/:profileId/transactions` | Bearer token; cria ou lista somente no perfil autorizado |
| GET, PATCH | `/profiles/:profileId/transactions/:transactionId` | Bearer token; detalhe ou edição no perfil autorizado |

O cadastro aceita `nome`, `email` e `senha`; o login aceita `email` e `senha`.
O cadastro devolve `user` e `profile`, sem hash de senha. `GET /me` devolve somente
`id`, `nome`, `email`, `createdAt` e `updatedAt`. Subcategorias não possuem rota de
exclusão física. Perfis novos começam em BRL e sem movimentações; saldo não é
persistido. A comparação de e-mail ainda é case-sensitive, conforme a unicidade
atual do banco; a política de normalização permanece decisão pendente.

### Transações manuais

`POST /profiles/:profileId/transactions` exige `tipo`, `valor`, `dataHora`,
`descricao` e `status`. `valor` é string decimal, por exemplo `"15.75"`, com até
duas casas; a resposta também usa string com duas casas. `dataHora` é um instante
ISO 8601 com `Z` ou offset, por exemplo `"2026-09-29T15:30:00-03:00"`; a resposta
é normalizada para UTC. `tipo` aceita `RECEITA` ou `DESPESA`; `status` aceita
`EFETIVADA` ou `PREVISTA`. `essencialidade` usa `NAO_CLASSIFICADA` por padrão e
`ehGastoLivre` usa `false` por padrão.

Categoria é obrigatória no cadastro manual comum. Somente uma `DESPESA` marcada
explicitamente com `ehGastoLivre: true` pode ficar sem categoria. Quando houver
`subcategoriaId`, ela precisa estar ativa e pertencer ao mesmo perfil e categoria.
`anotacao` é opcional e distinta de `descricao`. Método de pagamento é opcional
e usa o enum do schema. `PATCH` aceita os mesmos campos manuais, revalidando o
estado final; `null` pode limpar anotação, categoria, subcategoria e método de
pagamento quando o resultado respeitar as regras. Não existe `DELETE` nesta etapa.

`GET /profiles/:profileId/transactions` aceita filtros `dataInicial`, `dataFinal`
(instantes ISO 8601 inclusivos), `tipo`, `categoriaId`, `metodoPagamento`,
`status`, `descricao` (trecho da descrição, sem diferenciar maiúsculas/minúsculas)
e `valor` (igualdade decimal). A ordenação técnica é `dataHora` decrescente e,
em empate, `id` decrescente. Não há paginação nesta primeira versão.
Recorrência, câmbio, localização, auditoria e reversão não são expostos nesse CRUD.

## Modelo e rastreabilidade

A fonte oficial é `../docs/Orca_Finance_Modelo_de_Dados.md`. O schema mantém os
30 modelos físicos já descritos e usa os nomes de tabelas, colunas, índices e
constraints do SQL PostgreSQL de referência por `@map`, `@@map` e `map`.
O schema por si só não implementa regras de negócio; as regras desta etapa estão
nos Services de conta, perfil, categoria e transação.

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

Os testes cobrem o fluxo real HTTP → PostgreSQL para conta, login, ownership,
catálogo, subcategorias e transações manuais. Auditoria e orçamento continuam
fora do escopo. Não se presume que FKs isoladamente garantam o isolamento entre
perfis.

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

O PostgreSQL de desenvolvimento está configurado localmente e a migration inicial
foi aplicada. A estratégia atual de autenticação usa somente access token JWT;
refresh, revogação e recuperação de conta permanecem fora desta versão.

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

Esta tabela registra apenas a validação histórica do bootstrap em 27/09. A
migration foi aplicada e suas constraints foram validadas posteriormente.

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
