# Orca Finance — Arquitetura Front-end Mobile

> Documento de decisão técnica para a implementação do front-end do Orca Finance.
>
> Escopo atual: Sprint 1 com 18 User Stories, incluindo cadastro/autenticação de conta (US60), focada na implementação, navegação e validação das telas no Android. Este documento não redefine requisitos de produto; ele organiza tecnicamente as decisões já consolidadas e mantém explícitas somente as pendências técnicas ou de UX ainda abertas.

---

## 1. Objetivo

Definir uma arquitetura front-end simples, rastreável e evolutiva para que as telas da Sprint 1 possam ser implementadas sem acoplar a interface aos dados mockados nem antecipar desnecessariamente a arquitetura de backend.

A estrutura deve permitir que, em etapas futuras, a fonte de dados mockada seja substituída por API/persistência real com o menor impacto possível sobre as telas e componentes visuais.

---

## 2. Fontes de decisão do front-end

A implementação deve respeitar, nesta ordem de responsabilidade:

1. requisitos funcionais originais do projeto;
2. regras de negócio consolidadas;
3. backlog revisado e vínculos RF → US;
4. priorização/sprints vigente;
5. fluxo de telas da Sprint 1;
6. Design System atualizado;
7. este documento de arquitetura front-end.

Este documento define **como implementar** o front-end. Ele não pode criar comportamento funcional que não exista nas fontes acima. Quando houver divergência entre uma regra de negócio consolidada e um documento visual ainda não sincronizado, a regra consolidada prevalece para o comportamento funcional, e o documento visual deve ser atualizado.

---

## 3. Escopo da primeira entrega

A Sprint 1 vigente contém 18 User Stories:

`US01, US02, US03, US05, US06, US10, US12, US13, US14, US15, US19, US24, US29, US37, US40, US44, US45 e US60`.

A primeira entrega prioriza:

- implementação visual das telas já definidas;
- navegação entre telas e estados complementares;
- cadastro/login da US60 com comportamento simulado enquanto não houver backend real;
- reutilização de componentes;
- aplicação fiel do Design System, respeitando as regras de negócio consolidadas;
- uso de dados mockados centralizados;
- estados necessários para demonstrar os fluxos previstos;
- execução e validação no Android Emulator.

Nesta fase, não é necessário implementar de forma definitiva:

- backend;
- API remota;
- banco de dados definitivo;
- sincronização entre dispositivos;
- autenticação remota real no servidor;
- notificações push reais;
- exportação real de arquivos;
- câmera/OCR reais, exceto se exigidos posteriormente para demonstração.

A US60 deve ser demonstrável por uma camada de autenticação mockada, preservando suas regras funcionais: nome, e-mail e senha obrigatórios; e-mail como identificador único de login; criação automática do primeiro perfil com saldo R$ 0 e moeda-base BRL.

Quando uma integração real ainda não existir, a tela pode simular seu estado utilizando services/mocks, desde que não introduza nova regra de negócio.

---

## 4. Stack definida

### 4.1 Base

- **React Native** — tecnologia principal do aplicativo mobile.
- **Expo** — ambiente/toolchain utilizado no desenvolvimento do front-end.
- **Android** — plataforma prioritária da primeira entrega.
- **Android Studio / Android Emulator** — ambiente de validação da entrega.

O Expo Web pode ser usado como apoio durante desenvolvimento rápido, mas **não deve ser a referência final de validação visual ou comportamental**, pois componentes e APIs podem apresentar diferenças entre navegador e ambiente nativo Android.

### 4.2 Linguagem e navegação

Decisões fechadas para a implementação:

- **TypeScript** — linguagem padrão do front-end.
- **Expo Router** — estratégia de navegação baseada em arquivos.

A escolha do Expo Router foi feita por aderência ao ecossistema Expo e por reduzir configuração manual de rotas. A organização por arquivos também torna a árvore de navegação explícita e facilita a leitura do fluxo durante a apresentação acadêmica.

O projeto deverá utilizar tipagem para entidades, parâmetros de rota, dados mockados e contratos dos services sempre que aplicável. Evitar o uso de `any` como solução padrão.

### 4.3 Decisões técnicas não bloqueantes

Os itens abaixo podem ser definidos durante o bootstrap/evolução do projeto e **não impedem o início da implementação das telas**:

- **versão do Expo SDK** — utilizar a versão estável criada/configurada no bootstrap do projeto e registrá-la no `package.json`;
- **bibliotecas de testes automatizados** — definir quando os primeiros testes automatizados forem introduzidos;
- **solução de gerenciamento de estado global** — somente adotar caso surja necessidade real de estado compartilhado entre áreas.

---

## 5. Princípios arquiteturais

### 5.1 Simplicidade proporcional à entrega

A arquitetura deve resolver o problema atual sem antecipar camadas complexas que ainda não possuem responsabilidade real.

Para a primeira entrega, evitar adicionar sem necessidade comprovada:

- Redux/Zustand ou outro estado global;
- injeção de dependência complexa;
- Clean Architecture completa;
- múltiplas camadas de DTO/mappers sem API real;
- abstrações genéricas sem uso concreto.

### 5.2 Separação entre interface e dados

Uma tela não deve conter os valores de demonstração espalhados diretamente no JSX e não deve depender diretamente de um arquivo JSON específico.

O Design System atualizado estabelece a arquitetura conceitual:

```text
UI / Screen
  ↓
ViewModel / Controller
  ↓
Repository / Service
  ↓
Mock Data Source
```

Para a primeira entrega, essa ideia será aplicada de maneira leve. Não é obrigatório criar uma classe formal de ViewModel para cada tela se isso não agregar valor.

Estrutura mínima adotada:

```text
Screen / Hook de tela
  ↓
Service
  ↓
Mock Data Source
```

Evolução esperada:

```text
Screen / Hook de tela
  ↓
Service / Repository
  ↓
API / Persistência
```

### 5.3 Componentização por responsabilidade

Componentes reutilizáveis devem concentrar padrões visuais e comportamentos repetidos.

Uma tela deve principalmente:

- organizar a composição da página;
- solicitar/receber dados;
- controlar estado local da interface;
- disparar ações de navegação;
- delegar apresentação repetida para componentes.

### 5.4 Regra de negócio fora de componentes puramente visuais

Um componente visual reutilizável não deve decidir regras de negócio específicas do domínio.

Exemplo:

- `ProgressBar` pode receber percentual e estado/cor;
- a regra que determina o percentual do orçamento deve permanecer na camada responsável pelos dados/lógica da funcionalidade.

---

## 6. Estrutura inicial de diretórios

Com TypeScript e Expo Router definidos, a estrutura inicial recomendada é:

```text
src/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── transacoes.tsx
│   │   ├── planejamento.tsx
│   │   └── relatorios.tsx
│   ├── transacao/
│   │   ├── nova.tsx
│   │   └── [id].tsx
│   ├── categorias/
│   │   └── index.tsx
│   ├── metas/
│   │   ├── index.tsx
│   │   ├── nova.tsx
│   │   └── [id].tsx
│   ├── seguranca/
│   │   └── index.tsx
│   └── configuracoes/
│       └── index.tsx
├── assets/
├── components/
│   ├── common/
│   └── domain/
├── data/
│   └── mocks/
├── hooks/
├── services/
├── theme/
├── types/
└── utils/
```

A árvore acima é uma **estrutura inicial**, não uma obrigação de criar antecipadamente todas as rotas. Novos arquivos devem ser adicionados conforme as telas do fluxo forem implementadas.

### 6.1 Responsabilidades

#### `src/app/`
Contém exclusivamente a estrutura de rotas do Expo Router e a composição de cada rota.

Diretrizes:
- `_layout.tsx` define layouts/navegadores compartilhados;
- `(tabs)/` representa o grupo da bottom navigation e **não faz parte do caminho lógico da rota**;
- rotas dinâmicas como `[id].tsx` recebem identificadores estáveis dos mocks/services;
- arquivos de rota devem permanecer enxutos e delegar componentes reutilizáveis para `components/`;
- não concentrar regras de negócio nos arquivos de rota.

#### `assets/`
Arquivos estáticos utilizados pelo aplicativo.

Exemplos:
- imagens;
- fontes locais, se utilizadas;
- recursos visuais próprios.

#### `components/common/`
Componentes genéricos reutilizados em vários domínios.

Exemplos:
- `AppCard`;
- `PrimaryButton`;
- `SecondaryButton`;
- `AppInput`;
- `ProgressBar`;
- `BottomSheetContainer`;
- `ConfirmModal`;
- `ScreenHeader`.

#### `components/domain/`
Componentes reutilizáveis, mas específicos do Orca Finance.

Exemplos:
- `TransactionItem`;
- `BudgetCategoryCard`;
- `GoalCard`;
- `FinancialSummaryCard`.

Se a quantidade de componentes crescer, `domain/` pode posteriormente ser subdividido por domínio (`transactions/`, `planning/`, `goals/` etc.). Não criar essa subdivisão antes de existir necessidade concreta.

#### `data/mocks/`
Fonte centralizada dos dados usados durante a fase sem API.

Os arquivos serão TypeScript e podem ser divididos por domínio:

```text
data/mocks/
├── account.mock.ts
├── profile.mock.ts
├── transactions.mock.ts
├── categories.mock.ts
├── budgets.mock.ts
├── goals.mock.ts
└── reports.mock.ts
```

#### `hooks/`
Lógica reutilizável de estado de interface ou adaptação entre rotas/componentes e services.

Criar hooks somente quando houver reutilização ou quando isso simplificar claramente a tela.

#### `services/`
Interface de acesso aos dados usados pelas telas.

Na primeira entrega, os services leem mocks. Posteriormente, podem passar a chamar API/repository sem exigir alterações estruturais em cada rota/tela.

#### `theme/`
Tokens e estilos globais derivados do Design System.

Deve concentrar pelo menos:
- cores;
- tipografia;
- espaçamento;
- radius;
- dimensões comuns;
- constantes semânticas de aparência.

#### `types/`
Contratos TypeScript compartilhados.

Exemplos:
- `Account`;
- `AuthSession`;
- `Profile`;
- `Transaction`;
- `Category`;
- `Budget`;
- `Goal`;
- tipos auxiliares de filtros e períodos.

No contrato `Transaction`, o RF36/US02 exige um campo de anotação separado da descrição. Conceitualmente:

```ts
interface Transaction {
  // demais campos do domínio...
  description: string;
  annotation?: string;
}
```

`description` continua sendo o texto principal/obrigatório do cadastro manual; `annotation` é opcional e deve ser preservado pelo mock/service, exibido no detalhe quando existir e editável sem alterar a descrição. O limite de caracteres não deve ser inventado sem requisito ou decisão posterior.

Evitar duplicar interfaces equivalentes em múltiplos arquivos.

#### `utils/`
Funções puras e auxiliares compartilhados.

Exemplos possíveis:
- formatação monetária;
- formatação de datas;
- cálculos puramente apresentacionais.

Não transformar `utils` em depósito de regras de negócio.

---

## 7. Design System como contrato de implementação

O arquivo `Orca_Finance_Design_System_Atualizado.md` é a fonte visual de verdade.

### 7.1 Tokens principais

A implementação deve centralizar no `theme` os valores definidos no Design System, evitando repetir códigos hexadecimais diretamente em cada tela.

Principais tokens já consolidados:

```text
Brand          #0D3B66
Primary        #2E76D6
Primary Tint   #EAF2FC
Positive       #1E8F6F
Positive Tint  #E1F5EE
Negative       #D64545
Warning        #E8A33D
Text Primary   #10202E
Text Secondary #64748B
Nav Inactive   #94A3B8
Border         #E2E8F0
Background     #F7F9FC
Surface        #FFFFFF
```

Fonte padrão: **Manrope**.

Iconografia de referência: **Tabler Icons, estilo outline**.

### 7.2 Componentes visuais oficiais

Devem ser preferencialmente implementados como componentes reutilizáveis:

- cards;
- botão primário;
- botão secundário;
- ação destrutiva;
- inputs;
- segmented controls/toggles;
- barras de progresso;
- bottom sheets;
- modais de confirmação;
- itens de lista;
- navegação inferior.

### 7.3 Sombras

Não usar sombra como padrão visual de separação. A identidade atual utiliza principalmente borda e diferença de superfície/fundo.

---

## 8. Arquitetura de navegação

### 8.1 Bottom navigation oficial

A navegação principal está consolidada como:

```text
Início | Transações | + | Planejamento | Relatórios
```

Responsabilidades:

- **Início** → Dashboard;
- **Transações** → lista, busca, filtros, detalhe e acesso contextual a categorias;
- **+** → nova transação;
- **Planejamento** → orçamento, metas, limites, gastos livres e planejado x realizado;
- **Relatórios** → gráficos e exportação.

**Perfil/Configurações não pertence à bottom navigation.** O acesso ocorre pelo avatar/ação superior.

### 8.2 Tipos de destino

A arquitetura visual usa três formas de transição:

1. **Tela completa** — quando existe um contexto próprio de navegação;
2. **Bottom sheet** — para tarefas complementares curtas;
3. **Modal de confirmação** — para ações destrutivas/irreversíveis.

Bottom sheets já definidos no projeto:

- login da US60;
- criação de conta da US60;
- filtros de transação;
- registrar aporte;
- exportar dados.

Modal de confirmação já definido:

- reversão de transação.

### 8.3 Organização das rotas com Expo Router

A navegação deve refletir o fluxo oficial usando a convenção de arquivos do Expo Router.

O `index.tsx` da raiz funciona como porta de entrada: sem sessão autenticada, apresenta Boas-vindas/Login/Cadastro; com sessão autenticada, encaminha para o contexto do perfil ativo e para `(tabs)`. Login e criação de conta podem permanecer como bottom sheets locais da tela de entrada, sem exigir rotas independentes.

Estrutura conceitual:

```text
app/
├── _layout.tsx                  # Stack raiz / configuração global
├── index.tsx                    # entrada do app / redirecionamento conforme fluxo
├── (tabs)/
│   ├── _layout.tsx              # bottom navigation oficial
│   ├── index.tsx                # Início / Dashboard
│   ├── transacoes.tsx           # Lista de transações
│   ├── planejamento.tsx         # Planejamento / orçamento
│   └── relatorios.tsx           # Relatórios
├── transacao/
│   ├── nova.tsx                 # criação de transação
│   └── [id].tsx                 # detalhe da transação
├── categorias/
│   └── index.tsx
├── metas/
│   ├── index.tsx
│   ├── nova.tsx
│   └── [id].tsx
├── recorrencia/
│   └── configurar.tsx
├── reflexao/
│   └── index.tsx
├── seguranca/
│   └── index.tsx
└── configuracoes/
    └── index.tsx                # hub ainda pendente de definição visual
```

Bottom sheets e modais não precisam obrigatoriamente virar rotas independentes. Quando forem estados estritamente locais da tela, podem ser controlados pelo componente/rota de origem. Caso posteriormente seja útil torná-los rotas modais, a mudança deve preservar o fluxo definido no documento de telas.

### 8.4 Parâmetros de rota

Rotas de detalhe devem utilizar identificadores estáveis, e não texto visível ou posição do array.

Exemplo conceitual:

```text
/transacao/tx-001
/metas/meta-001
```

O arquivo `[id].tsx` deve receber o parâmetro, solicitar o dado correspondente ao service e tratar de forma visualmente segura a ausência do registro. O comportamento funcional definitivo para erros permanece condicionado às decisões de estado de interface do projeto.

A futura tela-hub de Perfil/Configurações permanece pendente no fluxo atual.

---

## 9. Estratégia de dados mockados

### 9.1 Fonte única de dados de demonstração

Os valores exibidos por diferentes telas devem vir do mesmo cenário mockado.

Não criar valores inconsistentes por tela para o mesmo usuário/período.

Exemplos já padronizados no Design System:

- saldo atual: `R$ 3.240,80`;
- gastos do mês: `R$ 1.180,00`;
- transação “Supermercado Extra”: `R$ 187,00`;
- meta “Viagem”: `R$ 2.250,00 / R$ 5.000,00` (`45%`).

Esses valores devem existir no dataset, e as telas devem derivá-los dele sempre que possível.

### 9.2 Regra de acesso

Evitar:

```text
Screen → importa diretamente transactions.mock
```

Preferir:

```text
Screen → transactionService → transactions.mock
```

Exemplo conceitual:

```text
getTransactions()
getTransactionById(id)
getDashboardSummary()
getBudgetOverview()
getGoals()
getGoalById(id)
getReportData(period)
```

Nesta primeira fase essas operações podem ser síncronas ou simular comportamento assíncrono somente quando necessário para testar estados de interface.

### 9.3 IDs e relacionamentos

Os mocks devem usar IDs estáveis para permitir navegação e relacionamento entre telas.

Exemplo conceitual:

```text
account.id → perfis pertencentes à conta
session.accountId → account.id
activeProfileId → profile.id
transaction.profileId → profile.id
transaction.categoryId → category.id
goal.profileId → profile.id
goal.id → detalhe/aportes da meta
```

No cadastro mockado da US60, o primeiro perfil é criado automaticamente a partir do nome da conta/usuário, inicia sem dados financeiros, com saldo `R$ 0` e moeda-base `BRL`.

Isso evita encontrar uma transação por texto/posição de array e aproxima o fluxo do comportamento de uma API real.

---

## 10. Estado da aplicação

### 10.1 Estado local primeiro

Na primeira entrega, preferir estado local da tela para:

- campos de formulário;
- abrir/fechar modal ou bottom sheet;
- filtros temporários;
- seleção de período;
- toggle/segmented control;
- expansão de categoria/subcategoria.

### 10.2 Estado compartilhado

Não adotar biblioteca global somente porque o aplicativo futuramente poderá precisar dela.

Se durante a implementação surgir estado que realmente precise ser compartilhado entre múltiplas áreas, a necessidade deve ser registrada e então avaliada.

### 10.3 Mocks mutáveis durante demonstração

Caso seja necessário demonstrar “criar”, “editar”, “aportar” ou “reverter” sem backend, a implementação pode utilizar estado em memória durante a execução do app.

Essa simulação deve ser claramente separada da persistência definitiva e não deve criar regras além das previstas no backlog/regras de negócio.

### 10.4 Sessão autenticada e perfil ativo

Com a inclusão da US60, `sessão autenticada`, `accountId` e `activeProfileId` passam a ser estado compartilhado real entre a entrada do aplicativo e as áreas autenticadas.

Para a Sprint 1, a solução recomendada é um **React Context leve no layout raiz**, sem biblioteca externa de estado global.

Motivo e trade-off:

- estado local não é suficiente, pois sessão e perfil ativo são consumidos por múltiplas rotas;
- Context nativo resolve o escopo atual com pouca complexidade;
- Redux/Zustand ou solução equivalente continua desnecessária enquanto não existir volume maior de estado global.

Responsabilidades mínimas do contexto de sessão:

```text
signIn(email, senha)
signUp(nome, email, senha)
signOut()
account
activeProfileId
setActiveProfile(profileId)
```

Nesta entrega, `signIn` e `signUp` podem delegar para um `authService` mockado. A futura troca por backend não deve exigir que as telas conheçam diretamente a fonte de autenticação.

---

## 11. Estados de interface

Alguns **estados visuais** ainda não possuem representação final no Design System:

- loading;
- empty state;
- erro de rede/API;
- erro de validação;
- sucesso após criação/edição;
- indisponibilidade de biometria;
- permissão de câmera/notificação negada;
- falha de exportação;
- apresentação visual de meta vencida não concluída.

A regra de negócio da meta vencida já está consolidada: informar que a meta não foi atingida e o valor faltante; o usuário pode alterar a data-limite para continuar, recalculando a sugestão. Portanto, o que permanece aberto aqui é somente a apresentação visual desses estados.

---

## 12. Rastreabilidade da Sprint 1

A implementação deverá preservar o encadeamento:

```text
RF / decisão de produto → User Story → Regra de negócio → Tela/Estado → Componente → Task → Implementação → Teste
```

A US60 é a exceção metodológica desta versão: ela foi adicionada depois dos 71 RFs originais e, portanto, deve ser rastreada como **User Story sem RF original explícito**, vinculada às RN-ID-01, RN-ID-02, RN-ID-03 e RN-ID-04 e com impacto em RF11, RF16 e RF48. Não criar RF72 implicitamente.

Mapa das 18 User Stories da Sprint 1:

| Domínio/Tela | RF principal(is) | User Story | RN vinculadas | Teste front-end mínimo nesta entrega |
|---|---|---|---|---|
| Nova transação | RF01 | US01 | RN-TRANS-01, RN-TRANS-02 | preencher obrigatórios, salvar mock e refletir novo registro |
| Detalhamento da transação | RF21, RF36, RF58 | US02 | nenhuma RN específica | cadastrar/exibir/editar tags, **anotação**, método de pagamento e classificações; anotação é opcional e distinta da descrição |
| Lista/busca/filtros | RF13, RF58 | US03 | nenhuma RN específica | busca/filtro atualiza a lista mockada |
| Categorias/subcategorias | RF02 | US05 | RN-CAT-01 | expandir categoria e criar subcategoria |
| Orçamento mensal | RF03, RF24 | US06 | RN-ORC-01, RN-ORC-02 | 75% inicia estado de proximidade; >100% excedido |
| Metas | RF04 | US10 | RN-META-01, RN-META-02 | lista → detalhe → criação/aporte; meta vencida informa faltante |
| Reflexão antes da compra | RF05, RF70 | US12 | RN-CAT-02, RN-REF-01, RN-REF-03 | não essencial alcança reflexão; padrão 48h configurável |
| Relatórios | RF06 | US13 | nenhuma RN específica | período altera dados/gráficos mockados |
| Exportação | RF07, RF28 | US14 | nenhuma RN específica | abrir/fechar bottom sheet e selecionar formato |
| Dashboard | RF08 | US15 | RN-TRANS-01, RN-META-01 | dados consistentes do mesmo perfil/mock |
| Recibo | RF12 | US19 | nenhuma RN específica | ação/estado de comprovante presente no fluxo |
| Recorrência/lembrete | RF20, RF64 | US24 | RN-TRANS-04, RN-NOT-01, RN-REC-01 | salvar recorrência; alteração/cancelamento afeta somente futuro |
| Limites e alertas | RF27, RF54 | US29 | RN-NOT-01, RN-NOT-02, RN-LIM-01 | limite diário e regra de categoria com parâmetros do usuário |
| Bloqueio local | RF48 | US37 | separação de RN-ID-01 | alternância biometria ↔ PIN sem substituir login remoto |
| Planejado x realizado | RF55 | US40 | RN-ORC-02 | período e dados exibidos de forma consistente |
| Reversão de transação | RF40 | US44 | RN-TRANS-03, RN-AUD-01 | confirmação remove registro ativo e preserva snapshot de auditoria |
| Gastos livres | RF57 | US45 | RN-ORC-02, RN-ORC-05 | somente despesa explicitamente marcada consome cota mensal |
| Cadastro/autenticação | sem RF original explícito | US60 | RN-ID-01, RN-ID-02, RN-ID-03, RN-ID-04 | cadastro/login mockado; e-mail único; primeiro perfil automático BRL/R$0 |

Os critérios de aceitação detalhados devem ser derivados dessas fontes no refinamento de cada User Story. Este documento não substitui o backlog.

---

## 13. Pendências que não devem ser resolvidas implicitamente no código

### 13.1 Técnicas não bloqueantes

- biblioteca de testes automatizados;
- versão efetivamente utilizada do Expo SDK, a registrar após o bootstrap;
- backend/autenticação remota real e persistência definitiva;
- necessidade futura de biblioteca de estado global além do Context de sessão.

**TypeScript, Expo Router e Context leve para sessão/perfil ativo já estão definidos para a Sprint 1.**

### 13.2 UX/navegação

- edição de transação inline ou reutilização do formulário de cadastro;
- destino definitivo após criar transação;
- destino definitivo após criar meta;
- tela/lista de itens em reflexão;
- modal/tela final de criar/editar subcategoria;
- tela-hub formal de Perfil/Configurações.

Esses itens são decisões de UX e não reabrem as regras de negócio.

### 13.3 Regras de negócio da Sprint 1

Não há, na versão consolidada atual, regra de negócio bloqueante para iniciar a Sprint 1. Foram fechadas, entre outras, as decisões de:

- consumo explícito da cota de gastos livres;
- reflexão com duração padrão de 48h configurável;
- recorrência alterando somente ocorrências futuras;
- comportamento de meta vencida;
- auditoria com snapshot integral antes da exclusão;
- limites configuráveis com período/base definidos por regra;
- cadastro com nome, e-mail e senha e e-mail único como login;
- criação automática do primeiro perfil com saldo R$ 0 e BRL.

Quando surgir lacuna durante a implementação, verificar primeiro requisito, RN e US antes de registrar nova decisão.

---

## 14. Estratégia de testes da primeira entrega

Mesmo sendo uma entrega predominantemente visual, cada tela deve ser validada em dois níveis.

### 14.1 Validação visual

No Android Emulator verificar:

- alinhamento;
- espaçamento;
- tipografia;
- cores semânticas;
- áreas de toque;
- scroll;
- comportamento com teclado;
- Safe Area/Status Bar;
- bottom navigation;
- modal/bottom sheet;
- diferentes alturas de conteúdo.

### 14.2 Validação de navegação

Para cada ação principal definida no fluxo:

```text
Dado que estou na tela de origem
Quando executo a ação
Então o app abre a tela/estado de destino previsto
E preserva os dados necessários para continuidade do fluxo
```

Exemplo já definido pelo documento de fluxo:

```text
RF13
→ US03
→ Lista de transações
→ tocar em filtro
→ Bottom sheet de filtros
→ aplicar filtros
→ lista atualizada
```

Para a US60, validar ao menos:

```text
Cadastro válido → cria conta mockada → cria primeiro perfil BRL/R$0 → abre Início
E-mail duplicado → cadastro recusado com erro de validação
Login válido → cria sessão → seleciona/ativa perfil → abre área autenticada
Bloqueio biométrico/PIN → protege acesso local, sem substituir login de conta
```

### 14.3 Testes automatizados

A ferramenta de testes ainda é decisão pendente e não bloqueia a primeira implementação visual. Não fixar Jest, React Native Testing Library ou outra biblioteca neste documento até a estratégia correspondente ser formalizada.

Mesmo antes dessa escolha, manter os componentes testáveis: evitar lógica extensa diretamente no JSX, usar funções puras quando aplicável e manter dados de domínio fora dos componentes visuais.

---

## 15. Critério de implementação de uma nova tela

Antes de implementar qualquer tela:

1. identificar o RF relacionado;
2. localizar a User Story oficial;
3. verificar critérios de aceitação;
4. verificar regras de negócio e pendências;
5. localizar a tela de referência e o fluxo de entrada/saída;
6. identificar componentes existentes reutilizáveis;
7. identificar dados necessários no mock;
8. implementar a tela;
9. testar navegação;
10. validar visualmente no Android Emulator.

Se faltar informação nos passos 1–5, registrar como **decisão pendente** em vez de inventar comportamento.

---

## 16. Definição de pronto — tela da primeira entrega

Uma tela pode ser considerada pronta para a entrega visual quando:

- corresponde ao fluxo oficial;
- respeita o Design System;
- reutiliza componentes existentes quando aplicável;
- não contém dados de cenário duplicados e inconsistentes;
- obtém dados pelo service/mock previsto, quando houver dados de domínio;
- navega para os destinos já definidos;
- pendências de produto não foram transformadas em regras definitivas;
- foi validada no Android Emulator;
- possui ao menos os testes manuais de navegação necessários ao fluxo apresentado.

---

## 17. Decisões consolidadas nesta versão

| Decisão | Status |
|---|---|
| React Native | Definido |
| Expo | Definido |
| Android como plataforma prioritária da entrega | Definido |
| Android Emulator para validação | Definido |
| Sprint 1 com 18 US, incluindo US60 | Definido |
| Bottom nav: Início / Transações / + / Planejamento / Relatórios | Definido |
| Perfil/Configurações fora da bottom nav | Definido |
| Design System como fonte visual, subordinado às RN para comportamento funcional | Definido |
| Dataset mock centralizado | Definido |
| Tela desacoplada do arquivo de mock por camada de service | Definido |
| Estado local como primeira opção | Diretriz arquitetural |
| Sessão + perfil ativo em React Context leve | Definido para Sprint 1 |
| TypeScript | Definido |
| Expo Router | Definido |
| Rotas baseadas em arquivos (`src/app`) | Definido |
| Parâmetros de detalhe por ID estável | Definido |
| Conta autenticada → um ou mais perfis | Regra consolidada |
| E-mail como login único | Regra consolidada |
| Primeiro perfil automático, BRL e saldo R$ 0 | Regra consolidada |
| Gastos livres somente por marcação explícita | Regra consolidada |
| Proximidade do orçamento inicia em 75% | Regra consolidada |
| Reflexão padrão 48h, configurável | Regra consolidada |
| Recorrência: alterações/cancelamentos somente no futuro | Regra consolidada |
| Reversão: exclusão do registro ativo + snapshot integral de auditoria | Regra consolidada |
| Expo SDK | Registrar versão usada no bootstrap |
| Biblioteca de testes | Pendente / não bloqueante |

---

## 18. Checklist antes de iniciar o desenvolvimento

Não há decisão arquitetural bloqueante restante para iniciar as telas. Antes do primeiro desenvolvimento, realizar somente o bootstrap técnico mínimo:

1. criar o projeto Expo com TypeScript e Expo Router;
2. registrar no `package.json`/lockfile a versão efetivamente utilizada do Expo e das dependências;
3. confirmar que o projeto abre no Android Emulator antes de implementar telas;
4. configurar a fonte Manrope conforme o Design System;
5. configurar uma implementação compatível dos Tabler Icons em estilo outline;
6. criar os tokens iniciais em `theme/` antes de espalhar estilos pelas telas;
7. criar os tipos iniciais (`Account`, `AuthSession`, `Profile`, `Transaction`, `Category`, `Budget`, `Goal`);
8. criar dataset mock centralizado e services, incluindo `authService` mockado;
9. criar o Context de sessão/perfil ativo no layout raiz;
10. implementar Boas-vindas/Login/Cadastro da US60 e o redirecionamento autenticado;
11. implementar a estrutura da bottom navigation;
12. validar cada tela no Android Emulator, usando web apenas como apoio.

### 18.1 O que não precisa ser decidido agora

Não é necessário adiar o desenvolvimento para escolher:

- biblioteca de estado global;
- arquitetura de backend;
- banco de dados;
- biblioteca definitiva de testes automatizados;
- implementação real das integrações ainda fora do escopo da entrega visual.

Esses itens devem ser introduzidos quando houver uma necessidade concreta e rastreável.

---

## 19. Evolução deste documento

Este arquivo deve evoluir junto com a implementação.

Alterações arquiteturais relevantes devem registrar:

- decisão tomada;
- motivo;
- alternativas consideradas;
- trade-offs;
- impacto sobre a estrutura existente;
- User Stories/telas afetadas;
- testes/regressões que precisam ser revistos.

Evitar criar estruturas paralelas sem revisar primeiro esta arquitetura e as decisões já registradas no projeto.
