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

<details>
<summary>Ver backlog da Sprint 1 (18 User Stories)</summary>

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

</details>

## Sprint 2 — Backlog

A Sprint 2 amplia as funcionalidades de planejamento e análise financeira, incluindo novos tipos de orçamento, múltiplos perfis, importação de transações, simulações, automações, projeções, desafios e notificações push.

| US | User Story | Prioridade |
| --- | --- | --- |
| US04 | Como usuário, quero consultar o histórico de alterações e exclusões de uma transação para compreender o que foi modificado ao longo do tempo. | Média |
| US07 | Como usuário, quero criar orçamentos com períodos flexíveis e temporários, inclusive vinculados a eventos, para planejar gastos fora do ciclo mensal padrão. | Média |
| US09 | Como usuário, quero distribuir a renda do período entre categorias em um orçamento zero para dar destino a todo o valor planejado. | Média |
| US16 | Como usuário, quero receber lembretes push para registrar transações possivelmente esquecidas, com base no meu histórico de gastos ou em horários predefinidos, para reduzir omissões no controle financeiro. | Média |
| US18 | Como usuário, quero manter e alternar entre perfis financeiros separados para administrar diferentes contextos de finanças. | Média |
| US20 | Como usuário, quero criar regras explícitas de automação para classificar atributos das transações e reduzir tarefas repetitivas. | Média |
| US21 | Como usuário, quero sincronizar meus dados financeiros entre dispositivos para acessar informações consistentes em diferentes aparelhos. | Média |
| US25 | Como usuário, quero visualizar taxa de poupança e saldo médio diário para acompanhar meu desempenho financeiro. | Média |
| US27 | Como usuário, quero simular o impacto de uma compra, inclusive parcelada, no orçamento atual e futuro para avaliar seu comprometimento antes de decidir. | Média |
| US31 | Como usuário, quero calcular juros compostos e o valor futuro hipotético de um gasto não realizado para comparar cenários de investimento e consumo. | Média |
| US32 | Como usuário, quero visualizar a projeção de entradas, saídas e saldo futuro para antecipar meu fluxo de caixa de curto prazo. | Média |
| US35 | Como usuário, quero visualizar se meus gastos por categoria estão aumentando, diminuindo ou permanecendo estáveis ao longo do tempo para identificar mudanças de comportamento. | Média |
| US42 | Como usuário, quero importar transações de CSV ou extrato em formato predefinido para evitar o registro manual de informações já existentes. | Média |
| US48 | Como usuário, quero receber sugestões de categoria com base no meu histórico de descrições semelhantes para categorizar novas despesas com menos esforço. | Média |
| US51 | Como usuário, quero criar um plano de economia para uma compra de alto valor com parcelas mensais compatíveis com meu orçamento para saber como alcançar esse objetivo. | Média |
| US52 | Como usuário, quero criar regras de gastos baseadas em limites proporcionais e ser alertado quando elas forem violadas para controlar meu comportamento financeiro. | Média |
| US54 | Como usuário, quero receber por notificação push um resumo semanal que destaque meus maiores gastos e o progresso em relação ao orçamento para acompanhar minha situação financeira regularmente. | Média |
| US58 | Como usuário, quero visualizar a porcentagem de metas de economia cumpridas em um período histórico definido para avaliar minha consistência no alcance de objetivos. | Média |
| US59 | Como usuário, quero participar de um desafio para reduzir gastos em uma categoria específica de despesas essenciais e receber sugestões de alternativas mais econômicas para melhorar meus hábitos de consumo. | Média |

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

A API escuta em `0.0.0.0`. A rota [http://localhost:3000/health](http://localhost:3000/health) permite verificar o serviço HTTP; ela não verifica a conexão com o banco. Em banco já preparado, não é necessário repetir a preparação inicial.

### Frontend

Em outro terminal:

```powershell
cd orca-finance
npm ci
# Copie apenas se ainda nao houver um .env local
Copy-Item .env.example .env
```

Configure `EXPO_PUBLIC_API_URL` com a URL da API:

Padrão atual no `.env.example` e nos perfis de build EAS: `http://10.146.213.200:3000` (IP do notebook na rede local).

- Android Emulator: `http://10.0.2.2:3000`.
- Celular físico: `http://<IP-do-computador-na-rede>:3000`, com celular e computador na mesma rede e a porta acessível.

```powershell
npx expo start
```

Abra o app pelo Expo Go compatível ou pressione `a` para usar o emulador Android. Reinicie o Expo após mudar a URL. O endereço padrão do APK faz parte do build; para atualizar esse padrão, gere outro APK. Na versão com **Configurar servidor**, também é possível informar outro endereço na tela de entrada sem novo build. Uma configuração salva no aparelho tem prioridade sobre o padrão; use **Usar endereço padrão do aplicativo** para removê-la.

## Dados para apresentação da Sprint 2

O roteiro `backend/prisma/seed-sprint2-presentation.cjs` complementa uma conta existente com dois perfis, histórico, orçamentos, metas, auditoria, automações, planos e desafios. Informe explicitamente a conta e a data de referência; `--apply` autoriza gravar no banco configurado no backend.

```powershell
cd backend
npm run seed:sprint2 -- --email "seu-email@exemplo.com" --reference-date "2026-11-08" --apply
```

Roteiro calibrado para a apresentação de novembro/2026. Execute uma instância por vez. Não cria usuário nem troca senha; utiliza os Services do produto e mantém um backup inicial e manifesto em `backend/.cache/presentation-sprint2-<data>/`, ignorados pelo Git. A preparação não é uma transação única: pode ser retomada e foi verificada sem duplicação para a mesma referência. Reaplica nomes dos perfis, identificação/ativação do mensal principal e cota demonstrativa do segundo perfil; revise antes de reexecutar após alterações manuais. O processo não envia push. Aceites históricos dos desafios usam o mesmo service com Clock histórico apenas nesse processo.
