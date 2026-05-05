# PRD: Sistema de Monitoramento de Status WhatsApp (Dashboard V2 Focus)

## 1. Visão Geral
Este sistema tem como objetivo principal o monitoramento em tempo real do status de saúde ("Quality Rating") de números de telefone conectados à API do WhatsApp Business (Meta). O foco é a visualização rápida de métricas de performance e a gestão simplificada de infraestrutura (BMs e Projetos).

## 2. Escopo do Produto

### 2.1. Módulos Inclusos
- **Autenticação:** Sistema de login seguro.
- **Configuração de Infraestrutura:** Cadastro e gestão de BMs (Business Managers) e Tokens do Meta.
- **Gestão de Projetos:** Organização de números por projetos/clientes.
- **Dashboard V2 (Core):** Interface central de monitoramento.

### 2.2. Módulos Excluídos
- Gestão de Campanhas e disparos de mensagens.
- Resumos de IA para conversas.
- Logs de envio de mensagens.

---

## 3. Detalhamento das Funcionalidades

### 3.1. Gestão de BMs e Conectividade Meta
- **Cadastro de BM:** Interface para inserir `WhatsApp Business Account ID`, `Access Token` e nome identificador.
- **Validação de Token:** Verificação automática da validade do token com feedback visual.
- **Sincronização:** Botão para forçar a atualização dos dados via API do Meta.

### 3.2. Gestão de Projetos
- **Organização Hierárquica:** Cada número de telefone deve obrigatoriamente pertencer a um Projeto.
- **Interface de Cadastro:** Criação de projetos com nome, descrição e atribuição de números.

### 3.3. Dashboard V2 (Detalhamento Técnico)
O Dashboard V2 é composto pelos seguintes elementos principais:

#### A. Cards de Resumo (KPIs)
- **Total de Números:** Contagem total de números ativos no sistema.
- **Status "GREEN" (Alta):** Quantidade de números com qualidade alta.
- **Status "YELLOW/RED" (Baixa):** Quantidade de números que precisam de atenção.

#### B. Lista de Monitoramento (Cards Individuais)
Cada número é representado por um card contendo:
- **Nome/Identificador:** Nome amigável do número.
- **Telefone:** Número formatado.
- **Badge de Status:** Cor visual indicando `HIGH` (Verde), `MEDIUM` (Amarelo) ou `LOW` (Vermelho).
- **Contador "EM ALTA DESDE":** Cálculo em tempo real (Dias/Horas) baseado na última mudança de status para `HIGH`.
- **Badge de Projeto:** Nome do projeto ao qual o número pertence.

#### C. Histórico de Status (Sidebar/Drawer)
- Ao clicar em um número, uma barra lateral exibe a linha do tempo de mudanças de status.
- Registra data, hora e qual era o status anterior vs. atual.

---

## 4. Requisitos Não Funcionais

### 4.1. Atualização em Tempo Real (Real-time)
- **Supabase Realtime:** O dashboard deve atualizar automaticamente em todos os navegadores abertos sempre que houver uma alteração na tabela de `phone_numbers` no banco de dados.

### 4.2. Performance e Responsividade
- **Mobile-First:** A visualização dos cards deve ser otimizada para dispositivos móveis, evitando sobreposição de elementos.
- **Lazy Loading:** Carregamento eficiente de grandes listas de números.

---

## 5. Fluxo de Dados (Integração Meta)
1. O sistema consome o endpoint `GET /v15.0/{whatsapp-business-account-id}/phone_numbers`.
2. O campo `quality_rating` da API do Meta é mapeado para os status internos:
   - `Green` -> `HIGH`
   - `Yellow` -> `MEDIUM`
   - `Red` -> `LOW`
3. Se a API não retornar uma data de alteração, o sistema utiliza a data de criação do registro como marco zero para o contador de "Dias em Alta".

---

## 6. Diferenciais Estratégicos
- **Simplicidade:** Foco total em quem precisa apenas garantir que a operação está "online" e saudável.
- **Prevenção:** Visualização clara de quando um número começa a cair de qualidade, permitindo ação imediata antes do bloqueio total.
