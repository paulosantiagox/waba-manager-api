import { useState } from 'react';
import { Project, WhatsAppNumber } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderKanban, Phone, ChevronRight, Calendar, Edit2, Trash2, MoreVertical, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import { SortableControls } from '@/components/ui/sortable-controls';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  numbers: WhatsAppNumber[];
  onEdit?: (project: Project, data: { name: string; description?: string }) => void;
  onDelete?: (projectId: string) => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const ProjectCard = ({ 
  project, 
  numbers, 
  onEdit, 
  onDelete,
  isPinned = false,
  onTogglePin,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: ProjectCardProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description || '');

  const statusCounts = {
    high: numbers.filter(n => n.qualityRating === 'HIGH').length,
    medium: numbers.filter(n => n.qualityRating === 'MEDIUM').length,
    low: numbers.filter(n => n.qualityRating === 'LOW').length,
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    onEdit?.(project, { name: editName.trim(), description: editDescription.trim() || undefined });
    setIsEditOpen(false);
  };

  const handleDelete = () => {
    onDelete?.(project.id);
    setIsDeleteOpen(false);
  };

  return (
    <>
      <Card className={cn(
        "overflow-hidden transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 animate-slide-up group",
        isPinned && "ring-2 ring-primary/50 bg-primary/5"
      )}>
        <CardContent className="p-0">
          {/* Pin indicator */}
          {isPinned && (
            <div className="absolute top-2 right-2 z-10">
              <Pin className="w-4 h-4 text-primary fill-primary" />
            </div>
          )}
          <div className="p-5 pb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                {project.icon ? (
                  <img 
                    src={project.icon} 
                    alt={project.name} 
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <FolderKanban className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                  {(onEdit || onDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {onEdit && onDelete && <DropdownMenuSeparator />}
                        {onDelete && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setIsDeleteOpen(true)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                {numbers.length} números
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {format(new Date(project.updatedAt), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            </div>

            {/* Status pills */}
            {numbers.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                {statusCounts.high > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success font-medium">
                    🟢 {statusCounts.high}
                  </span>
                )}
                {statusCounts.medium > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning font-medium">
                    🟡 {statusCounts.medium}
                  </span>
                )}
                {statusCounts.low > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                    🔴 {statusCounts.low}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex items-center gap-2">
            <Link to={`/projects/${project.id}`} className="flex-1">
              <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                Ver Detalhes
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            {onTogglePin && (
              <SortableControls
                isPinned={isPinned}
                onTogglePin={onTogglePin}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                size="sm"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
          </DialogHeader>
          <form className="space-y-4 mt-4" onSubmit={handleEdit}>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome do Projeto</Label>
              <Input 
                id="edit-name" 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição (opcional)</Label>
              <Textarea 
                id="edit-description" 
                value={editDescription} 
                onChange={(e) => setEditDescription(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-primary">
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Excluir Projeto"
        description={`Tem certeza que deseja excluir o projeto "${project.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
};

export default ProjectCard;