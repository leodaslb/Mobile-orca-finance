# Orça Finance

Aplicativo mobile acadêmico de finanças pessoais, desenvolvido no contexto da FATEC, com foco em organização financeira, planejamento e acompanhamento. O projeto reúne registro de receitas e despesas, orçamento, metas de economia e visualização da situação financeira do usuário.

O aplicativo Android e a API são aplicações independentes, integradas por REST/JSON. Os dados financeiros são organizados por perfil, com autenticação e validação de acesso no backend.

## Estrutura do projeto

```text
Mobile-orca-finance/
├── orca-finance/     # Aplicativo mobile React Native / Expo
├── backend/          # API NestJS
└── README.md
```

## Sprint 1 — Backlog



| US | User Story | Prioridade |
| --- | --- | --- |
| US01 | Como usuário, quero registrar manualmente receitas e despesas com valor, data, hora, descrição e categoria para manter meu histórico financeiro atualizado. | Alta |
| US02 | Como usuário, quero complementar minhas transações com tags, anotações, método de pagamento e classificações aplicáveis para organizá-las e analisá-las com mais contexto. | Alta |
| US03 | Como usuário, quero buscar e filtrar transações por data, categoria, descrição, valor e método de pagamento para localizar registros específicos com rapidez. | Alta |
| US05 | Como usuário, quero criar subcategorias personalizadas dentro das categorias principais para organizar meus gastos com mais precisão. | Alta |
| US06 | Como usuário, quero definir limites mensais por categoria, inclusive para gastos com serviços digitais, e visualizar alertas ao me aproximar ou exceder esses limites para controlar meu orçamento. | Alta |
| US10 | Como usuário, quero criar e acompanhar metas de economia com valor-alvo, data-limite e sugestão de economia diária ou semanal para planejar meus objetivos financeiros. | Alta |
| US12 | Como usuário, quero usar mecanismos de reflexão antes de comprar, incluindo período de espera e pergunta ao registrar uma compra não essencial, para reduzir decisões impulsivas. | Alta |
| US13 | Como usuário, quero visualizar gráficos de gastos por categoria e período para compreender a distribuição das minhas despesas. | Alta |
| US14 | Como usuário, quero exportar meus dados financeiros em CSV e em formato compatível com Excel para analisá-los externamente ou manter uma cópia das informações. | Média |
| US15 | Como usuário, quero visualizar saldo, gastos do mês, progresso das metas e comparação com o mês anterior em um painel para entender rapidamente minha situação financeira. | Alta |
| US19 | Como usuário, quero anexar uma foto do recibo ao registrar uma despesa usando a câmera do dispositivo para manter um comprovante associado à transação. | Média |
| US24 | Como usuário, quero configurar receitas e despesas recorrentes e lembretes de vencimento associados a transações futuras para automatizar lançamentos e evitar atrasos. | Alta |
| US29 | Como usuário, quero definir limite diário e limites por categoria, escolhendo os canais de alerta aplicáveis, para ser avisado quando meus gastos atingirem os valores definidos. | Alta |
| US37 | Como usuário, quero proteger o acesso local ao aplicativo por biometria ou PIN para manter meus dados financeiros seguros. | Alta |
| US40 | Como usuário, quero comparar o orçamento planejado com os gastos realizados para identificar desvios e as categorias que mais contribuíram para eles. | Alta |
| US44 | Como usuário, quero reverter uma transação registrada por engano sem manter seu efeito nos cálculos, preservando a rastreabilidade da exclusão para corrigir meu histórico com segurança. | Alta |
| US45 | Como usuário, quero definir uma cota mensal de gastos livres sem categorização para manter flexibilidade dentro do meu planejamento. | Média |
| US60 | Como usuário, quero criar uma conta e me autenticar no aplicativo para acessar de forma segura meus perfis e dados financeiros. | Alta |

## Principais tecnologias

**Mobile**

- React Native
- Expo
- TypeScript
- Expo Router

**Backend**

- Node.js
- TypeScript
- NestJS
- Fastify
- Prisma ORM
- Cloudinary para armazenamento de recibos

**Banco de dados**

- PostgreSQL / Neon

## Fluxo da aplicação / arquitetura

```text
Aplicativo Android
      ↓ REST/JSON
API NestJS
      ↓ Prisma
PostgreSQL
```

No frontend:

```text
Screen / Hook
      ↓
Service
      ↓
API
```

O mobile concentra interface e interação; a API valida autenticação, acesso por perfil e regras de negócio, e persiste os dados.

## Como executar

Utilize Node.js 22.12+ da linha 22 ou Node.js 24, npm e um dispositivo Android ou emulador. Cada aplicação possui suas próprias dependências.

### Backend

```powershell
cd backend
npm ci
# Copie apenas se ainda nao houver um .env local
Copy-Item .env.example .env
```

Preencha `DATABASE_URL` com a conexão PostgreSQL/Neon, `JWT_SECRET` com um segredo privado e `JWT_EXPIRES_IN` com a duração do token em segundos. `PORT` define a porta da API (padrão `3000`). Para upload de recibos, configure também `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`.

```powershell
npm run prisma:generate
# Preparacao de um banco novo: migrations existentes e catalogo de categorias
npx prisma migrate deploy
npm run seed
npm run start:dev
```

A API escuta em `0.0.0.0`. A rota `http://localhost:3000/health` permite verificar o serviço HTTP; ela não verifica a conexão com o banco. Em banco já preparado, não é necessário repetir a preparação inicial.

### Frontend

Em outro terminal:

```powershell
cd orca-finance
npm ci
# Copie apenas se ainda nao houver um .env local
Copy-Item .env.example .env
```

Configure `EXPO_PUBLIC_API_URL` com a URL da API:

- Android Emulator: `http://10.0.2.2:3000`.
- Celular físico: `http://<IP-do-computador-na-rede>:3000`, com celular e computador na mesma rede e a porta acessível.

```powershell
npx expo start
```

Abra o app pelo Expo Go compatível ou pressione `a` para usar o emulador Android. Reinicie o Expo após mudar a URL; em APK, a URL faz parte do build e exige uma nova geração do aplicativo.
