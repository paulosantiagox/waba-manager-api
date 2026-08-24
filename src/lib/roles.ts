// Níveis de acesso — padrão único do grupo 3SMAX (arquivo idêntico nos 12 sistemas).
// NUNCA compare role por igualdade; use sempre nível MÍNIMO via temNivel().

export const NIVEIS: Record<string, number> = {
  master: 100, // dono do grupo, passa por tudo
  admin: 80, // administra este sistema: config, logs, exclusões
  user: 40, // operação do dia a dia: criar, editar, disparar
  consultor: 20, // somente leitura
};

/** Nível numérico de uma role. Role desconhecida → 0 (não entra). */
export const nivelDe = (role?: string): number => NIVEIS[role ?? ''] ?? 0;

/** true quando `role` tem nível >= ao nível de `minimo`. admin passa em 'user', master em tudo. */
export const temNivel = (role: string | undefined, minimo: string): boolean =>
  nivelDe(role) >= nivelDe(minimo);
