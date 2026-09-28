# Orca Finance

Projeto acadêmico da FATEC para gestão financeira pessoal. O aplicativo Android
é desenvolvido com React Native, Expo, Expo Router e TypeScript. A API usa
NestJS, Fastify, Prisma e PostgreSQL. O desenvolvimento segue os requisitos e
as regras de negócio consolidadas em [`docs/`](docs/).

## Estado atual

- O aplicativo mobile possui telas e fluxos em desenvolvimento, alimentados por
  services e dados mockados. A integração REST com a API ainda não substituiu
  esses mocks.
- O backend possui o bootstrap técnico, validação global, Prisma e o endpoint
  `GET /health`. Ainda não há endpoints financeiros ou autenticação remota real.
- A migration inicial está em
  [`backend/prisma/migrations/20260928150948_init/migration.sql`](backend/prisma/migrations/20260928150948_init/migration.sql).
  Foi gerada com `--create-only` e **ainda não foi aplicada**. O SQL aguarda
  revisão manual antes da próxima etapa.

## Organização

```text
projeto/
├── AGENTS.md                 instruções comuns
├── docs/                     requisitos, backlog, RN e arquiteturas
├── backend/                  API NestJS e schema Prisma
│   ├── AGENTS.md
│   ├── prisma/
│   └── src/
└── orca-finance/             aplicativo Expo
    ├── AGENTS.md
    ├── references/            imagens de referência das telas
    ├── scripts/               verificações do mobile
    └── src/
```

O app consome services que atualmente leem mocks. A integração prevista é
`app → REST/JSON → backend → PostgreSQL`. Dados financeiros são isolados por
perfil; o backend deve validar a propriedade do perfil em cada operação.

## Requisitos para desenvolvimento

- Node.js e npm. O backend foi validado com Node.js 22.19.0 e aceita a linha
  22.12+ ou 24; confira as versões em [`backend/package.json`](backend/package.json).
- Android Emulator para validar o app na plataforma prioritária.
- PostgreSQL para a futura persistência. A instalação local usada no
  desenvolvimento é PostgreSQL 18; configure sua própria conexão.

Cada projeto tem dependências e comandos próprios. Execute os comandos dentro
de sua pasta, sem criar um `package.json` na raiz.

### Aplicativo mobile

```powershell
cd orca-finance
npm ci
npm run android
```

O Expo Web pode apoiar o desenvolvimento, mas a validação visual final é no
Android Emulator. Consulte também o
[`AGENTS.md` do mobile](orca-finance/AGENTS.md).

### Backend

```powershell
cd backend
npm ci
npm run prisma:generate
Copy-Item .env.example .env
```

No `.env` local, preencha `DATABASE_URL` com a conexão PostgreSQL de
desenvolvimento e ajuste `PORT` se necessário. Não publique credenciais.
Depois, inicie a API:

```powershell
npm run start:dev
```

`GET /health` responde `{"status":"ok"}` quando a aplicação HTTP está no ar;
esse endpoint não verifica o banco. A configuração, os scripts e o estágio da
migration estão descritos no [`README` do backend](backend/README.md).

## Verificações

No backend: `npm run build`, `npm run lint`, `npm test` e
`npm run prisma:validate`. No mobile: `npx tsc --noEmit` e os scripts
`verify-*.cjs` de [`orca-finance/scripts/`](orca-finance/scripts/)
relacionados à área alterada. Execute `git diff --check` antes de registrar
mudanças. Testes que dependem de PostgreSQL aplicado só farão sentido após a
revisão e aplicação da migration.

## Documentação de referência

| Assunto | Fonte |
|---|---|
| Requisitos | [`RequisitosMobile.txt`](docs/RequisitosMobile.txt) |
| RF e User Stories | [`Backlog revisado`](docs/Orca_Finance_Backlog_Revisado_Final_RF_US.xlsx) |
| Regras de negócio | [`RN consolidadas`](docs/Orca_Finance_Regras_de_Negocio_Revisadas_Consolidada_ok.xlsx) |
| Modelo de dados | [`Orca_Finance_Modelo_de_Dados.md`](docs/Orca_Finance_Modelo_de_Dados.md) |
| Arquitetura backend | [`Orca_Finance_Arquitetura_Backend.md`](docs/Orca_Finance_Arquitetura_Backend.md) |
| Arquitetura frontend | [`Orca_Finance_Arquitetura_Frontend.md`](docs/Orca_Finance_Arquitetura_Frontend.md) |

Antes de implementar uma funcionalidade, confira a cadeia
**RF → User Story → RN → implementação → teste** e as instruções da raiz e da
pasta afetada. O modelo de dados é a referência oficial para o schema e para
a persistência. Decisões ainda abertas não devem ser preenchidas por suposição.
