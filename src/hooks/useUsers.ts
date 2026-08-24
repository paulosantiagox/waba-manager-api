import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';

// Este sistema NÃO cria, ativa nem revoga acesso. Quem controla isso é o
// Painel Geral (https://geral.3smax.com). Aqui é somente consulta de quem tem
// acesso ao app 'waba' no cadastro central.
const APP_ID = 'waba';

/** Lista quem tem acesso ativo ao app 'waba' (user_app_access + user_profiles). */
export function useUsers() {
  return useQuery({
    queryKey: ['users', APP_ID],
    queryFn: async (): Promise<User[]> => {
      const { data: acessos, error: acessosError } = await supabase
        .from('user_app_access')
        .select('user_id, role, ativo')
        .eq('app', APP_ID)
        .eq('ativo', true);

      if (acessosError) throw acessosError;
      if (!acessos || acessos.length === 0) return [];

      const ids = acessos.map((a) => a.user_id as string);

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, nome, email, avatar_url, ativo, created_at')
        .in('id', ids);

      if (profilesError) throw profilesError;

      return (profiles ?? [])
        .map((p): User => {
          const acesso = acessos.find((a) => a.user_id === p.id);
          return {
            id: p.id as string,
            name: (p.nome as string) || '',
            email: (p.email as string) || '',
            role: (acesso?.role as string) || 'user',
            photo: (p.avatar_url as string) || undefined,
            ativo: p.ativo === true,
            createdAt: p.created_at as string,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/** Contagem simples de quem tem acesso ao 'waba' (sem o antigo 'pending'). */
export function useUserStats() {
  const { data: users = [], isLoading } = useUsers();

  return {
    data: {
      total: users.length,
      ativos: users.filter((u) => u.ativo).length,
      inativos: users.filter((u) => !u.ativo).length,
    },
    isLoading,
  };
}
