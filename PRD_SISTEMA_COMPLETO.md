# PRD - Documento de Requisitos do Produto (Sistema de Monitoramento WABA)

## 1. Visão Geral
Este sistema é uma plataforma enterprise de monitoramento e gestão para contas de **WhatsApp Business API (WABA)**. Ele resolve o problema de falta de visibilidade sobre a saúde de múltiplos números de WhatsApp, permitindo que empresas monitorem o status de qualidade (Quality Rating), gerenciem campanhas de disparo e organizem seus ativos por projetos de forma centralizada e em tempo real.

---

## 2. Estrutura de Autenticação e Usuários
A segurança e o controle de acesso são fundamentais para proteger os ativos da empresa.

### 2.1. Controle de Acesso (RBAC)
- **Nível Master:**
  - Gestão total de usuários (ativar/desativar).
  - Visualização de logs de atividade.
  - Acesso a todas as BMs e projetos.
- **Nível User:**
  - Acesso restrito aos projetos e campanhas designados.
  - Visualização de métricas de qualidade.

### 2.2. Fluxos de Login e Cadastro
- **Login:** Protegido via Supabase Auth com validação de status de perfil (contas inativas não entram).
- **Cadastro:** Usuário se cadastra e entra em fila de aprovação ou é ativado automaticamente via Edge Function administrativa, garantindo que apenas pessoal autorizado acesse o dashboard.

---

## 3. Monitoramento Global (Dashboard V2)
O Dashboard V2 é o centro operacional, otimizado para mobile-first e monitoramento em tempo real.

### 3.1. Funcionalidades Detalhadas
- **Visão por Projetos:** Agrupamento inteligente para empresas que gerenciam diferentes marcas ou departamentos.
- **Cards de Status (Alta Densidade):**
  - **Nome:** Exibe o nome customizado ou o nome verificado no Meta.
  - **Qualidade:** Indicadores visuais de cor (Verde para High, Amarelo para Medium, Vermelho para Low).
  - **Métrica de Tempo:** Calcula automaticamente "Dias em Alta" para identificar números mais resilientes.
  - **Fallback de Dados:** Caso o Meta não retorne a data da última mudança, o sistema utiliza a data de cadastro para não deixar campos vazios.
- **Sincronização em Tempo Real:** Conexão via WebSockets (Supabase Realtime) que reflete mudanças no status do Meta em todos os dispositivos logados simultaneamente.
- **Barra Lateral de Histórico (Activity Feed):**
  - Lista cronológica das últimas 20 mudanças de status da operação.
  - Mostra a direção da mudança (Melhorou ou Piorou) com ícones de tendência.

---

## 4. Gestão de Projetos e BMs
A organização administrativa permite escalar a operação para centenas de números.

### 4.1. Módulo de Projetos
- **Organização:** Cada projeto funciona como uma pasta lógica.
- **Ordenação Inteligente:** Possibilidade de fixar (pin) projetos prioritários no topo.
- **Dashboard Específico:** Dentro de cada projeto, visões detalhadas e filtros específicos por Business Manager.

### 4.2. Business Managers (BMs)
- Armazenamento centralizado de ID da BM e Access Tokens.
- Gestão de cartões vinculados (últimos 4 dígitos para identificação de faturamento).
- Possibilidade de vincular múltiplos números a uma única BM.

---

## 5. Campanhas e Disparos (Operação)
O sistema não apenas monitora, mas também ajuda a documentar a operação de envios.

### 5.1. Gestão de Campanhas
- Criação de campanhas (ex: "Lançamento de Verão").
- Ativação/Arquivamento para manter a organização.

### 5.2. Registro de Disparos (Broadcasts)
- **Log de Envios:** Cadastro de cada disparo informando data, hora, lista de contatos (nome), template utilizado e quantidade de contatos.
- **Resumo para WhatsApp:** Ferramenta que gera um texto pronto para ser colado em grupos de reporte, contendo emoji de status de conta e dados formatados.
- **Agendamento:** Gestão de status de disparo (Preparando, Agendado, Enviado, Cancelado).

### 5.3. Ferramentas de Apoio
- **Tipos de Ação:** Personalização das categorias de disparo com cores (ex: Ativo, Reativo, Recuperação).
- **Atalhos (Shortcuts):** Repositório de textos e copies padrão para acesso rápido da equipe de operação.

---

## 6. Integração com a API do Meta
Detalhes técnicos da comunicação com a infraestrutura do Facebook/WhatsApp.

### 6.1. Comunicação via Graph API
- **Endpoint Principal:** `/v21.0/{phone-number-id}`.
- **Campos Sincronizados:**
  - `quality_rating`: Saúde da conta.
  - `messaging_limit_tier`: Limite de mensagens (1k, 10k, 100k, etc).
  - `code_verification_status`: Status de verificação do número.

### 6.2. Automação e Cron Jobs
- **Edge Function `auto-update-status`:** Script que varre periodicamente (ou sob demanda manual) todos os números e atualiza o banco de dados.
- **Tratamento de Erros:** Sistema de log que captura falhas de token ou erros da API do Meta, impedindo que dados corrompidos afetem o dashboard.

---

## 7. Requisitos Não Funcionais
- **Responsividade:** Interface 100% adaptada para celulares (Mobile-First).
- **Performance:** Carregamento rápido via React Query e cache de dados.
- **Arquitetura:** Separação clara entre Presentation (UI), Business Logic (Hooks) e Data Access (Supabase).
