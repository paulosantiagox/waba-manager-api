import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { toast } from 'sonner';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('waba_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('waba_user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Map profiles with roles
      return profiles.map((p): User => {
        const userRole = roles.find(r => r.user_id === p.id);
        return {
          id: p.id,
          name: p.name || '',
          email: p.email || '',
          role: (userRole?.role as 'master' | 'user') || 'user',
          photo: p.photo || undefined,
          status: (p.status as 'active' | 'pending' | 'inactive') || 'active',
          createdAt: p.created_at,
          lastLogin: p.last_login || undefined,
        };
      });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'active' | 'pending' | 'inactive' }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-update-user-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ userId, status }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao atualizar status');
      }

      return { userId, status };
    },
    onMutate: async ({ userId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });

      const previousUsers = queryClient.getQueryData<User[]>(['users']);

      if (previousUsers) {
        queryClient.setQueryData<User[]>(['users'], previousUsers.map(u => u.id === userId ? { ...u, status } : u));
      }

      return { previousUsers };
    },
    onSuccess: (result) => {
      // Keep cache in sync (avoid flicker)
      const currentUsers = queryClient.getQueryData<User[]>(['users']);
      if (currentUsers) {
        queryClient.setQueryData<User[]>(['users'], currentUsers.map(u => u.id === result.userId ? { ...u, status: result.status } : u));
      }

      // Forçar reload do banco para garantir que o cache reflete a realidade
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      toast.success('Status do usuário atualizado e verificado!');
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previousUsers) {
        queryClient.setQueryData(['users'], ctx.previousUsers);
      }
      toast.error('Erro ao atualizar status');
      console.error(error);
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'master' | 'user' }) => {
      // Check if role exists
      const { data: existingRole } = await supabase
        .from('waba_user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('waba_user_roles')
          .update({ role })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('waba_user_roles')
          .insert({ user_id: userId, role });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role do usuário atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar role');
      console.error(error);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      // Delete from profiles (cascade will handle user_roles)
      const { error } = await supabase
        .from('waba_profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir usuário');
      console.error(error);
    },
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ['user-stats'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('waba_profiles')
        .select('id, status');

      if (error) throw error;

      const { data: roles } = await supabase
        .from('waba_user_roles')
        .select('user_id, role');

      const masterIds = roles?.filter(r => r.role === 'master').map(r => r.user_id) || [];
      const nonMasterProfiles = profiles.filter(p => !masterIds.includes(p.id));

      return {
        total: nonMasterProfiles.length,
        active: nonMasterProfiles.filter(p => p.status === 'active').length,
        pending: nonMasterProfiles.filter(p => p.status === 'pending').length,
        inactive: nonMasterProfiles.filter(p => p.status === 'inactive').length,
      };
    },
  });
}
