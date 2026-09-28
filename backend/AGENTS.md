# AGENTS.md — Orca Finance Backend

Este arquivo complementa o `AGENTS.md` da raiz e vale para tudo dentro de `backend/`.

## Responsabilidade

`backend/` contém a API e persistência do Orca Finance.

Antes de implementar, consulte os documentos compartilhados em `../docs/`.

Fontes técnicas principais:

- `../docs/Orca_Finance_Arquitetura_Backend.md`
- `../docs/Orca_Finance_Modelo_de_Dados.md`
- backlog e RN vigentes em `../docs/`
- DER/modelo físico vigente quando aplicável

O modelo de dados compartilhado é a referência para `schema.prisma`, migrations e persistência.

## Stack

Stack definida:

```text
Node.js
TypeScript
NestJS
Fastify Adapter
REST / JSON
Prisma ORM
PostgreSQL
```

Estilo inicial:

```text
monólito modular
```

Não introduza microserviços, CQRS, event bus, Kafka/RabbitMQ, event sourcing ou múltiplos bancos sem necessidade formal.

## Camadas

Fluxo esperado:

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

Responsabilidades:

- Controller: HTTP, parâmetros, DTO e resposta.
- Service: regra de negócio, autorização contextual, coordenação e transação de banco.
- Repository: consultas e persistência Prisma.
- Prisma: mapeamento para PostgreSQL.

Não coloque regra financeira no Controller.
Não coloque decisão de negócio no Repository.

Evite DDD cerimonial, repository genérico universal, mappers/DTOs internos em cadeia ou Unit of Work próprio sem necessidade concreta.

## Isolamento por perfil

`PerfilFinanceiro` é a fronteira principal dos dados financeiros.

Nunca confie somente em `profileId` recebido pela rota.

Antes de operar sobre dado financeiro:

```text
usuário autenticado
→ perfil solicitado
→ validar perfil.usuarioId == usuário.id
→ executar operação
```

Repositories financeiros devem receber contexto de perfil ou operar somente após ownership validado.

Evite consultas globais por `id` que possam atravessar perfis.

## Rotas e contrato HTTP

Padrão preferencial para recursos financeiros:

```text
/profiles/:profileId/...
```

Exemplo:

```text
GET    /profiles/:profileId/transactions
POST   /profiles/:profileId/transactions
GET    /profiles/:profileId/transactions/:transactionId
PATCH  /profiles/:profileId/transactions/:transactionId
DELETE /profiles/:profileId/transactions/:transactionId
```

DTO valida formato básico.
Regra condicional de negócio pertence ao Service.

Respostas são contratos REST/JSON.
Não exponha objetos Prisma como contrato por conveniência quando isso acoplar a API à persistência.

## Persistência

Banco oficial: PostgreSQL.

ORM: Prisma.

Seguir o modelo de dados vigente para:

- UUID;
- `NUMERIC`/Decimal em valores monetários;
- `TIMESTAMPTZ` para eventos com horário;
- `DATE` para datas puras;
- `JSONB` para snapshots;
- FKs, `CASCADE`, `SET NULL` e `UNIQUE`.

O SQL MySQL do Vertabelo é referência visual do DER, não tecnologia de produção.

Não transforme Dashboard, Relatório, SaldoAtual ou outras projeções em tabelas apenas para facilitar consultas; são dados derivados salvo decisão documental em contrário.
Se `schema.prisma`, migration ou PostgreSQL divergirem do
`Orca_Finance_Modelo_de_Dados.md`:

1. não corrigir silenciosamente;
2. apontar a divergência;
3. explicar a causa;
4. propor a menor correção possível;
5. preservar a decisão documental até aprovação.

## Operações críticas

Use transação de banco quando múltiplas alterações precisarem ser atômicas.

Reversão de transação deve respeitar o fluxo documentado:

```text
ler transação
→ registrar auditoria/snapshot
→ excluir transação
→ aplicar relacionamentos definidos
→ commit
```

Não criar transação inversa de estorno.

Recorrência deve preservar idempotência definida no modelo, incluindo a chave de ocorrência documentada.

## Autenticação e segurança

Autenticação remota pertence ao backend.

PIN e biometria são proteção local do aplicativo e não pertencem ao banco central.

Nunca armazenar senha ou token sensível em texto puro.

Não definir silenciosamente estratégia de access/refresh token se ela continuar aberta na arquitetura; trate como decisão técnica a ser fechada quando a autenticação real for implementada.

Erros internos do Prisma/PostgreSQL não devem ser expostos ao cliente.

## Erros HTTP

Distinguir pelo menos:

```text
400 entrada inválida
401 não autenticado
403 sem acesso ao perfil/recurso
404 inexistente
409 conflito/duplicidade/regra
500 erro interno não previsto
```

## Integrações externas

OCR, câmbio, notícias, push, e-mail e storage devem ser isolados quando suas funcionalidades entrarem em implementação.

Não criar adapters genéricos antecipadamente.

Armazenamento físico de anexos continua uma decisão técnica separada do registro de metadados no banco.

## Testes

Prioridade:

1. testes de Service para regras e ownership;
2. testes de Repository para constraints/Prisma/PostgreSQL;
3. E2E para fluxos principais HTTP → banco.

Cobrir especialmente:

- autenticação;
- perfil;
- criação/consulta/edição de transação;
- isolamento entre perfis;
- reversão + auditoria;
- recorrência/idempotência;
- regras financeiras implementadas no bloco atual.

Um endpoint só está pronto quando:

- existe RF/US que o justifica;
- DTO está validado;
- ownership está protegido;
- regra está no Service;
- persistência está no Repository;
- erros esperados estão tratados;
- teste principal existe.

## Limites

Não implementar funcionalidade ou tabela apenas porque “pode ser útil depois”.

Se regra continuar pendente em `../docs/`, não a feche dentro do código.

## Ao concluir uma tarefa

Sempre informe:

- arquivos criados;
- arquivos alterados;
- comandos executados;
- testes executados;
- resultado dos testes;
- decisões técnicas tomadas;
- divergências encontradas nos documentos;
- decisões pendentes que bloquearam alguma implementação.

Não altere arquivos fora do escopo da tarefa sem necessidade.
