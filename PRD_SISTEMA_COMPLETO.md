# PRD - Sistema de Monitoramento Global de WhatsApp (WABA)

Este documento detalha todos os módulos, arquitetura e requisitos do sistema de monitoramento e gestão de contas WhatsApp Business API.

## 1. Módulo de Autenticação e Segurança
O sistema utiliza **Supabase Auth** para gestão de identidade e controle de acesso.

### 1.1. Fluxos de Acesso
- **Login/Senha:** Autenticação via email e senha com persistência de sessão.
- **Cadastro (Signup):** Criação de conta com ativação automática via Edge Function (`admin-update-user-status`).
- **Níveis de Permissão (RBAC):**
  - **Master:** Acesso total ao sistema, gestão de usuários e configurações globais.
  - **User:** Acesso aos projetos e números aos quais está vinculado.

### 1.2. Perfil de Usuário
- Gestão de nome, email e foto.
- Sincronização automática com a tabela `waba_profiles`.

## 2. Dashboard V2 (Monitoramento Global)
O coração do sistema, focado em alta densidade de informação e tempo real.

### 2.1. Funcionalidades
- **Grid de Números:** Visualização de todos os números WABA agrupados por projeto.
- **Sincronização Real-time:** Uso de Supabase Realtime para atualizar status sem refresh.
- **Métricas de Qualidade:** Mapeamento visual das cores do Meta (Verde/Alta, Amarelo/Média, Vermelho/Baixa).
- **Indicadores de Tempo:** Contador de "Dias em Alta" e data da última mudança.
- **Activity Feed:** Barra lateral com o histórico recente de mudanças de status de toda a operação.

## 3. Gestão de Projetos
Módulo para organização lógica das contas.

### 3.1. Funcionalidades
- **CRUD de Projetos:** Criação, edição e exclusão de pastas de projeto.
- **Organização:** Sistema de "Pin" (fixar) e ordenação manual para priorizar projetos importantes.
- **Dashboard Interno:** Cada projeto possui sua própria visão detalhada com métricas específicas de saúde dos números vinculados.

## 4. Campanhas e Disparos
Módulo focado na operação de envios em massa e controle de histórico.

### 4.1. Gestão de Campanhas
- Organização de disparos por objetivos (ex: Lançamento, Remarketing).
- Vinculação de campanhas a projetos específicos para relatórios.

### 4.2. Registro de Disparos (Broadcasts)
- Registro detalhado de cada envio: Data, Hora, Conta utilizada, Lista de contatos, Template e Quantidade.
- **Template de Resumo:** Sistema inteligente que gera um texto formatado (copiar para área de transferência) com emojis e dados do disparo para facilitar o reporte em grupos de WhatsApp.

### 4.3. Atalhos e Tipos de Ação
- **Atalhos (Shortcuts):** Armazenamento de textos e copies frequentes para acesso rápido.
- **Tipos de Ação:** Categorização dos disparos (ex: Ativo, Reativo, Recuperação).

## 5. Integração com Meta (WABA)
A integração técnica que sustenta os dados de qualidade.

### 5.1. Conexão Técnica
- **API:** Graph API v21.0.
- **Autenticação:** Tokens de Sistema por Business Manager (BM).
- **Dados Capturados:** `quality_rating`, `messaging_limit_tier`, `display_phone_number`.

### 5.2. Automação (Edge Functions)
- **Auto-Update Cron:** Script que roda periodicamente para buscar atualizações no Meta.
- **Trigger de Histórico:** Sempre que um status muda no Meta, o sistema grava automaticamente na tabela `waba_number_status_history`.

---
*Este documento serve como a verdade única do produto e deve ser atualizado conforme novas funcionalidades forem implementadas.*
