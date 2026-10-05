# Orca Finance Backend

> Recuperação após interrupção: saída da US12 implementada sem schema/migration. DELETE `P/reflection-items/:itemId` desiste após liberação; POST `P/reflection-items/:itemId/transactions` recebe o cadastro existente DESPESA/EFETIVADA e cria/audita/remove o item atomicamente. JWT/ownership/liberação são validados no servidor; espera 409, item ausente/de outro perfil 404. Abrir o formulário não altera persistência. Veja [RECUPERACAO_INTERRUPCAO.md](../orca-finance/RECUPERACAO_INTERRUPCAO.md) para testes atuais e evidências.

> Complementação da US19: o POST de recibos agora exige arquivo multipart JPEG/PNG e usa Cloudinary. O contrato JSON por URL foi substituído; GET/listagem/detalhe e registros antigos permanecem disponíveis. Veja a seção “Upload físico de recibos — Cloudinary” e [US19_CLOUDINARY.md](US19_CLOUDINARY.md).

> Fechamento da Sprint 1 (03/10/2026): consulte [STATUS_FINAL_SPRINT1.md](../orca-finance/STATUS_FINAL_SPRINT1.md) para o estado integrado, testes e pendências. Substituição de tags, edição e reversão agora bloqueiam a mesma linha da transação antes da operação atômica. Edição de ocorrência gerada preserva categoria opcional usando o modo de validação existente, sem alterar a regra de cadastro manual. Schema, migration e ambiente foram preservados. A tabela histórica do bootstrap abaixo não representa a contagem atual das suítes.

API NestJS + Fastify + Prisma + PostgreSQL do Orca Finance. A migration inicial
está aplicada no PostgreSQL de desenvolvimento hospedado no Neon. O seed contém somente o catálogo
global de categorias principais. Esta versão implementa conta, login, perfis,
subcategorias, transações manuais, tags, auditoria automática, reversão física
e planejamento mensal, metas/aportes, relatórios de gastos, exportação CSV/XLSX
e dashboard financeiro, período de reflexão, upload físico/metadados de recibos, recorrências
automáticas e configuração de lembretes da Sprint 1.

## Upload físico de recibos — Cloudinary

RF12 → US19, sem RN específica. Configure somente no ambiente privado do backend:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

O secret nunca vai ao frontend ou ao Git. São usados `cloudinary@2.11.0` (SDK oficial)
e `@fastify/multipart@10.1.2`. O adapter faz upload autenticado de bytes via
`upload_stream`, com UUID no prefixo `orca-finance/receipts/` e timeout de 30 s.
Cloudinary armazena a foto; Neon armazena somente os campos existentes
`arquivoUrl`, `mimeType`, `tipo=RECIBO` e as referências/metadados do anexo.

**Contrato:** POST `/profiles/:profileId/transactions/:transactionId/receipts`,
Bearer JWT, exatamente um JPEG/PNG no campo multipart `file`, sem campos extras.
Limite técnico: **5 MiB (5.242.880 bytes)**, com MIME e assinatura dos bytes
compatíveis. Arquivo inválido/vazio: 400; acima do limite: 413; JSON de URL: 415.
JWT, ownership do perfil/transação e DESPESA são validados antes do upload.
Não há gravação temporária em disco, binário/Base64 no banco ou OCR.

Exemplo Expo SDK 57 em JavaScript, após câmera/seleção produzir uma URI local:

```js
import { File } from 'expo-file-system';

const form = new FormData();
form.append('file', new File(receiptUri), 'recibo.jpg');
const response = await fetch(`${apiUrl}/profiles/${profileId}/transactions/${transactionId}/receipts`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: form,
});
```

Deixe o `fetch` gerar Content-Type/boundary. Não envie `arquivoUrl`, `mimeType`
como campos separados ou credenciais Cloudinary. A resposta 201 contém
`id`, `transacaoId`, `tipo`, `arquivoUrl`, `mimeType`, `createdAt`.
GET da mesma rota e `recibos` no detalhe mantêm compatibilidade com os registros
existentes, inclusive PDFs antigos; novos uploads aceitam só JPEG/PNG.
O mobile já usa câmera/galeria e envio multipart no cadastro de despesa e no detalhe. A criação antiga por URL foi removida; anexos antigos continuam legíveis. Validação externa ainda depende das credenciais do Cloudinary.

Falha Cloudinary: 502 genérico, sem anexo no banco. Configuração ausente: 503,
sem impedir a inicialização dos demais módulos. Se o upload concluir e a
persistência falhar, tenta destruir somente o arquivo recém-criado; falha dessa
compensação produz aviso operacional sem resposta interna, stack ou credenciais.
Upload ocorre fora da transação de banco; a persistência revalida a DESPESA sob lock.

Reversão mantém CASCADE no Neon e snapshots sem recibos. **Limpeza física no
Cloudinary após reversão ainda é pendência técnica:** public_id não é persistido
e não houve mudança de schema/migration. O upload padrão usa entrega por URL
pública HTTPS; ownership protege a API, não o acesso direto ao CDN.

Unitários/E2E usam provider substituído, sem depender da disponibilidade Cloudinary.
`npm run test:cloudinary` é separado e opcional: envia JPEG/PNG, consulta as URLs
e tenta remover os próprios arquivos em finally; sem as três variáveis, informa SKIP.
Veja [US19_CLOUDINARY.md](US19_CLOUDINARY.md) para evidências, falhas e pendências.

## Preparação do ambiente

Use Node.js 22.12+ da linha 22 (validado com 22.19.0) ou Node.js 24 e npm.

```powershell
npm ci
npm run prisma:generate
Copy-Item .env.example .env
```

Preencha `DATABASE_URL` com a URL do PostgreSQL no Neon, configure `JWT_SECRET` com um
segredo local forte, exclusivo do `.env`, e ajuste `PORT` (padrão 3000).
`JWT_EXPIRES_IN` é o prazo do access token em segundos; preencha um inteiro
positivo (por exemplo, `3600`).
O exemplo mantém a URL vazia: nenhuma credencial real é fornecida ou criada.
Não versione `.env`. O Prisma CLI e `main.ts` carregam o ambiente com `dotenv`.
Sem `JWT_SECRET` ou `JWT_EXPIRES_IN` válidos, a aplicação falha ao iniciar.

```powershell
npm run start:dev
```

A API habilita CORS em `src/common/configure-app.ts` para o cliente web:
aceita qualquer origem, os métodos GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS e
os headers Accept, Content-Type e Authorization. A autenticação usa Bearer
token; cookies entre origens não são habilitados. A configuração também é
aplicada nos testes de bootstrap, incluindo preflight e respostas 401.

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
| `npm test` | Testes unitários de regras, autenticação, DTOs e bootstrap HTTP em memória |
| `npm run test:e2e` | Fluxos HTTP contra Neon; limpa somente registros identificados por esta execução |
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
  modules/tags/
  modules/budgets/
  modules/goals/
  modules/analytics/
test/bootstrap.spec.ts
test/foundation.spec.ts
test/foundation.e2e.ts
test/transactions.spec.ts
test/auth-and-validation.spec.ts
test/transaction-audit.e2e.ts
test/tags.spec.ts
test/tags.e2e.ts
test/budgets.spec.ts
test/budgets.e2e.ts
test/goals-and-analytics.spec.ts
test/goals-analytics.e2e.ts
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
| DELETE | `/profiles/:profileId/transactions/:transactionId` | Bearer token; reversão física auditada, exige ownership; retorna 204 sem corpo |
| GET, POST | `/profiles/:profileId/tags` | Bearer token; lista/cria tags do perfil autorizado |
| PUT | `/profiles/:profileId/transactions/:transactionId/tags` | Bearer token; substitui o conjunto de tags da transação, retorna 200 com `tags` |
| PUT, GET | `/profiles/:profileId/budgets/monthly/:year/:month` | Bearer token; define/consulta orçamento mensal e comparação |
| PUT, GET | `/profiles/:profileId/free-spending-quota/:year/:month` | Bearer token; define/consulta cota mensal |
| GET, POST | `/profiles/:profileId/spending-rules` | Bearer token; lista/avalia ou cria regras monetárias |
| PATCH | `/profiles/:profileId/spending-rules/:ruleId` | Bearer token; altera regra e canais ou desativa com `ativa: false` |
| POST, GET | `/profiles/:profileId/goals` | Bearer token; cria/lista metas do perfil |
| GET, PATCH | `/profiles/:profileId/goals/:goalId` | Bearer token; detalhe/edição de meta do perfil |
| POST | `/profiles/:profileId/goals/:goalId/contributions` | Bearer token; registra aporte exclusivo da meta |
| GET | `/profiles/:profileId/reports/expenses` | Bearer token; distribuição de despesas efetivadas por categoria/período |
| GET | `/profiles/:profileId/exports/transactions` | Bearer token; arquivo CSV ou XLSX das transações |
| GET | `/profiles/:profileId/dashboard` | Bearer token; resumo financeiro e progresso das metas |

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
pagamento quando o resultado respeitar as regras.

`GET /profiles/:profileId/transactions` aceita filtros `dataInicial`, `dataFinal`
(instantes ISO 8601 inclusivos), `tipo`, `categoriaId`, `metodoPagamento`,
`status`, `descricao` (trecho da descrição, sem diferenciar maiúsculas/minúsculas)
e `valor` (igualdade decimal). A ordenação técnica é `dataHora` decrescente e,
em empate, `id` decrescente. Não há paginação nesta primeira versão.
Recorrência, câmbio e localização não são expostos nesse CRUD.

### Auditoria e reversão

RF23 → US04 → RN-AUD-01 e RF40 → US44 → RN-TRANS-03. Criação grava
`CRIACAO` (antes nulo, depois preenchido); edição grava `EDICAO` (antes/depois);
reversão grava `EXCLUSAO` (antes preenchido, depois nulo) e exclui fisicamente
a transação. Cada operação financeira e sua auditoria compartilham a mesma
`Prisma.$transaction`; qualquer falha desfaz ambas. Não há estorno inverso.

Os snapshots incluem todos os campos persistidos de `Transacao`, sem
relacionamentos: Decimal vira string, DateTime vira ISO e nullable permanece
`null`. Após a exclusão, o PostgreSQL aplica `SET NULL` ao vínculo de todas as
auditorias e `CASCADE` aos filhos definidos no schema. Não há exclusão manual
de filhos no fluxo da API. A consulta HTTP de histórico não faz parte desta task.

Os E2E usam e-mails com UUID exclusivo e limpam somente os dados daquela
execução. O timeout de 60 segundos acomoda múltiplas viagens ao Neon em cada
cenário. Os testes comprovam snapshots, rollback por falha real de FK, `SET NULL`
e cascatas em tags vinculadas, anexos, participações, lembretes e vínculos de
orçamento; preparar esses filhos via Prisma não cria APIs dessas funcionalidades.

Nomes de usuário, perfil e subcategoria precisam conter caractere não branco,
sem normalização automática. Token ausente/inválido/expirado e usuário inválido
ou inexistente retornam 401. Falha de infraestrutura durante a consulta do usuário
segue o tratamento de erro interno do Nest (500), sem expor detalhes ao cliente.

### Tags — RF21 / US02

`POST /profiles/:profileId/tags` recebe `{ "nome": "#viagem" }` e retorna 201.
Nome deve conter caractere não branco, sem trim ou conversão de caixa automática.
A unicidade existente `(perfilId, nome)` é respeitada: duplicidade no mesmo perfil
retorna 409, enquanto o mesmo nome em outro perfil é permitido. Não há rename/delete.
`GET /profiles/:profileId/tags` retorna o catálogo do perfil, ordenado por nome e id.
Não há RN específica para tags; as fontes são RF21, US02 e o modelo de dados.

O PUT recebe `{ "tagIds": ["uuid"] }` como conjunto completo; `[]` remove todos
os vínculos. UUIDs repetidos representam uma única associação. Perfil, transação
e todas as tags são validados antes da substituição dentro de `Prisma.$transaction`.
Tag ausente ou de outro perfil retorna 400; transação ausente no perfil retorna 404;
perfil de outro usuário retorna 403. Qualquer falha na substituição causa rollback.

O detalhe GET da transação inclui `tags: [{ id, nome }]`, ordenadas por nome e id.
Consultas de tags são separadas das consultas escalares usadas pela auditoria:
alterar somente vínculos não muda `Transacao`, não gera auditoria e não inclui tags
nos snapshots. Reversão continua auditada; `CASCADE` remove `TransacaoTag` e preserva
`Tag`. Os E2E comprovam esses comportamentos e rollback após falha real de FK.

### Planejamento e controle de gastos — Sprint 1

| Rastreabilidade | Implementação e testes |
|---|---|
| RF03/RF24 → US06 → RN-ORC-01/02 | PUT/GET orçamento mensal; `budgets.spec.ts` e `budgets.e2e.ts` |
| RF27/RF54 → US29 → RN-LIM-01, RN-NOT-01/02 | POST/GET/PATCH regras e canais; os mesmos testes |
| RF55 → US40 → RN-ORC-02 | Comparação incorporada ao GET do orçamento; os mesmos testes |
| RF57 → US45 → RN-ORC-02/05 | PUT/GET cota mensal; os mesmos testes |

O módulo `budgets` reutiliza JWT, ownership e Prisma. Ano aceita 1..9999 e mês
1..12. Todos os valores monetários de entrada são strings decimais positivas,
com até 17 dígitos inteiros e duas casas, compatíveis com `Decimal(19,2)`.

O PUT do orçamento recebe o conjunto completo de categorias:

```json
{
  "categorias": [
    { "categoriaId": "uuid", "valorPlanejado": "800.00" }
  ]
}
```

Categorias precisam existir e não podem repetir. Categoria inativa só pode ser
mantida se já vinculada ao orçamento; novas associações exigem categoria ativa,
seguindo o catálogo existente. Somente `MENSAL` é exposto. RF24 usa esse mesmo
mecanismo por categoria, sem criar tipo ou entidade adicional.

O mesmo perfil/mês atualiza o mesmo orçamento e substitui suas categorias.
`Orcamento` e `OrcamentoCategoria` são gravados em uma transação, com lock da
linha do perfil para serializar PUTs concorrentes, sem nova constraint/migration.
Datas persistidas são primeiro e último dia do mês. Se houver múltiplos
orçamentos legados com esses mesmos perfil/tipo/datas, GET e PUT retornam 409,
sem escolher ou apagar um deles. Ausência de orçamento/cota retorna 404.

O GET do orçamento inclui `categorias` e `totais`, com `valorPlanejado`,
`valorRealizado`, `desvio` (realizado menos planejado), `percentualConsumido`
e `estado`. O realizado soma somente `DESPESA + EFETIVADA` do perfil, categoria
e período. Totais abrangem as categorias planejadas; valores sem categoria
ou de categorias não planejadas não são realocados. Cada despesa é somada
uma vez, inclusive quando também marcada como gasto livre. Não há ranking
arbitrário de desvios nem persistência desses resultados.

RN-ORC-01 usa menos de 75% como `NORMAL`, de 75% até 100% como
`PROXIMO_LIMITE` e acima de 100% como `EXCEDIDO`. O estado considera o
percentual antes do arredondamento de apresentação; percentuais são strings
com duas casas. Para planejado zero legado, percentual e estado são `null`:
a interpretação financeira continua pendente, sem divisão por zero ou RN
inventada. Novos valores zero são rejeitados. A referência visual antiga de
70% no Design System diverge da RN consolidada de 75%; prevalece a RN.

O PUT da cota recebe `{ "valorLimite": "100.00" }`, usando upsert pela
unicidade existente `(perfilId, ano, mes)`. GET retorna `valorLimite`,
`valorConsumido` e `valorRestante` (limite menos consumo, podendo ser negativo).
Somente despesas efetivadas explicitamente marcadas `ehGastoLivre: true`
consomem a cota. A ausência de categoria não implica gasto livre.

Exemplos de criação de regra:

```json
{ "tipo": "LIMITE_DIARIO", "periodo": "DIARIO", "valorLimite": "50.00", "canais": ["PUSH", "EMAIL"] }
```

```json
{ "tipo": "LIMITE_CATEGORIA", "categoriaId": "uuid", "periodo": "MENSAL", "valorLimite": "800.00", "canais": ["PUSH"] }
```

Limite diário exige período `DIARIO` e não possui categoria. Limite por categoria
exige categoria válida e aceita `DIARIO`, `SEMANAL`, `MENSAL` ou `ANUAL` do
modelo, com período escolhido explicitamente. Categoria inativa só pode ser
mantida em sua associação atual. Limites são monetários positivos: regras de
percentual sobre renda, `percentualLimite` e `baseCalculo` não são expostos
nesta US29. PATCH valida o estado final da regra, inclusive nas trocas de tipo.

Canais são um conjunto não vazio de `PUSH`/`EMAIL`, persistidos em
`RegraGastoCanal`; EMAIL exige endereço associado à conta. Criação e alteração
da regra/canais são atômicas. PATCH com `ativa: false` desativa; não há DELETE.
O GET aceita `dataReferencia` opcional como instante ISO com fuso (padrão: agora),
e retorna consumo, percentual, intervalo, `limiteAtingido`, `alertaAtivo` e
canais. RF27 identifica alerta diário ao atingir ou ultrapassar o limite;
RF54 identifica alerta de categoria somente ao ultrapassar. Regra desativada
mantém sua avaliação financeira e retorna `alertaAtivo: false`.

Datas de cálculo usam UTC, início inclusivo/fim exclusivo e semana de segunda
a domingo. Isso é uma decisão técnica reversível para o contrato atual, pois
as fontes não definem fuso financeiro nem início da semana; precisa de validação
de produto. Todos os consumos são consultados nas transações atuais, refletindo
imediatamente valor, categoria, data, status, marcação de gasto livre e reversão.
Auditoria e cascatas existentes permanecem inalteradas.

PUSH/EMAIL estão configuráveis e o estado do alerta é calculado, mas **não há
envio real de notificações**. RN-NOT-02 prevê e-mail; provider, entrega e mecanismo
de deduplicação de envio de RN-NOT-01 permanecem dependências pendentes de
arquitetura. Não foram introduzidos SMTP, Firebase, fila, cron ou cache.

Os E2E verificam ownership em todas as rotas, unicidade/idempotência, PUTs
concorrentes, thresholds, integração com transações, regras/canais e rollback
após falhas reais de FK no Neon. A limpeza é limitada às contas com UUID criadas
pela execução, respeitando as FKs; preserva o catálogo global e dados alheios.
O schema e a migration inicial permanecem intactos.

Validação deste bloco em 01/10/2026: `prisma validate`, `prisma generate`,
`prisma migrate status`, build, lint, `tsc --noEmit` e `git diff --check`
passaram. Os 58 testes unitários passaram. Os 22 E2E anteriores passaram
na execução completa; após corrigir as fixtures e a validação do PATCH vazio,
os nove E2E de planejamento passaram na reexecução específica, totalizando
31 cenários E2E validados. A última falha da execução completa era uma
expectativa anual da fixture que omitira despesa efetivada de dezembro.
A conferência final em transação somente leitura encontrou sete categorias
e zero registros nas outras 29 tabelas. A única migration,
`20260928150948_init`, está aplicada e seu checksum coincide com o arquivo local.

### Metas, relatórios, exportação e dashboard — Sprint 1

| Rastreabilidade | Implementação |
|---|---|
| RF04 → US10 → RN-META-01/02 | `goals`: metas, aportes e métricas derivadas |
| RF06 → US13, sem RN específica | `analytics`: relatório de despesas |
| RF07/RF28 → US14, sem RN específica | `analytics`: CSV e XLSX real |
| RF08 → US15 → RN-TRANS-01 e RN-META-01 | `analytics`: dashboard com metas reutilizadas de `goals` |

Os contratos e cálculos estão cobertos em `goals-and-analytics.spec.ts` e
`goals-analytics.e2e.ts`. Os modelos `Meta` e `AporteMeta` existentes são
reutilizados; não há tabela de relatórios/dashboard nem alteração de schema.

**Metas.** POST exige nome com caractere não branco, `valorAlvo` decimal/string
positivo, `dataLimite` no formato `YYYY-MM-DD` (ano positivo) e frequência
`DIARIA`/`SEMANAL`. PATCH permite esses mesmos campos, exige ao menos um
campo e recalcula as métricas. Meta inexistente no perfil retorna 404; não há
DELETE nem vínculos de aporte com transações.

```json
{ "nome": "Viagem", "valorAlvo": "1500.00", "dataLimite": "2026-12-31", "frequenciaSugestao": "SEMANAL" }
```

POST de aporte exige `valor` positivo como string decimal e `dataHora` como
instante ISO com `Z`/offset. Retorna 201 com o aporte registrado. O detalhe/lista
da meta, inclusive no dashboard, consulta a soma dos aportes atuais. Aporte é
gravado somente em `AporteMeta`: não gera receita, despesa, auditoria de
transação, consumo de orçamento ou saldo.

```json
{ "valor": "100.00", "dataHora": "2026-10-01T12:00:00Z" }
```

Métricas: `valorAcumulado = SUM(aportes)`, `valorRestante = max(alvo-acumulado,0)`,
`percentualProgresso = acumulado/alvo*100` e `atingida = acumulado >= alvo`.
O percentual pode ultrapassar 100%. São projeções atuais de progresso; não
implementam a taxa histórica nem o cumprimento no prazo da US58/RN-META-03.

A sugestão usa restante dividido pelos períodos restantes. Convenção técnica:
dias de calendário UTC, incluindo hoje e o dia-limite; semanas são
`ceil(diasRestantes/7)`, com semana parcial contando como período. Valores
apresentados têm duas casas, com arredondamento decimal da biblioteca existente.
Meta atingida retorna restante/sugestão zero. Meta não atingida cujo dia-limite
passou retorna `vencida: true`, faltante em `valorRestante` e `sugestaoAtual: null`,
sem dividir por zero. Alterar prazo/frequência ou aportar recalcula a sugestão.

**Relatório.** `GET /reports/expenses?startDate=2026-10-01&endDate=2026-10-31`
(sempre sob `/profiles/:profileId`) exige ambas as datas, válidas e não
invertidas. O período inclui os dois dias completos em UTC, consultando início
inclusivo/fim exclusivo. Retorna `periodo`, `totalGasto` e `categorias` com
`categoriaId`, `nome`, `valor` e `percentualDoTotal`. Só entram despesas
efetivadas do perfil. Receita/prevista/aporte não entram. Sem categoria é um
grupo de relatório `{ categoriaId: null, nome: "Sem categoria" }`; não é um
registro do catálogo. Período vazio retorna `totalGasto: "0.00"` e `categorias: []`.
Percentuais arredondados individualmente podem não somar exatamente 100%.

**Exportação.** `GET /exports/transactions?format=csv|xlsx&startDate=...&endDate=...`.
Formato é obrigatório; as duas datas são opcionais juntas. Sem datas, exporta
todas as transações do perfil. Exporta receitas/despesas, efetivadas/previstas,
pois é cópia das transações, distinta da distribuição de despesas. Transações
revertidas deixam de existir e não são exportadas.

Cabeçalhos legíveis: data/hora UTC, tipo, descrição, valor, categoria,
subcategoria, método de pagamento, essencialidade, status, gasto livre, anotação
e tags. Não há hashes, tokens, campos internos de auditoria, metas ou orçamentos.
Subcategorias/tags são limitadas ao perfil autorizado. Ordenação: instante e id
crescentes. Respostas têm Content-Type próprio e Content-Disposition attachment.

CSV é UTF-8 com BOM, vírgula, CRLF entre registros e aspas escapadas por
duplicação; vírgulas/aspas/quebras em campos são preservadas. Textos que poderiam
ser interpretados como fórmula por planilhas recebem apóstrofo no CSV. XLSX
usa células de texto, inclusive para dinheiro, preservando todos os dígitos do
contrato Decimal(19,2) além da precisão numérica nativa de Excel. Arquivos vazios
possuem cabeçalhos válidos. Os arquivos são gerados em memória, sem persistir
histórico ou arquivos no banco/disco.

RF28 pede compatibilidade com Excel, sem impor formato binário. A decisão
técnica foi usar XLSX real para um contrato explícito `format=xlsx`. Foi
adicionado `write-excel-file@4.1.1`, com uma dependência transitiva,
`fflate@0.8.3`. O writer tem export Node/CommonJS e geração de Buffer:
[documentação oficial](https://github.com/catamphetamine/write-excel-file).
O npm audit antes/depois permaneceu com seis avisos (um moderado e cinco altos);
nenhuma atualização ampla ou `audit fix --force` foi executada. A tabela antiga
do bootstrap registra os resultados daquele momento, não o audit atual.

**Dashboard.** `GET /dashboard?year=2026&month=10` exige ano/mês explícitos.
`saldoAtual` considera todas as receitas efetivadas menos todas as despesas
efetivadas do perfil, independentemente do mês selecionado. Perfil novo começa
em zero. `gastosDoMes` considera despesas efetivadas no mês solicitado.
`comparacaoComMesAnterior` inclui gastos de ambos os meses, diferença
atual-anterior e percentual de variação `(atual-anterior)/anterior*100`.
Se anterior for zero, percentual é `null`. Janeiro compara com dezembro do
ano anterior; no primeiro mês do intervalo de anos suportado (01/0001), sem
período anterior suportado, o comparador é zero.

`progressoDasMetas` reutiliza `GoalsService`, com as mesmas métricas da API de
metas, calculadas na data atual. `transacoesRecentes` contém no máximo cinco
transações do perfil, incluindo seu status, em ordem de instante/id decrescentes,
para abrir o detalhe. As leituras acompanham edição, status e reversão sem caches
ou agregados persistidos. Não há projeção futura, taxa de poupança, tendência
ou saldo médio diário.

**Decisões documentais.** A aba consolidada de RN-TRANS-01/backlog ainda cita
saldo inicial, enquanto a decisão registrada originalmente, o modelo vigente
e o pedido explícito desta task estabelecem início em zero. Seguiu-se o pedido
vigente sem reintroduzir campo de saldo inicial. A definição financeira de fuso
permanece pendente; foi mantida a convenção técnica UTC já usada no backend.
Não foram tratadas pendências anteriores de notificações/e-mail/concorrência.

Validação do bloco US10/13/14/15 em 01/10/2026: Prisma validate/generate/migrate
status, build, lint, TypeScript e `git diff --check` passaram. Sete suítes
unitárias passaram com 88 testes (30 novos); cinco suítes E2E completas passaram
no Neon com 40 testes (nove novos), preservando os 31 anteriores. O cenário CSV
foi reexecutado após acrescentar subcategoria e UUID de perfil em maiúsculas,
também com sucesso. A conferência final das 30 tabelas preservou sete categorias,
um usuário e seu perfil fora das fixtures; as outras 27 tabelas estavam vazias.
Não havia contas do domínio/prefixos das fixtures. A migration inicial continua
única, aplicada e com checksum correspondente ao arquivo local. Nenhum commit
foi realizado.

### Reflexão, recibos, recorrências e lembretes — Sprint 1

| Rastreabilidade | Implementação / testes |
|---|---|
| RF05/RF70 → US12 → RN-CAT-02/RN-REF-01/RN-REF-03 | `modules/reflection`, `common/clock.ts`; `reflection-recurrences.spec.ts` e `transaction-flow.e2e.ts` |
| RF12 → US19; sem RN específica | `modules/transactions/receipts.*`, `receipt-upload.ts`, `cloudinary-storage.service.ts`; `receipts.spec/e2e.ts`, `cloudinary-storage.spec.ts` e regressão do fluxo |
| RF20/RF64 → US24 → RN-TRANS-04/RN-NOT-01/RN-REC-01 | `modules/recurrences`, casos internos auditados de `TransactionsService`; mesmos testes |

Todas as rotas abaixo exigem JWT, ownership do perfil e recurso do mesmo
perfil. Categoria é global; subcategoria é validada pelo perfil e pela categoria.

| Método | Rota (prefixo `/profiles/:profileId`) |
|---|---|
| POST / GET | `/reflection-items` |
| GET / PATCH | `/reflection-items/:itemId` |
| POST / GET | `/transactions/:transactionId/receipts` |
| POST / GET | `/recurrences` |
| GET / PATCH | `/recurrences/:recurrenceId` |
| POST / GET | `/reminders` |
| PATCH | `/reminders/:reminderId` |

**Reflexão.** POST recebe `descricao` não branca e `duracaoHoras` inteiro
positivo opcional (padrão 48; limite do tipo inteiro do modelo). `entradaEm`
vem do relógio do servidor. `liberaEm` e `liberado` são calculados na leitura.
PATCH altera descrição/duração e mantém o instante original de entrada.
Não há DELETE nem relação artificial com Transacao. O mobile oferece a pergunta
antes da confirmação da despesa explicitamente `NAO_ESSENCIAL`: finalizar usa
o POST de transação existente; refletir cria somente ItemReflexao; voltar não
persiste nada. Reflexão não altera saldo, orçamento, relatório, dashboard ou cota.
A RN consolidada e o pedido vigente estabelecem 48h, embora RF05 traga 24h como
exemplo antigo; não se transformou esse exemplo em padrão.

**Recibos.** POST exige um arquivo JPEG/PNG no campo multipart `file`, até 5 MiB.
O backend autoriza usuário/perfil/DESPESA antes da leitura e do upload autenticado
ao Cloudinary; persiste somente URL HTTPS retornada, MIME e tipo RECIBO no Neon.
GET lista os metadados e o detalhe inclui `recibos`, mantendo `tags`.
Não há binário/base64 no banco, OCR ou tipo OUTRO. Falha de persistência tenta
remover o arquivo recém-criado. Configuração e contrato na seção abaixo.

**Recorrência.** POST recebe `tipoTransacao`, valor monetário em string Decimal
positiva com até duas casas, descrição não branca, `frequencia` SEMANAL/MENSAL/
ANUAL e `proximaOcorrencia` ISO com fuso. Categoria/subcategoria/método são
opcionais; subcategoria exige categoria compatível. `dataTermino` é DATE
`YYYY-MM-DD` opcional, inclusive; `ativa` assume true. Não há FX nem inferência
de gasto livre quando categoria é nula. PATCH aceita os mesmos campos.

Uma recorrência ativa mantém apenas a próxima Transacao PREVISTA, com
`recorrenciaId` e `ocorrenciaReferencia`. Quando vence, o caso de uso a efetiva,
avança o cursor e cria a próxima PREVISTA se dentro do término. Criação com
instante já vencido aguarda o próximo ciclo para efetivação. PREVISTA fica fora
dos cálculos financeiros atuais. Cada passo (efetivar + avançar + prever +
auditar) é uma transação do banco, com bloqueio da recorrência e a UNIQUE
existente `(recorrenciaId, ocorrenciaReferencia)`. Execuções repetidas ou
concorrentes não duplicam ocorrências nem auditorias. Se um passo falha, faz
rollback e o próximo ciclo tenta novamente; as demais recorrências continuam.

Decisões técnicas de calendário: UTC, semana = sete dias; mês/ano avança o
calendário mantendo horário e limita o dia ao último disponível. O cálculo
seguinte parte da ocorrência anterior (31/jan → 28/fev → 28/mar); o modelo não
persiste dia âncora/fuso. O fuso financeiro definitivo continua uma decisão
documental aberta. `dataTermino` inclui todo o último dia UTC.

**Processamento periódico.** `@nestjs/schedule@6.1.3` registra um Cron a cada
minuto, com `waitForCompletion: true`, enquanto o processo Nest está ativo.
Não depende de fila, Redis ou serviço externo. Recupera vencidas após reinício,
até 100 passos por recorrência/ciclo; cada passo tem timeout de transação de
15 segundos. O relógio é injetável. Em `NODE_ENV=test`, o gatilho é desabilitado;
os E2E chamam o mesmo Service com data controlada e apenas o perfil da fixture.
A cadência e o limite de lote são decisões técnicas. O deploy precisa manter
o processo da API em execução para o gatilho funcionar.

**Edição/cancelamento.** PATCH é atômico para template e próximas PREVISTAS.
Se há ocorrência vencida ainda pendente de processamento, responde 409 para
aguardar o scheduler; não altera silenciosamente o template de um vencimento.
Alterar valor/descrição/categoria/método edita somente as futuras PREVISTAS.
Alterar data/frequência remove a previsão antiga e materializa a nova próxima.
Cancelar usa PATCH `{ "ativa": false }`, remove PREVISTAS futuras e impede
nova geração. EFETIVADAS permanecem inalteradas. Reativar exige cursor futuro.
Essas remoções usam auditoria EXCLUSAO e os CASCADE existentes para filhos da
transação; o template permanece no banco. Não há DELETE de recorrência.

**Lembretes.** POST/PATCH recebe `transacaoId?`, `recorrenciaId?`, `notificarEm`
ISO com fuso e `ativo` (padrão true). Exige pelo menos uma origem válida; ambas
são permitidas e ambas são conferidas pelo perfil. GET lista configurações,
inclusive inativas. Não há envio push real nem criação automática de alertas
duplicados: esta etapa configura os dados para o mobile. Lembrete ligado só
ao template permanece configurado após cancelamento; ligado à transação é
removido por CASCADE quando ela é revertida/removida.

**Auditoria/reversão.** Geração e efetivação usam os casos do módulo Transacao,
com auditoria CRIACAO/EDICAO e snapshots somente dos campos escalares persistidos.
O snapshot inclui as FKs/referência da ocorrência, sem tags, recibos ou lembretes.
Registrar recibo não cria snapshot artificial. Reversão física continua
auditada e remove anexos/lembretes vinculados por CASCADE, mantendo o template.
Nenhum schema ou migration foi alterado nesta etapa.

Arquivos deste bloco: novo `common/clock.ts`, diretórios `modules/reflection`
e `modules/recurrences`, DTO/controller/service de recibos e dois arquivos de
testes. Alterados `app.module.ts`, `transactions.module.ts`,
`transactions.repository.ts`, `transactions.service.ts`, este README e
`package.json`/`package-lock.json`. As alterações anteriores foram preservadas.

Validação deste bloco em 02/10/2026: Prisma validate/generate/migrate status,
build, lint, TypeScript e `git diff --check` passaram. Oito suítes unitárias
passaram com 119 testes (31 novos, mantendo os 88 anteriores); seis suítes E2E
completas passaram no Neon com 51 testes (11 novos, mantendo os 40 anteriores).
Cobrem relógio/calendário, ownership, recibos, processamento repetido e
concorrente, idempotência, término, futuro/histórico, lembretes, CASCADE e
rollback de criação/processamento/edição quando a auditoria falha.
O Cron também foi registrado e acionado pelo Nest em teste sem banco.

A primeira execução dos novos E2E apontou duas expectativas de teste incorretas
(PREVISTA aparece na lista recente do dashboard e o orçamento retorna
`valorRealizado`) e a FK RESTRICT de OrcamentoCategoria na limpeza. As expectativas
e a ordem de limpeza foram corrigidas; os resíduos dessa execução foram removidos
somente das duas contas `flow-` identificadas. A repetição dos 11 cenários e a
suíte completa passaram com limpeza automática.

A leitura final das 30 tabelas confirmou sete categorias, um usuário e seu
perfil preexistentes; as demais 27 tabelas vazias e nenhuma conta de fixture.
Os hashes do usuário/perfil antes e depois da suíte completa coincidiram.
A única migration `20260928150948_init` permanece aplicada com checksum igual
ao arquivo local. Nenhum schema, migration ou `.env` foi modificado nesta task.

Nova dependência direta: `@nestjs/schedule@6.1.3`, compatível com CommonJS/Nest 11;
transitivas `cron@4.4.0`, `luxon@3.7.2` e `@types/luxon@3.7.6`. Não houve atualização
ampla de dependências nem correção dos seis avisos de audit preexistentes.
`git status --short`: 19 entradas modificadas e 25 não rastreadas, incluindo
trabalho anterior preservado; oito entradas não rastreadas foram acrescentadas
por este bloco (22 arquivos novos). Não foi feito commit.

Pendências históricas desta entrega: o provedor/upload físico de recibos foi
implementado posteriormente com Cloudinary; continuam infraestrutura
real de push e decisão definitiva do fuso financeiro. Recorrência com FX
continua fora do escopo e com regra pendente. Não se implementou consulta HTTP
de auditoria, OCR, PIN/biometria ou funcionalidades de Sprint 2/3.

### Dados demonstrativos do Leonardo — 02/10/2026

Após a validação da Sprint 1, foram inseridos dados fictícios persistentes para
teste manual no perfil existente do Leonardo, por solicitação do usuário.
A conferência de banco sem fixtures acima corresponde à etapa anterior a esta
população; os dados demo devem permanecer disponíveis para a integração.

- Usuario: `5c7d6752-8916-47bb-9895-0c719b239918`.
- PerfilFinanceiro: `2dc0a74f-ceec-4c68-8b8b-72a6e1ed78e4`.
- Período principal: outubro/2026; setembro/2026 tem histórico para comparação.
- 20 transações: 15 EFETIVADAS e cinco PREVISTAS (três delas recorrentes).
- Três tags, três subcategorias, um orçamento com seis categorias, uma cota,
  duas regras de gasto, duas metas com dois aportes, dois itens de reflexão,
  três recorrências SEMANAL/MENSAL/ANUAL e dois lembretes.
- Um metadado RECIBO usa URL de exemplo; não aponta para um arquivo físico.
- Saldo fictício: `5507.95`; gastos de outubro: `2262.05`; setembro: `2380.00`.

O script `prisma/seed-demo.cjs` é separado do seed oficial do catálogo e usa
os Services existentes, preservando ownership, Decimal, auditoria e snapshots.
Atualização de 04/10/2026: o comando principal é `seed:apresentacao`; `seed:demo`
permanece como alias de compatibilidade. Novos dados usam nomes naturais como
Salário, Supermercado, Viagem e Fone de ouvido, sem prefixos de demonstração ou
período. Tags: `#Pessoal`, `#Essencial`, `#Planejado`. Subcategorias: Supermercado,
Aplicativos e Cinema. Não há anotação técnica ou criação de recibo com URL de
exemplo; adicione imagens reais pelo app para apresentar anexos.

As transações são reutilizadas por perfil, descrição, tipo, valor e data/hora;
metas/reflexões/recorrências são reutilizadas por perfil e nome/descrição.
Objetos editados ou cancelados não são restaurados. Os passos confirmados podem
ser retomados após falha; o seed completo não é uma única transação. O script
também reconhece os prefixos antigos do mesmo período para reutilizar esses
registros. Essa mudança não renomeia automaticamente dados antigos já gravados;
a limpeza dos rótulos existentes é uma operação separada sobre o perfil escolhido.

Execute dentro de `backend/`:

```powershell
npm run seed:apresentacao -- --user-id 5c7d6752-8916-47bb-9895-0c719b239918 --profile-id 2dc0a74f-ceec-4c68-8b8b-72a6e1ed78e4 --reference-date 2026-10-02
```

UUIDs e data são argumentos explícitos; o script verifica o vínculo da conta
com o perfil antes de inserir. Planejamento e cota existentes são preservados.
Conta, senha, perfil e as sete categorias globais foram comparados antes/depois
e permaneceram intactos. Cron é desabilitado somente no processo do seed.
Nenhum schema, migration ou credencial foi alterado.

Rastreabilidade dos exemplos: US01/02/03/44 (transações/tags/reversão auditada),
US05 (subcategorias), US06/29/40/45 (planejamento/limites/cota), US10 (metas),
US12 (reflexão), US19 (recibo), US24 (recorrência/lembretes) e US13/14/15
(relatórios/exportação/dashboard), pelos contratos da Sprint 1 já implementados.
Valores e descrições do dataset são exemplos de demonstração, não novas RN.

### Avaliação da integração com o mobile

A estrutura `Screen → Service → Mock` já separa dados da apresentação.
Os componentes, tokens e navegação podem ser reaproveitados. A integração
concentra trabalho nos services, contexto de sessão e carregamento das telas:

- Os services financeiros e auth atuais usam mocks em memória, sem HTTP.
- `AppSessionContext` usa login local síncrono; deve passar a obter conta,
  JWT e UUIDs reais por `POST /auth/login`, `GET /me` e `GET /profiles`.
- Leituras hoje síncronas em render/useMemo precisam de carregamento
  assíncrono, erro, vazio e atualização após uma operação de escrita.
- O contrato mobile usa centavos, enums em inglês, data/hora separadas e tags
  como strings; a API usa Decimal em string, enums em português, ISO e tags
  como entidades. Adaptação nos services evita espalhar essas conversões na UI.
- Dashboard/orçamento/metas/relatórios devem consumir as projeções da API;
  o processamento de recorrência passa a ser responsabilidade do backend.
- Recorrência atual do mobile modela apenas mensal; leitura/configuração
  deve considerar SEMANAL/MENSAL/ANUAL conforme o contrato exposto.
- Exportação real baixa o CSV/XLSX do backend. O `receiptUri` local deve ser
  enviado como arquivo multipart ao POST de recibos; Cloudinary foi definido
  e implementado no backend. A integração de câmera/seleção no mobile permanece pendente.
- PIN/biometria continuam locais e separados do login remoto.

Avaliação: esforço moderado na camada de dados e no estado das telas, com
reaproveitamento da apresentação existente. O mobile ainda não foi integrado
nesta tarefa e continuará exibindo mocks até essa mudança. Não se introduziu
Redux, arquitetura paralela ou dependência de frontend.

## Modelo e rastreabilidade

A fonte oficial é `../docs/Orca_Finance_Modelo_de_Dados.md`. O schema mantém os
30 modelos físicos já descritos e usa os nomes de tabelas, colunas, índices e
constraints do SQL PostgreSQL de referência por `@map`, `@@map` e `map`.
O schema por si só não implementa regras de negócio; as regras desta etapa estão
nos Services de conta, perfil, categoria, transação, tags, planejamento, metas
e leituras financeiras.

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
catálogo, subcategorias, transações manuais, tags, auditoria, reversão e planejamento
mensal (US06/29/40/45), metas, relatórios, exportação e dashboard (US10/13/14/15).
Não se presume que FKs isoladamente garantam o isolamento entre
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

O PostgreSQL de desenvolvimento está configurado no Neon e a migration inicial
foi aplicada. A conexão fica no `.env` local; o CLI Neon não precisa estar
vinculado para Prisma usar `DATABASE_URL`.
A estratégia atual de autenticação usa somente access token JWT;
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

## Histórico de aportes — decisão expressa de fechamento

`GET /profiles/:profileId/goals/:goalId/contributions` retorna `{ id, metaId, valor, dataHora }[]`, mais recentes primeiro, reutilizando AporteMeta e validando JWT → perfil → meta. Sem aportes: `[]`; meta de outro perfil: 404. RF04/US10 foi ampliada por decisão expressa do aluno, mantendo RN-META-01/02: aporte não gera Transacao. Veja [decisões](../docs/Orca_Finance_Fechamento_Mobile.md). Validação atual: 157 unitários e 70 E2E contra Neon.
