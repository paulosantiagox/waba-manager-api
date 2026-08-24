import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User } from '@/types';
import { temNivel } from '@/lib/roles';
import { FolderKanban, Phone, Calendar, Clock, Mail, Shield, UserIcon } from 'lucide-react';

interface UserDetailModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectsCount: number;
  numbersCount: number;
}

const UserDetailModal = ({ user, open, onOpenChange, projectsCount, numbersCount }: UserDetailModalProps) => {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Usuário</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Avatar and Name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {user.photo ? (
                <img src={user.photo} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{user.name}</h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{user.email}</span>
              </div>
            </div>
          </div>

          {/* Status and Role */}
          <div className="flex gap-3">
            <Badge
              variant={user.ativo ? 'default' : 'outline'}
              className={user.ativo ? 'bg-success' : ''}
            >
              {user.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 capitalize">
              {temNivel(user.role, 'admin') ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
              {user.role}
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <FolderKanban className="w-4 h-4" />
                <span className="text-sm">Projetos</span>
              </div>
              <p className="text-2xl font-bold">{projectsCount}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Phone className="w-4 h-4" />
                <span className="text-sm">Números</span>
              </div>
              <p className="text-2xl font-bold">{numbersCount}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Cadastro:</span>
              <span className="font-medium">{format(new Date(user.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
            {user.lastLogin && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Último login:</span>
                <span className="font-medium">{format(new Date(user.lastLogin), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailModal;
