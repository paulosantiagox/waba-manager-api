import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BroadcastModal from '@/components/modals/BroadcastModal';
import ActionTypeModal from '@/components/modals/ActionTypeModal';
import ShortcutModal from '@/components/modals/ShortcutModal';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import QualitySummary from '@/components/dashboard/QualitySummary';
import { useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign, useBroadcasts, useCreateBroadcast, useUpdateBroadcast, useDeleteBroadcast, useActionTypes, useCreateActionType, useUpdateActionType, useDeleteActionType, useShortcuts, useCreateShortcut, useUpdateShortcut, useDeleteShortcut } from '@/hooks/useCampaigns';
import { useProjects } from '@/hooks/useProjects';
import { useAllWhatsAppNumbers } from '@/hooks/useWhatsAppNumbers';
import { useSortableItems } from '@/hooks/useSortableItems';
import { Broadcast, ActionType, BroadcastStatus, CampaignShortcut, Campaign } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { SortableControls } from '@/components/ui/sortable-controls';
import { toast } from 'sonner';
import { Plus, Megaphone, Send, Calendar, ChevronRight, ChevronDown, Edit2, Trash2, Tag, Filter, Copy, Zap, Check, Loader2, Pin, Settings } from 'lucide-react';
import BroadcastTemplateConfigModal, { getBroadcastTemplate } from '@/components/modals/BroadcastTemplateConfigModal';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const statusOptions: { value: BroadcastStatus; label: string; color: string }[] = [
  { value: 'preparing', label: 'Em preparação', color: 'bg-muted text-muted-foreground' },
  { value: 'scheduled', label: 'Agendado', color: 'bg-yellow-500 text-white' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-destructive text-destructive-foreground' },
  { value: 'sent', label: 'Enviado', color: 'bg-success text-success-foreground' },
];

const Campaigns = () => {
  const { user } = useAuth();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isActionTypesOpen, setIsActionTypesOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [campaignsOpen, setCampaignsOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBroadcastId, setCopiedBroadcastId] = useState<string | null>(null);
  const [isTemplateConfigOpen, setIsTemplateConfigOpen] = useState(false);
  const [editBroadcast, setEditBroadcast] = useState<Broadcast | null>(null);
  const [isNewBroadcastOpen, setIsNewBroadcastOpen] = useState(false);
  const [editActionType, setEditActionType] = useState<ActionType | null>(null);
  const [isNewActionTypeOpen, setIsNewActionTypeOpen] = useState(false);
  const [editShortcut, setEditShortcut] = useState<CampaignShortcut | null>(null);
  const [isNewShortcutOpen, setIsNewShortcutOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: 'broadcast' | 'actionType' | 'shortcut' | 'campaign'; item: any } | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [newCampaignProjectId, setNewCampaignProjectId] = useState('');
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [isEditCampaignOpen, setIsEditCampaignOpen] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState('');
  const [editCampaignDescription, setEditCampaignDescription] = useState('');

  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  const { data: projects = [] } = useProjects();
  const { data: allNumbers = [] } = useAllWhatsAppNumbers();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();

  // Hooks de ordenação para campanhas
  const { 
    sortedItems: sortedCampaigns, 
    isPinned: isCampaignPinned, 
    togglePin: toggleCampaignPin, 
    moveUp: moveCampaignUp, 
    moveDown: moveCampaignDown 
  } = useSortableItems<Campaign>({
    storageKey: 'campaigns-order',
    items: campaigns,
  });

  const activeCampaign = selectedCampaign ? campaigns.find(c => c.id === selectedCampaign) : sortedCampaigns[0];
  const { data: broadcasts = [] } = useBroadcasts(activeCampaign?.id);
  const { data: actionTypes = [] } = useActionTypes(activeCampaign?.id);
  const { data: shortcuts = [] } = useShortcuts(activeCampaign?.id);

  // Hooks de ordenação para atalhos
  const { 
    sortedItems: sortedShortcuts, 
    isPinned: isShortcutPinned, 
    togglePin: toggleShortcutPin, 
    moveUp: moveShortcutUp, 
    moveDown: moveShortcutDown 
  } = useSortableItems<CampaignShortcut>({
    storageKey: `shortcuts-order-${activeCampaign?.id}`,
    items: shortcuts,
  });

  const createBroadcast = useCreateBroadcast();
  const updateBroadcastMutation = useUpdateBroadcast();
  const deleteBroadcastMutation = useDeleteBroadcast();
  const createActionTypeMutation = useCreateActionType();
  const updateActionTypeMutation = useUpdateActionType();
  const deleteActionTypeMutation = useDeleteActionType();
  const createShortcutMutation = useCreateShortcut();
  const updateShortcutMutation = useUpdateShortcut();
  const deleteShortcutMutation = useDeleteShortcut();

  const userNumbers = allNumbers.filter(n => projects.some(p => p.id === n.projectId));
  const [campaignProjectId, setCampaignProjectId] = useState<string>(activeCampaign?.projectId || projects[0]?.id || '');

  const groupedCampaigns = useMemo(() => {
    const groups: Record<string, Campaign[]> = {};
    
    sortedCampaigns.forEach(campaign => {
      const pId = campaign.projectId || 'unassigned';
      if (!groups[pId]) groups[pId] = [];
      groups[pId].push(campaign);
    });

    return Object.entries(groups).sort(([aId], [bId]) => {
      if (aId === 'unassigned') return 1;
      if (bId === 'unassigned') return -1;
      const projectA = projects.find(p => p.id === aId);
      const projectB = projects.find(p => p.id === bId);
      return (projectA?.name || '').localeCompare(projectB?.name || '');
    });
  }, [sortedCampaigns, projects]);

  const campaignBroadcasts = useMemo(() => {
    let result = broadcasts;
    if (typeFilter !== 'all') result = result.filter(b => b.actionTypeId === typeFilter);
    if (accountFilter !== 'all') result = result.filter(b => b.phoneNumberId === accountFilter);
    return result.sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime());
  }, [broadcasts, typeFilter, accountFilter]);

  const handleProjectChange = (projectId: string) => {
    setCampaignProjectId(projectId);
    if (activeCampaign) {
      updateCampaign.mutate({ id: activeCampaign.id, projectId });
    }
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) { toast.error("Nome da campanha é obrigatório"); return; }
    createCampaign.mutate({ name: newCampaignName.trim(), description: newCampaignDescription.trim() || undefined, projectId: newCampaignProjectId || projects[0]?.id });
    setNewCampaignName('');
    setNewCampaignDescription('');
    setNewCampaignProjectId('');
    setIsNewCampaignOpen(false);
  };

  const handleSaveBroadcast = (broadcast: Broadcast) => {
    if (editBroadcast) {
      updateBroadcastMutation.mutate({ ...broadcast, campaignId: activeCampaign?.id || '' });
    } else {
      createBroadcast.mutate({ ...broadcast, campaignId: activeCampaign?.id || '' });
    }
  };

  const handleSaveActionType = (at: ActionType) => {
    if (editActionType) {
      updateActionTypeMutation.mutate({ ...at, campaignId: activeCampaign?.id || '' });
    } else {
      createActionTypeMutation.mutate({ ...at, campaignId: activeCampaign?.id || '' });
    }
  };

  const handleSaveShortcut = (shortcut: CampaignShortcut) => {
    if (editShortcut) {
      updateShortcutMutation.mutate({ ...shortcut, campaignId: activeCampaign?.id || '' });
    } else {
      createShortcutMutation.mutate({ ...shortcut, campaignId: activeCampaign?.id || '' });
    }
  };

  const handleDelete = () => {
    if (deleteItem?.type === 'broadcast') {
      deleteBroadcastMutation.mutate({ id: deleteItem.item.id, campaignId: activeCampaign?.id || '' });
    } else if (deleteItem?.type === 'actionType') {
      deleteActionTypeMutation.mutate({ id: deleteItem.item.id, campaignId: activeCampaign?.id || '' });
    } else if (deleteItem?.type === 'shortcut') {
      deleteShortcutMutation.mutate({ id: deleteItem.item.id, campaignId: activeCampaign?.id || '' });
    } else if (deleteItem?.type === 'campaign') {
      deleteCampaign.mutate(deleteItem.item.id);
      if (selectedCampaign === deleteItem.item.id) {
        setSelectedCampaign(null);
      }
    }
    setDeleteItem(null);
  };

  const handleEditCampaignOpen = (campaign: Campaign) => {
    setEditCampaign(campaign);
    setEditCampaignName(campaign.name);
    setEditCampaignDescription(campaign.description || '');
    setIsEditCampaignOpen(true);
  };

  const handleEditCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCampaign || !editCampaignName.trim()) return;
    updateCampaign.mutate({ 
      id: editCampaign.id, 
      name: editCampaignName.trim(), 
      description: editCampaignDescription.trim() || undefined 
    });
    setIsEditCampaignOpen(false);
    setEditCampaign(null);
  };

  const handleStatusChange = (broadcastId: string, newStatus: BroadcastStatus) => {
    updateBroadcastMutation.mutate({ id: broadcastId, campaignId: activeCampaign?.id || '', status: newStatus });
  };

  const handleCopyContent = async (shortcut: CampaignShortcut) => {
    try {
      await navigator.clipboard.writeText(shortcut.content);
      setCopiedId(shortcut.id);
      toast.success(`"${shortcut.name}" copiado!`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error("Erro ao copiar"); }
  };

  const handleCopyBroadcast = async (broadcast: Broadcast) => {
    try {
      const actionType = actionTypes.find(at => at.id === broadcast.actionTypeId);
      const phoneNum = allNumbers.find(n => n.id === broadcast.phoneNumberId);
      const status = getStatusOption(broadcast.status);
      
      const qualityEmoji = phoneNum?.qualityRating === 'HIGH' ? '🟢 Alta' : 
                          phoneNum?.qualityRating === 'MEDIUM' ? '🟡 Média' : '🔴 Baixa';
      
      const template = getBroadcastTemplate();
      
      let message = template
        .replace(/{data}/g, format(parse(broadcast.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: ptBR }))
        .replace(/{hora}/g, broadcast.time)
        .replace(/{conta}/g, phoneNum?.customName || phoneNum?.verifiedName || 'N/A')
        .replace(/{numero}/g, phoneNum?.displayPhoneNumber || 'N/A')
        .replace(/{qualidade}/g, qualityEmoji)
        .replace(/{lista}/g, broadcast.listName)
        .replace(/{template}/g, broadcast.templateUsed)
        .replace(/{contatos}/g, broadcast.contactCount.toLocaleString())
        .replace(/{tipo}/g, actionType?.name || 'N/A')
        .replace(/{status}/g, status.label)
        .replace(/{observacoes}/g, broadcast.observations ? `📝 *Obs:* ${broadcast.observations}` : '');
      
      await navigator.clipboard.writeText(message.trim());
      setCopiedBroadcastId(broadcast.id);
      toast.success('Resumo do disparo copiado!');
      setTimeout(() => setCopiedBroadcastId(null), 2000);
    } catch { toast.error("Erro ao copiar"); }
  };

  const getStatusOption = (status: BroadcastStatus) => statusOptions.find(s => s.value === status) || statusOptions[0];

  if (campaignsLoading) {
    return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">Campanhas de Disparo</h1>
          <Dialog open={isNewCampaignOpen} onOpenChange={setIsNewCampaignOpen}>
            <DialogTrigger asChild><Button className="gradient-primary"><Plus className="w-4 h-4 mr-2" />Nova Campanha</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Nova Campanha</DialogTitle></DialogHeader>
              <form className="space-y-4 mt-4" onSubmit={handleCreateCampaign}>
                <div className="space-y-2"><Label htmlFor="campaign-name">Nome da Campanha</Label><Input id="campaign-name" placeholder="Ex: Lançamento Janeiro" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="campaign-description">Descrição</Label><Input id="campaign-description" placeholder="Descreva o objetivo da campanha" value={newCampaignDescription} onChange={(e) => setNewCampaignDescription(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-project">Projeto para Resumo de Status</Label>
                  <Select value={newCampaignProjectId} onValueChange={setNewCampaignProjectId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
                    <SelectContent className="bg-popover">{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="outline" onClick={() => setIsNewCampaignOpen(false)}>Cancelar</Button><Button type="submit" className="gradient-primary">Criar Campanha</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-muted-foreground">Gerencie suas campanhas e registre seus disparos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <Collapsible open={campaignsOpen} onOpenChange={setCampaignsOpen}>
              <CardHeader className="pb-2">
                <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors">
                  <CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4" />Minhas Campanhas</CardTitle>
                  <ChevronDown className={`w-4 h-4 transition-transform ${campaignsOpen ? '' : '-rotate-90'}`} />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  {sortedCampaigns.length > 0 ? sortedCampaigns.map((campaign, index) => (
                    <div key={campaign.id} className={cn(
                      "p-3 rounded-lg transition-all group",
                      activeCampaign?.id === campaign.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                      isCampaignPinned(campaign.id) && activeCampaign?.id !== campaign.id && 'ring-1 ring-primary/30 bg-primary/5'
                    )}>
                      <div className="flex items-center justify-between">
                        <button onClick={() => setSelectedCampaign(campaign.id)} className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            {isCampaignPinned(campaign.id) && <Pin className="w-3 h-3 text-primary fill-primary" />}
                            <p className="font-medium text-sm">{campaign.name}</p>
                          </div>
                          <p className={`text-xs ${activeCampaign?.id === campaign.id ? 'opacity-80' : 'text-muted-foreground'}`}>{broadcasts.filter(b => b.campaignId === campaign.id).length} disparos</p>
                        </button>
                        <div className="flex items-center gap-1">
                          <SortableControls
                            isPinned={isCampaignPinned(campaign.id)}
                            onTogglePin={() => toggleCampaignPin(campaign.id)}
                            onMoveUp={() => moveCampaignUp(campaign.id)}
                            onMoveDown={() => moveCampaignDown(campaign.id)}
                            canMoveUp={index > 0}
                            canMoveDown={index < sortedCampaigns.length - 1}
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className={`h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity ${activeCampaign?.id === campaign.id ? 'hover:bg-primary-foreground/20' : ''}`}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => handleEditCampaignOpen(campaign)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteItem({ type: 'campaign', item: campaign })}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-6"><Megaphone className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">Nenhuma campanha</p></div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {activeCampaign && (
            <Card>
              <Collapsible open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                <CardHeader className="pb-2">
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors">
                    <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" />Atalhos Rápidos</CardTitle>
                    <ChevronDown className={`w-4 h-4 transition-transform ${shortcutsOpen ? '' : '-rotate-90'}`} />
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-2 pt-0">
                    {sortedShortcuts.length > 0 ? sortedShortcuts.map((shortcut, index) => (
                      <div key={shortcut.id} className={cn(
                        "p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group",
                        isShortcutPinned(shortcut.id) && "ring-1 ring-primary/30 bg-primary/5"
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {isShortcutPinned(shortcut.id) && <Pin className="w-3 h-3 text-primary fill-primary" />}
                              <p className="font-medium text-sm text-foreground">{shortcut.name}</p>
                            </div>
                            <p className={`text-xs text-muted-foreground mt-1 ${shortcut.isMultiline ? 'whitespace-pre-wrap' : 'truncate'}`}>{shortcut.content}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <SortableControls
                              isPinned={isShortcutPinned(shortcut.id)}
                              onTogglePin={() => toggleShortcutPin(shortcut.id)}
                              onMoveUp={() => moveShortcutUp(shortcut.id)}
                              onMoveDown={() => moveShortcutDown(shortcut.id)}
                              canMoveUp={index > 0}
                              canMoveDown={index < sortedShortcuts.length - 1}
                              size="sm"
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyContent(shortcut)}>{copiedId === shortcut.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}</Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Edit2 className="w-3.5 h-3.5" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem onClick={() => { setEditShortcut(shortcut); setIsNewShortcutOpen(true); }}><Edit2 className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteItem({ type: 'shortcut', item: shortcut })}><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-4"><Zap className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" /><p className="text-xs text-muted-foreground">Nenhum atalho</p></div>
                    )}
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => { setEditShortcut(null); setIsNewShortcutOpen(true); }}><Plus className="w-4 h-4 mr-1" />Novo Atalho</Button>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3">
          {activeCampaign ? (
            <div className="space-y-6">
              <QualitySummary numbers={allNumbers} projects={projects} selectedProjectId={campaignProjectId} onProjectChange={handleProjectChange} onRefresh={() => toast.info("Atualizando...")} />

              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                  <CardTitle>Disparos</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[150px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent className="bg-popover"><SelectItem value="all">Todos os tipos</SelectItem>{actionTypes.map(at => <SelectItem key={at.id} value={at.id}>{at.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={accountFilter} onValueChange={setAccountFilter}>
                      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Conta" /></SelectTrigger>
                      <SelectContent className="bg-popover"><SelectItem value="all">Todas as contas</SelectItem>{userNumbers.map(n => <SelectItem key={n.id} value={n.id}>{n.customName || n.verifiedName}</SelectItem>)}</SelectContent>
                    </Select>
                    <Dialog open={isActionTypesOpen} onOpenChange={setIsActionTypesOpen}>
                      <DialogTrigger asChild><Button size="sm" variant="outline"><Tag className="w-4 h-4 mr-1" />Tipos de Ação</Button></DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5" />Tipos de Ação</DialogTitle></DialogHeader>
                        <div className="mt-4 space-y-4">
                          <div className="flex justify-end"><Button size="sm" onClick={() => { setEditActionType(null); setIsNewActionTypeOpen(true); setIsActionTypesOpen(false); }}><Plus className="w-4 h-4 mr-1" />Novo Tipo</Button></div>
                          {actionTypes.length > 0 ? (
                            <div className="space-y-2">
                              {actionTypes.map((at) => (
                                <div key={at.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                  <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: at.color }} /><span className="font-medium">{at.name}</span></div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditActionType(at); setIsNewActionTypeOpen(true); setIsActionTypesOpen(false); }}><Edit2 className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleteItem({ type: 'actionType', item: at }); setIsActionTypesOpen(false); }}><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8"><Tag className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">Nenhum tipo cadastrado</p></div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="outline" onClick={() => setIsTemplateConfigOpen(true)}>
                      <Settings className="w-4 h-4 mr-1" />
                      Config. Cópia
                    </Button>
                    <Button size="sm" onClick={() => { setEditBroadcast(null); setIsNewBroadcastOpen(true); }}><Plus className="w-4 h-4 mr-1" />Registrar Disparo</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {campaignBroadcasts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Conta</TableHead><TableHead>Lista</TableHead><TableHead>Template</TableHead><TableHead className="text-right">Contatos</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {campaignBroadcasts.map((broadcast) => {
                            const actionType = actionTypes.find(at => at.id === broadcast.actionTypeId);
                            const phoneNum = allNumbers.find(n => n.id === broadcast.phoneNumberId);
                            const currentStatus = getStatusOption(broadcast.status);
                            return (
                              <TableRow key={broadcast.id}>
                                <TableCell><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{format(parse(broadcast.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: ptBR })} {broadcast.time}</span></div></TableCell>
                                <TableCell><Badge style={{ backgroundColor: actionType?.color }}>{actionType?.name || 'N/A'}</Badge></TableCell>
                                <TableCell><div className="flex items-center gap-1.5 text-xs">{phoneNum && <span>{phoneNum.qualityRating === 'HIGH' ? '🟢' : phoneNum.qualityRating === 'MEDIUM' ? '🟡' : '🔴'}</span>}<span className="font-medium truncate max-w-[100px]">{phoneNum?.customName || phoneNum?.verifiedName || 'N/A'}</span></div></TableCell>
                                <TableCell className="text-muted-foreground">{broadcast.listName}</TableCell>
                                <TableCell className="text-muted-foreground">{broadcast.templateUsed}</TableCell>
                                <TableCell className="text-right font-medium">{broadcast.contactCount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Select value={broadcast.status} onValueChange={(value) => handleStatusChange(broadcast.id, value as BroadcastStatus)}>
                                    <SelectTrigger className={`w-[140px] h-8 text-xs ${currentStatus.color}`}><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-popover">{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8" 
                                            onClick={() => handleCopyBroadcast(broadcast)}
                                          >
                                            {copiedBroadcastId === broadcast.id ? (
                                              <Check className="w-4 h-4 text-success" />
                                            ) : (
                                              <Copy className="w-4 h-4" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copiar resumo para WhatsApp</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditBroadcast(broadcast); setIsNewBroadcastOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteItem({ type: 'broadcast', item: broadcast })}><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8"><Send className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-muted-foreground">Nenhum disparo registrado</p></div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-2">Nenhuma campanha selecionada</h3>
              <p className="text-muted-foreground mb-4">Crie sua primeira campanha para começar a registrar seus disparos.</p>
              <Button className="gradient-primary" onClick={() => setIsNewCampaignOpen(true)}><Plus className="w-4 h-4 mr-2" />Criar Primeira Campanha</Button>
            </Card>
          )}
        </div>
      </div>

      <BroadcastModal broadcast={editBroadcast} campaignId={activeCampaign?.id || ''} actionTypes={actionTypes} whatsappNumbers={userNumbers} open={isNewBroadcastOpen} onOpenChange={setIsNewBroadcastOpen} onSave={handleSaveBroadcast} />
      <ActionTypeModal actionType={editActionType} campaignId={activeCampaign?.id || ''} open={isNewActionTypeOpen} onOpenChange={setIsNewActionTypeOpen} onSave={handleSaveActionType} />
      <ShortcutModal shortcut={editShortcut} campaignId={activeCampaign?.id || ''} open={isNewShortcutOpen} onOpenChange={setIsNewShortcutOpen} onSave={handleSaveShortcut} />
      <ConfirmDialog 
        open={!!deleteItem} 
        onOpenChange={(open) => !open && setDeleteItem(null)} 
        title={
          deleteItem?.type === 'broadcast' ? 'Remover Disparo' : 
          deleteItem?.type === 'actionType' ? 'Remover Tipo de Ação' : 
          deleteItem?.type === 'campaign' ? 'Remover Campanha' :
          'Remover Atalho'
        } 
        description={
          deleteItem?.type === 'broadcast' ? 'Tem certeza que deseja remover este disparo?' : 
          deleteItem?.type === 'actionType' ? 'Tem certeza que deseja remover este tipo de ação?' : 
          deleteItem?.type === 'campaign' ? `Tem certeza que deseja remover a campanha "${deleteItem.item.name}"? Todos os disparos, tipos de ação e atalhos serão removidos.` :
          'Tem certeza que deseja remover este atalho?'
        } 
        confirmText="Remover" 
        onConfirm={handleDelete} 
        variant="destructive" 
      />

      {/* Edit Campaign Dialog */}
      <Dialog open={isEditCampaignOpen} onOpenChange={setIsEditCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Campanha</DialogTitle>
          </DialogHeader>
          <form className="space-y-4 mt-4" onSubmit={handleEditCampaignSubmit}>
            <div className="space-y-2">
              <Label htmlFor="edit-campaign-name">Nome da Campanha</Label>
              <Input 
                id="edit-campaign-name" 
                value={editCampaignName} 
                onChange={(e) => setEditCampaignName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-campaign-description">Descrição</Label>
              <Input 
                id="edit-campaign-description" 
                value={editCampaignDescription} 
                onChange={(e) => setEditCampaignDescription(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditCampaignOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-primary">
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BroadcastTemplateConfigModal open={isTemplateConfigOpen} onOpenChange={setIsTemplateConfigOpen} />
    </DashboardLayout>
  );
};

export default Campaigns;
