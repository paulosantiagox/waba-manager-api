import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User as AppUser } from '@/types';
import { nivelDe, temNivel } from '@/lib/roles';

// Identificador deste sistema no cadastro central 3SMAX.
const APP_ID = 'waba';

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  /** role padronizada vinda de user_app_access (master|admin|user|consultor). */
  role: string | undefined;
  /** true quando a role atual tem nível >= ao nível mínimo informado. */
  can: (nivelMinimo: string) => boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AppUser>) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type DenyReason = 'sem_acesso' | 'inativo';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Log central de acessos. A identidade vem de auth.uid() no banco — nunca
  // mandamos user_id. Envolvido em try/catch: log que quebra o login é pior que
  // log faltando.
  const registrarAcesso = useCallback(
    async (evento: string, extra?: { p_sucesso?: boolean; p_motivo?: string }) => {
      try {
        await supabase.rpc('registrar_acesso', {
          p_app: APP_ID,
          p_evento: evento,
          p_user_agent: navigator.userAgent,
          ...(extra ?? {}),
        });
      } catch (e) {
        console.warn('[Auth] registrar_acesso falhou (ignorado):', e);
      }
    },
    []
  );

  // Tentativa de login SEM sessão (senha errada não gera auth.uid(), então a
  // registrar_acesso recusaria). O banco extrai IP e user-agent dos headers —
  // não mandamos do cliente, que seria forjável. p_evento fica no default
  // ('login_falhou'). Acima de 20 req/IP/min o banco responde 204 e não grava:
  // é o comportamento esperado, não é erro.
  const registrarTentativa = useCallback(async (email: string, motivo: string) => {
    try {
      await supabase.rpc('registrar_tentativa', {
        p_app: APP_ID,
        p_email: email,
        p_motivo: motivo,
      });
    } catch (e) {
      console.warn('[Auth] registrar_tentativa falhou (ignorado):', e);
    }
  }, []);

  // Fonte de perfil e role: user_app_access + user_profiles (padrão 3SMAX).
  const fetchUserProfile = useCallback(
    async (userId: string): Promise<{ user: AppUser | null; reason?: DenyReason }> => {
      try {
        // 1) Acesso ativo a ESTE app + role padronizada
        const { data: access, error: accessError } = await supabase
          .from('user_app_access')
          .select('role')
          .eq('user_id', userId)
          .eq('app', APP_ID)
          .eq('ativo', true)
          .maybeSingle();

        if (accessError) console.error('[Auth] erro ao ler user_app_access:', accessError);

        const userRole = (access?.role as string | undefined) ?? undefined;
        // Sem acesso ao app, ou role fora do padrão (nível 0) → não entra.
        if (!access || nivelDe(userRole) === 0) {
          return { user: null, reason: 'sem_acesso' };
        }

        // 2) Perfil central (nome/avatar/ativo)
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('nome, email, avatar_url, ativo, created_at')
          .eq('id', userId)
          .maybeSingle();

        if (profileError) console.error('[Auth] erro ao ler user_profiles:', profileError);
        if (!profile || profile.ativo !== true) {
          return { user: null, reason: 'inativo' };
        }

        const appUser: AppUser = {
          id: userId,
          name: profile.nome || '',
          email: profile.email || '',
          role: userRole as string,
          photo: profile.avatar_url || undefined,
          ativo: true,
          createdAt: profile.created_at,
        };
        setUser(appUser);
        setRole(userRole);
        return { user: appUser };
      } catch (error) {
        console.error('[Auth] erro em fetchUserProfile:', error);
        return { user: null, reason: 'sem_acesso' };
      }
    },
    []
  );

  const clearAuth = useCallback(() => {
    setUser(null);
    setRole(undefined);
    setSession(null);
  }, []);

  useEffect(() => {
    // Listener PRIMEIRO
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRole(undefined);
        return;
      }

      if (currentSession?.user) {
        // Defer chamadas ao Supabase
        setTimeout(() => {
          fetchUserProfile(currentSession.user.id).then(({ user: appUser }) => {
            if (!appUser) {
              // Sessão existe mas não tem acesso → nunca deixar meio-logado.
              supabase.auth.signOut();
              clearAuth();
            }
          });
        }, 0);
      } else {
        setUser(null);
        setRole(undefined);
      }
    });

    // DEPOIS a sessão existente
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        fetchUserProfile(existingSession.user.id)
          .then(({ user: appUser }) => {
            if (!appUser) {
              supabase.auth.signOut();
              clearAuth();
            }
          })
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile, clearAuth]);

  // Heartbeat de sessão: se o admin revoga a sessão no Painel Geral, derruba na
  // hora em vez de esperar o token expirar (~1h). A RPC lê o session_id do
  // próprio JWT e só retorna false quando a sessão foi revogada — em qualquer
  // erro retorna true, então nunca desloga por engano.
  const temSessao = !!session;
  useEffect(() => {
    if (!temSessao) return;

    const t = setInterval(async () => {
      try {
        const { data, error } = await supabase.rpc('sessao_ativa');
        if (!error && data === false) {
          clearInterval(t);
          await supabase.auth.signOut(); // cai para o login
        }
      } catch {
        /* rede instável: tenta no próximo ciclo */
      }
    }, 20000);

    return () => clearInterval(t);
  }, [temSessao]);

  const login = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          const credencialInvalida = error.message === 'Invalid login credentials';
          // Registra a tentativa no log central ANTES de devolver o erro à UI.
          await registrarTentativa(
            email,
            credencialInvalida ? 'email ou senha incorretos' : error.message
          );

          if (credencialInvalida) {
            return { error: 'Email ou senha inválidos' };
          }
          return { error: error.message };
        }

        const signedInUserId = data.user?.id;
        if (signedInUserId) {
          const { user: appUser, reason } = await fetchUserProfile(signedInUserId);
          if (!appUser) {
            // Autenticou, mas não tem acesso a este sistema.
            await registrarAcesso('acesso_negado', {
              p_sucesso: false,
              p_motivo: reason === 'inativo' ? 'perfil inativo' : 'sem acesso ao app waba',
            });
            await supabase.auth.signOut();
            clearAuth();
            return { error: 'Você não tem acesso ao WABA' };
          }
          // Login válido e autorizado.
          await registrarAcesso('login');
        }

        return { error: null };
      } catch (error) {
        return { error: 'Erro ao fazer login' };
      }
    },
    [fetchUserProfile, registrarAcesso, registrarTentativa, clearAuth]
  );

  const logout = useCallback(async () => {
    // Registra antes do signOut, enquanto a sessão (auth.uid) ainda existe.
    await registrarAcesso('logout');
    await supabase.auth.signOut();
    clearAuth();
  }, [registrarAcesso, clearAuth]);

  // Edição self-service do próprio perfil central (nome/foto).
  const updateUser = useCallback(
    async (updates: Partial<AppUser>) => {
      if (!user) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          nome: updates.name,
          avatar_url: updates.photo,
        })
        .eq('id', user.id);

      if (!error) {
        setUser((prev) => (prev ? { ...prev, ...updates } : null));
      }
    },
    [user]
  );

  const can = useCallback((nivelMinimo: string) => temNivel(role, nivelMinimo), [role]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        role,
        can,
        login,
        logout,
        updateUser,
        isAuthenticated: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
