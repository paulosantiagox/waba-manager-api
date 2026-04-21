import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useUsers, useUserStats, useUpdateUserStatus, useUpdateUserRole, useDeleteUser } from '@/hooks/useUsers';
import { useAllProjects } from '@/hooks/useProjects';
import { useAllWhatsAppNumbers } from '@/hooks/useWhatsAppNumbers';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { 
  Search, Check, X, Eye, MoreHorizontal, Users as UsersIcon, 
  FolderKanban, Phone, Activity, Loader2, Shield, UserMinus, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import UserDetailModal from '@/components/modals/UserDetailModal';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import { User } from '@/types';

const UsersPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { user: currentUser } = useAuth();

  const { data: users = [], isLoading } = useUsers();
  const { data: stats } = useUserStats();
  const { data: projects = [] } = useAllProjects();
  const { data: numbers = [] } = useAllWhatsAppNumbers();
  const updateStatus = useUpdateUserStatus();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getUserStats = (userId: string) => {
    const userProjects = projects.filter(p => p.userId === userId);
    const projectIds = userProjects.map(p => p.id);
    const userNumbers = numbers.filter(n => projectIds.includes(n.projectId));
    return { projects: userProjects.length, numbers: userNumbers.length };
  };

  const handleToggleStatus = (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('Você não pode desativar o usuário que está logado');
      return;
    }

    // If active, set to inactive. Otherwise (pending or inactive), set to active
    const newStatus = targetUser.status === 'active' ? 'inactive' : 'active';
    updateStatus.mutate({ userId: targetUser.id, status: newStatus });
  };

  const handleDeleteUser = (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      toast.error('Você não pode excluir o usuário logado');
      return;
    }
    setUserToDelete(targetUser);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUser.mutate(userToDelete.id);
      setUserToDelete(null);
    }
  };

  if (isLoading) {
    return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
        <p className="text-muted-foreground">Gerencie os usuários da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><UsersIcon className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold">{stats?.total || 0}</p><p className="text-sm text-muted-foreground">Total de Usuários</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><Check className="w-5 h-5 text-success" /></div><div><p className="text-2xl font-bold">{stats?.active || 0}</p><p className="text-sm text-muted-foreground">Ativos</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Activity className="w-5 h-5 text-warning" /></div><div><p className="text-2xl font-bold">{stats?.pending || 0}</p><p className="text-sm text-muted-foreground">Pendentes</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><X className="w-5 h-5 text-muted-foreground" /></div><div><p className="text-2xl font-bold">{stats?.inactive || 0}</p><p className="text-sm text-muted-foreground">Inativos</p></div></div></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar usuários..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="pending">Pendentes</SelectItem><SelectItem value="inactive">Inativos</SelectItem></SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
              <TableHead className="text-center">Projetos</TableHead>
              <TableHead className="text-center">Números</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const userStats = getUserStats(user.id);
              const isActive = user.status === 'active';
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">{user.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name}</p>
                          {user.id === currentUser?.id && (
                            <Badge variant="secondary" className="text-xs">
                              Você
                            </Badge>
                          )}
                          {user.role === 'master' && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => handleToggleStatus(user)}
                        disabled={updateStatus.isPending || user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? 'Você não pode desativar o usuário logado' : undefined}
                        className="data-[state=checked]:bg-success data-[state=unchecked]:bg-destructive"
                      />
                      <span className="text-xs text-muted-foreground min-w-[60px]">
                        {isActive ? 'Ativo' : user.status === 'pending' ? 'Pendente' : 'Inativo'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center"><span className="flex items-center justify-center gap-1"><FolderKanban className="w-4 h-4 text-muted-foreground" />{userStats.projects}</span></TableCell>
                  <TableCell className="text-center"><span className="flex items-center justify-center gap-1"><Phone className="w-4 h-4 text-muted-foreground" />{userStats.numbers}</span></TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(user.createdAt), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>
                        
                        <DropdownMenuSeparator />
                        
                        {user.role === 'user' && (
                          <DropdownMenuItem 
                            onClick={() => updateRole.mutate({ userId: user.id, role: 'master' })}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Promover a Admin
                          </DropdownMenuItem>
                        )}
                        
                        {user.role === 'master' && (
                          <DropdownMenuItem 
                            onClick={() => updateRole.mutate({ userId: user.id, role: 'user' })}
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Rebaixar a Usuário
                          </DropdownMenuItem>
                        )}

                        {user.id !== currentUser?.id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteUser(user)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir Usuário
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        projectsCount={selectedUser ? getUserStats(selectedUser.id).projects : 0}
        numbersCount={selectedUser ? getUserStats(selectedUser.id).numbers : 0}
      />

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Excluir Usuário"
        description={`Tem certeza que deseja excluir o usuário "${userToDelete?.name}"? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmDeleteUser}
        variant="destructive"
      />
    </DashboardLayout>
  );
};

export default UsersPage;
