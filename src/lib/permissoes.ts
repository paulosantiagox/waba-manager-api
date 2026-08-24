// Matriz ÚNICA de permissões deste sistema (waba). Não espalhe condicional pelos
// componentes — leia sempre daqui, tanto na rota quanto no item de menu.
import { temNivel } from './roles';

/**
 * Nível MÍNIMO por rota. O mesmo valor é usado no <RotaProtegida> e no Sidebar,
 * para nunca existir link que leve a um redirect.
 *
 * Proposta (confirmar):
 *   consultor → só leitura: Dashboard, Campanhas, Disparos
 *   user      → operação: + Dashboard V2, Projetos, Templates (criar/editar/disparar/duplicar)
 *   admin     → administração: Usuários, e ações destrutivas / conexão de contas
 *   /settings → aberto (troca da própria senha é self-service)
 */
export const NIVEL_ROTA: Record<string, string> = {
  '/dashboard': 'consultor',
  '/campaigns': 'consultor',
  '/broadcasts': 'consultor',
  '/dashboard-v2': 'user',
  '/projects': 'user',
  '/templates': 'user',
  '/settings': 'consultor',
  '/users': 'admin',
};

/** Rota desconhecida → exige 'user' (padrão operação, nunca aberto por acidente). */
export const nivelDaRota = (href: string): string => NIVEL_ROTA[href] ?? 'user';

/** true quando a role pode acessar a rota. */
export const podeRota = (role: string | undefined, href: string): boolean =>
  temNivel(role, nivelDaRota(href));

/**
 * Nível MÍNIMO por AÇÃO (gate de botões/mutações).
 *   user  → criar, editar, disparar, duplicar (consultor não)
 *   admin → excluir, conectar/desconectar conta WhatsApp
 */
export const NIVEL_ACAO: Record<string, string> = {
  criar: 'user',
  editar: 'user',
  disparar: 'user',
  duplicar: 'user',
  excluir: 'admin',
  conectar_conta: 'admin',
  desconectar_conta: 'admin',
  gerir_sistema: 'admin',
};

/** true quando a role pode executar a ação. Ação desconhecida → exige 'user'. */
export const podeAcao = (role: string | undefined, acao: keyof typeof NIVEL_ACAO | string): boolean =>
  temNivel(role, NIVEL_ACAO[acao] ?? 'user');
