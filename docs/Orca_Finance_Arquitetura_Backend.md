# Orca Finance — Arquitetura Backend

> **Status:** arquitetura backend consolidada para início da implementação  
> **Projeto:** Orca Finance — Mobile / FATEC  
> **Objetivo:** definir uma arquitetura backend simples, rastreável e compatível com o modelo de dados final, sem adicionar complexidade desnecessária para o escopo acadêmico.  
> **Fonte principal de dados:** `Orca_Finance_Modelo_de_Dados_Final.md`.

---

# 1. Objetivo

O backend do Orca Finance será responsável por:

- autenticação remota da conta;
- gerenciamento de perfis financeiros;
- persistência das transações;
- categorias e subcategorias;
- orçamentos;
- metas;
- recorrências e lembretes;
- regras de gastos e automações;
- auditoria;
- consultas e dados derivados;
- suporte futuro às integrações previstas nos requisitos.

A arquitetura deve:

1. manter regras de negócio fora dos controllers;
2. impedir acesso de um usuário aos perfis de outro;
3. preservar a rastreabilidade entre requisito, User Story, regra, implementação e teste;
4. permitir evolução incremental conforme as sprints;
5. evitar abstrações que ainda não tenham responsabilidade real.

---

# 2. Fontes consideradas

Esta arquitetura deve ser lida em conjunto com:

1. requisitos funcionais;
2. backlog revisado RF → US;
3. regras de negócio consolidadas;
4. `Orca_Finance_Modelo_de_Dados_Final.md`;
5. DER final do Vertabelo;
6. `Orca_Finance_Arquitetura_Frontend.md`;
7. Design System e fluxo de telas quando houver impacto na API.

Nenhuma regra de negócio pendente deve ser resolvida implicitamente dentro do código.

---

# 3. Stack definida

A stack backend adotada é:

```text
Node.js
TypeScript
NestJS
Fastify Adapter
REST / JSON
Prisma ORM
PostgreSQL
```

Visão geral:

```text
Aplicativo Mobile
       ↓
    REST/JSON
       ↓
NestJS + Fastify
       ↓
Services / Use Cases
       ↓
Repositories
       ↓
Prisma ORM
       ↓
PostgreSQL
```

---

# 4. Estilo arquitetural

## 4.1 Monólito modular

O backend será implementado inicialmente como um **monólito modular**.

Isso significa:

- uma única aplicação backend;
- um único banco PostgreSQL;
- módulos separados por responsabilidade;
- comunicação interna direta entre módulos quando necessária.

Não serão utilizados inicialmente:

```text
microserviços
CQRS
event bus
Kafka/RabbitMQ
event sourcing
múltiplos bancos
arquitetura distribuída
```

Essas soluções adicionariam complexidade sem necessidade concreta para o projeto acadêmico.

---

## 4.2 Camadas

Arquitetura prática:

```text
Controller
    ↓
Service / Use Case
    ↓
Repository
    ↓
Prisma
    ↓
PostgreSQL
```

### Controller

Responsável por:

- receber HTTP;
- ler parâmetros;
- receber DTO;
- chamar o Service;
- devolver resposta HTTP.

Não deve conter regra financeira.

### Service / Use Case

Responsável por:

- regras de negócio;
- validações entre entidades;
- autorização contextual por perfil;
- coordenação de múltiplos repositories;
- transações de banco quando necessárias.

### Repository

Responsável por:

- consultas Prisma;
- criação;
- alteração;
- exclusão;
- filtros;
- persistência.

Não deve decidir regra de negócio.

### Prisma

Responsável pelo mapeamento entre:

```text
objetos TypeScript
↕
PostgreSQL
```

---

# 5. Por que não criar uma camada DDD mais complexa agora

Conceitualmente, o fluxo pode ser entendido como:

```text
API
→ Aplicação
→ Domínio
→ Persistência
```

Porém, para esta implementação, `Service / Use Case` concentrará as regras de aplicação e domínio.

Não serão criados inicialmente:

```text
Domain Entity separada da entidade Prisma
Mapper para todas as entidades
DTO interno para cada camada
Repository genérico abstrato
Unit of Work próprio
```

Trade-off:

### Vantagem

Menos código repetitivo e arquitetura mais fácil de compreender e defender.

### Limitação

Caso o domínio cresça muito, algumas regras poderão posteriormente ser extraídas para objetos ou serviços de domínio.

Para o escopo atual, a solução simples é suficiente.

---

# 6. Organização inicial de diretórios

Estrutura recomendada:

```text
src/
├── main.ts
├── app.module.ts
│
├── common/
│   ├── errors/
│   ├── guards/
│   └── utils/
│
├── database/
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
└── modules/
    ├── auth/
    ├── users/
    ├── profiles/
    ├── categories/
    ├── transactions/
    ├── budgets/
    ├── goals/
    ├── recurrences/
    ├── spending-rules/
    ├── automation-rules/
    └── ...
```

Dentro de um módulo:

```text
transactions/
├── transactions.controller.ts
├── transactions.service.ts
├── transactions.repository.ts
├── dto/
└── tests/
```

Não é necessário criar estrutura adicional sem necessidade real.

---

# 7. Módulos de domínio

## 7.1 `auth`

Responsabilidade:

- cadastro;
- login;
- autenticação remota.

Rastreabilidade principal:

```text
US60
```

### Pendente

A estratégia técnica definitiva de:

```text
access token
refresh token
expiração
revogação de sessão
```

será fechada na implementação de autenticação.

Não criar `SessaoAutenticacao` antes dessa decisão.

---

## 7.2 `profiles`

Responsabilidade:

- criar primeiro perfil automaticamente;
- listar perfis do usuário;
- alterar nome;
- obter perfil selecionado;
- validar ownership.

Rastreabilidade:

```text
RF11
US18
RN-PERFIL-01
RN-PERFIL-02
RN-ID-01
RN-ID-03
```

O perfil é a raiz dos dados financeiros.

---

## 7.3 `categories`

Responsabilidade:

- listar categorias globais;
- criar/editar subcategorias do perfil;
- desativar subcategorias;
- preservar histórico.

Rastreabilidade:

```text
RF02
US05
RN-CAT-01
```

---

## 7.4 `transactions`

Responsabilidade:

- criar receita/despesa;
- editar;
- listar;
- pesquisar;
- filtrar;
- tags;
- anotação;
- método de pagamento;
- gasto livre;
- anexos;
- compartilhamento;
- auditoria;
- reversão.

Rastreabilidade principal:

```text
RF01  → US01
RF21  → US02
RF36  → US02
RF58  → US02 / US03
RF23  → US04
RF12  → US19
RF39  → US33
RF40  → US44
RF57  → US45
```

---

## 7.5 `budgets`

Responsabilidade:

- orçamento mensal;
- orçamento por categoria;
- períodos flexíveis;
- orçamentos temporários/eventos;
- gastos livres;
- planejado x realizado.

Rastreabilidade:

```text
RF03 / RF24 → US06
RF34 / RF42 / RF63 → US07
RF46 → US09
RF55 → US40
RF57 → US45
```

RN-ORC-04 continua pendente e não deve ser inventada durante a implementação.

---

## 7.6 `goals`

Responsabilidade:

- metas;
- aportes;
- progresso derivado;
- sugestões calculadas.

Rastreabilidade:

```text
RF04 → US10
RN-META-01
RN-META-02
```

O aporte da meta não é uma despesa comum e não altera automaticamente o saldo.

---

## 7.7 `recurrences`

Responsabilidade:

- configurar recorrência;
- gerar ocorrências;
- impedir duplicação;
- alterar somente ocorrências futuras;
- cancelar somente ocorrências futuras;
- lembretes.

Rastreabilidade:

```text
RF20 / RF64
US24
RN-REC-01
RN-NOT-01
```

---

## 7.8 `spending-rules`

Responsabilidade:

- limites;
- regras por categoria;
- regras por percentual;
- canais de alerta.

Rastreabilidade:

```text
RF27
RF54
RF71
US29
US52
```

---

## 7.9 `automation-rules`

Responsabilidade:

- regras configuradas pelo usuário;
- aplicação automática de atributos.

Rastreabilidade:

```text
RF15
US20
RN-CAT-03
```

A unicidade de regra ativa será validada no Service nesta versão.

---

# 8. Isolamento por perfil

Esta é uma das regras arquiteturais mais importantes do backend.

Para qualquer dado financeiro:

```text
usuario autenticado
       ↓
perfil solicitado
       ↓
validar:
perfil.usuarioId == usuario.id
       ↓
executar operação
```

Nunca aceitar apenas:

```text
profileId recebido pela rota
```

como prova de autorização.

Exemplo de rota:

```text
GET /profiles/:profileId/transactions
```

Antes de consultar as transações:

```text
ProfileService
→ valida que o perfil pertence ao usuário autenticado
```

Somente então:

```text
TransactionRepository
→ consulta por perfilId
```

---

# 9. Regra para repositories financeiros

Toda consulta de entidade financeira deve receber o contexto de perfil quando aplicável.

Evitar:

```text
findTransaction(id)
```

Preferir conceitualmente:

```text
findTransaction(profileId, transactionId)
```

ou validar o perfil antes da chamada.

Motivo:

- reduz risco de vazamento entre perfis;
- torna o isolamento explícito no código;
- facilita testes.

---

# 10. Rotas REST

Padrão principal:

```text
/profiles/:profileId/...
```

Exemplos:

```text
GET    /profiles/:profileId/transactions
POST   /profiles/:profileId/transactions
GET    /profiles/:profileId/transactions/:transactionId
PATCH  /profiles/:profileId/transactions/:transactionId
DELETE /profiles/:profileId/transactions/:transactionId

GET    /profiles/:profileId/budgets
POST   /profiles/:profileId/budgets

GET    /profiles/:profileId/goals
POST   /profiles/:profileId/goals
```

Recursos globais ou da conta não precisam usar `profileId`.

Exemplos:

```text
GET /categories
GET /education-content
GET /me/education-reading
GET /me/trigger-apps
```

As rotas finais serão detalhadas durante cada User Story.

---

# 11. DTOs e validação

DTOs representam o contrato HTTP.

Exemplo conceitual:

```text
CreateTransactionDto
UpdateTransactionDto
TransactionFilterDto
```

Devem validar formato básico:

```text
valor
data
enum
UUID
string obrigatória
```

Porém regras de negócio ficam no Service.

Exemplo:

DTO:

```text
categoriaId pode ser nullable
```

Service:

```text
cadastro manual normal
→ categoria obrigatória

gasto livre
→ categoria pode ser nula

importação
→ pode permanecer sem categoria
```

Isso evita colocar regras condicionais complexas no controller.

---

# 12. Persistência

Banco oficial:

```text
PostgreSQL
```

ORM:

```text
Prisma
```

Padrões definidos no modelo:

```text
UUID
NUMERIC(19,2) para dinheiro
NUMERIC(19,8) para taxa de câmbio
CHAR(3) para moeda
TIMESTAMPTZ para eventos com horário
DATE para datas puras
JSONB para snapshots
```

O SQL MySQL utilizado no Vertabelo é apenas um artefato de visualização do DER.

Não representa mudança da tecnologia do backend.

---

# 13. Transações de banco

Operações que modificam várias tabelas e precisam ser atômicas devem ocorrer na mesma transação do banco.

Principal exemplo:

```text
reversão de Transacao
```

Fluxo:

```text
BEGIN
  ↓
ler Transacao atual
  ↓
criar AuditoriaTransacao
  ↓
DELETE Transacao
  ↓
CASCADE dos filhos definidos
  ↓
AuditoriaTransacao.transacaoId → NULL
COMMIT
```

Caso qualquer etapa falhe:

```text
ROLLBACK
```

Assim não existe exclusão sem auditoria.

---

# 14. Reversão e auditoria

Rastreabilidade:

```text
RF40 → US44 → RN-TRANS-03
RF23 → US04 → RN-AUD-01
```

Decisão consolidada:

```text
Transacao
→ exclusão física
```

Antes da exclusão:

```text
AuditoriaTransacao.estadoAnterior
→ snapshot dos campos persistidos da Transacao
```

Depois:

```text
AuditoriaTransacao.transacaoId
→ NULL por ON DELETE SET NULL
```

Filhos descartáveis:

```text
AnexoTransacao
ParticipacaoTransacao
TransacaoTag
TransacaoOrcamento
LembreteVencimento ligado à Transacao
```

podem ser removidos por:

```text
ON DELETE CASCADE
```

Não criar transação inversa.

---

# 15. Recorrência

Cada ocorrência deve ser gerada uma única vez.

A entidade `Transacao` possui:

```text
recorrenciaId
ocorrenciaReferencia
```

Constraint:

```text
UNIQUE(recorrenciaId, ocorrenciaReferencia)
```

Assim, mesmo que o processo de geração seja executado novamente, o banco impede duplicação da mesma ocorrência.

Alterar ou cancelar uma recorrência afeta somente o futuro.

---

# 16. Dados derivados

Não persistir apenas para facilitar telas:

```text
saldoAtual
gastosDoMes
percentualMeta
valorAcumuladoMeta
valorRealizadoOrcamento
planejadoXRealizado
taxaPoupanca
saldoMedioDiario
dashboard
relatorios
```

Esses valores serão obtidos por consultas e cálculos.

Exemplo:

```text
saldo =
SUM(receitas efetivadas)
-
SUM(despesas efetivadas)
```

O backend pode oferecer endpoints de consulta/read model, sem criar tabelas próprias para esses resultados.

---

# 17. Integração com o front-end

A arquitetura front-end já foi preparada para substituir mocks por API.

Evolução:

```text
ANTES

Screen
  ↓
Service
  ↓
Mock
```

Depois:

```text
Screen
  ↓
Service
  ↓
API REST
  ↓
Backend
```

Portanto o front-end não deve acessar diretamente detalhes do PostgreSQL ou Prisma.

Contrato entre os lados:

```text
JSON via HTTP
```

---

# 18. Tratamento de erros

O backend deve distinguir pelo menos:

```text
400 → entrada inválida
401 → usuário não autenticado
403 → perfil/recurso não pertence ao usuário
404 → recurso inexistente
409 → conflito de regra/duplicidade
500 → erro interno não previsto
```

O Service deve lançar erros de aplicação coerentes.

O Controller ou filtro global transforma esses erros em resposta HTTP.

Mensagens internas do banco não devem ser devolvidas diretamente ao aplicativo.

---

# 19. Segurança mínima

Para o escopo acadêmico:

- senha nunca é armazenada em texto puro;
- backend nunca confia apenas no `profileId`;
- queries financeiras respeitam o perfil autorizado;
- dados internos do Prisma/PostgreSQL não são expostos diretamente;
- DTOs validam entrada;
- erros técnicos não devem revelar detalhes internos do banco.

PIN e biometria continuam sendo mecanismos locais do aplicativo e não fazem parte da autenticação remota do backend.

---

# 20. Anexos

O banco persiste:

```text
arquivoUrl
mimeType
tipo
```

O arquivo binário não deve ser armazenado diretamente na tabela `AnexoTransacao`.

### Decisão pendente de implementação

Ainda será escolhido onde o arquivo físico ficará armazenado:

```text
storage externo
ou
solução local/de desenvolvimento compatível com a entrega acadêmica
```

Essa escolha não altera o modelo de dados.

---

# 21. Integrações externas

Devem ser isoladas em services/adapters quando forem implementadas.

Exemplos futuros:

```text
cotação de moedas
notícias financeiras
OCR
push notification
```

Não criar abstrações ou adapters dessas integrações antes da User Story correspondente.

---

# 22. Estratégia de testes

## 22.1 Testes de Service

Principal foco.

Devem validar:

- regra de negócio;
- ownership de perfil;
- categoria obrigatória conforme fluxo;
- gasto livre;
- orçamento;
- meta;
- recorrência;
- auditoria;
- reversão.

Exemplo:

```text
Given
  transação existente

When
  usuário reverte

Then
  transação deixa de existir
  auditoria continua existindo
  filhos definidos são removidos
  nenhuma transação inversa é criada
```

---

## 22.2 Testes de Repository

Validar integração com Prisma/PostgreSQL para operações importantes:

- FKs;
- `UNIQUE`;
- `CASCADE`;
- `SET NULL`;
- filtros por perfil.

---

## 22.3 Testes E2E

Para fluxos principais:

```text
HTTP
→ Controller
→ Service
→ Repository
→ Banco
```

Priorizar:

- autenticação;
- perfil;
- criação de transação;
- consulta;
- edição;
- reversão.

---

# 23. Rastreabilidade de implementação

Para cada funcionalidade:

```text
RF
 ↓
User Story
 ↓
Critério de aceitação
 ↓
Regra de negócio
 ↓
Endpoint
 ↓
Service / Use Case
 ↓
Repository
 ↓
Prisma / PostgreSQL
 ↓
Teste
```

Exemplo:

```text
RF40
↓
US44
↓
RN-TRANS-03
↓
DELETE /profiles/:profileId/transactions/:id
↓
TransactionsService.reverse()
↓
TransactionsRepository
↓
Prisma transaction
↓
teste de integração + E2E
```

---

# 24. O que não será antecipado

Não implementar agora apenas por possibilidade futura:

```text
microserviços
fila de mensagens
cache Redis
event sourcing
CQRS
GraphQL
repository genérico universal
domain events
versionamento complexo de entidades
observabilidade distribuída
Kubernetes
```

Esses itens só devem ser considerados se surgir necessidade concreta.

---

# 25. Pendências arquiteturais

As seguintes decisões permanecem abertas:

| Tema | Situação |
|---|---|
| Estratégia completa de access/refresh token | Definir junto da autenticação real |
| Armazenamento físico de anexos | Definir junto do RF12/RF29 |
| Push real | Definir quando notificações remotas forem implementadas |
| Importação CSV | RN-IMP-01 pendente |
| Histórico de preços | RN-PRECO-01 pendente |
| Pegada de carbono | RN-CARB-01 pendente |
| Saúde financeira | fórmula pendente |
| Pausa financeira | ownership `Usuario` x `PerfilFinanceiro` pendente |
| Recorrência em moeda estrangeira | regra de cotação por ocorrência pendente |

Nenhuma dessas pendências bloqueia a implementação do núcleo.

---

# 26. Ordem recomendada de implementação

## Etapa 1 — infraestrutura

```text
NestJS
Fastify
Prisma
PostgreSQL
configuração de ambiente
PrismaService
```

## Etapa 2 — fundação

```text
Usuario
PerfilFinanceiro
Categoria
Subcategoria
```

## Etapa 3 — transações

```text
Transacao
Tag
TransacaoTag
AnexoTransacao
AuditoriaTransacao
```

## Etapa 4 — planejamento

```text
Orcamento
OrcamentoCategoria
TransacaoOrcamento
CotaGastoLivre
RegraGasto
RegraGastoCanal
```

## Etapa 5 — metas

```text
Meta
AporteMeta
```

## Etapa 6 — automações

```text
Recorrencia
LembreteVencimento
RegraAutomacao
```

## Etapa 7 — funcionalidades complementares

Somente conforme sprint/User Story.

---

# 27. Definição de pronto de um endpoint

Um endpoint backend só é considerado pronto quando:

- existe RF/US que justifica sua existência;
- DTO está validado;
- ownership do perfil é respeitado;
- regra está no Service;
- persistência está no Repository;
- erros esperados estão tratados;
- teste da regra principal existe;
- não introduz regra de negócio não documentada.

---

# 28. Decisões consolidadas

1. Backend será monólito modular.
2. Comunicação com o app será REST/JSON.
3. Stack: NestJS + Fastify + Prisma + PostgreSQL.
4. Fluxo principal: `Controller → Service → Repository → Prisma`.
5. Não haverá DDD cerimonial com múltiplas representações da mesma entidade nesta fase.
6. `PerfilFinanceiro` é a fronteira de autorização dos dados financeiros.
7. Isolamento por perfil é responsabilidade obrigatória do Service/Repository.
8. Controllers não contêm regra de negócio.
9. Dados derivados não viram tabelas por padrão.
10. Operações multi-entidade críticas usam transação de banco.
11. Reversão registra auditoria e depois exclui fisicamente a transação.
12. Recorrência usa constraint simples de idempotência.
13. Integrações externas serão adicionadas apenas quando necessárias.
14. Decisões de negócio pendentes não serão inventadas durante a implementação.
15. A arquitetura deve permanecer simples o suficiente para ser compreendida e defendida academicamente.

---

# 29. Próxima etapa

Com:

```text
Modelo de Dados Final
+
DER Final
+
Arquitetura Backend
```

fechados, a próxima etapa é:

```text
Modelo físico PostgreSQL
        ↓
schema.prisma
        ↓
migration inicial
        ↓
seed
        ↓
primeiros módulos backend
```

O primeiro artefato técnico seguinte deve ser o `schema.prisma` do núcleo, derivado do modelo físico PostgreSQL e não do SQL MySQL utilizado apenas no Vertabelo.
