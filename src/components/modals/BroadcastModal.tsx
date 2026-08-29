import { useState, useEffect } from 'react';
import { Broadcast, ActionType, WhatsAppNumber, BroadcastStatus } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Phone, Tag, Ban } from 'lucide-react';
import { numeroBloqueado, rotuloStatusNumero } from '@/hooks/useAccountHealth';

interface BroadcastModalProps {
  broadcast: Broadcast | null;
  /** Dados de origem para pré-preencher ao DUPLICAR (cria um novo disparo). Ignorado quando `broadcast` está setado (edição). */
  initialData?: Broadcast | null;
  campaignId: string;
  actionTypes: ActionType[];
  whatsappNumbers: WhatsAppNumber[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (broadcast: Broadcast) => void;
}

const BroadcastModal = ({
  broadcast,
  initialData,
  campaignId,
  actionTypes,
  whatsappNumbers,
  open,
  onOpenChange,
  onSave
}: BroadcastModalProps) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [actionTypeId, setActionTypeId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [listName, setListName] = useState('');
  const [templateUsed, setTemplateUsed] = useState('');
  const [contactCount, setContactCount] = useState('');
  const [observations, setObservations] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!broadcast;
  const activeActionTypes = actionTypes.filter(at => at.isActive);

  useEffect(() => {
    // Em edição usa `broadcast`; ao duplicar (broadcast null) usa `initialData` para pré-preencher.
    const source = broadcast ?? initialData;
    if (source) {
      setDate(source.date);
      setTime(source.time);
      setActionTypeId(source.actionTypeId);
      setPhoneNumberId(source.phoneNumberId);
      setListName(source.listName);
      setTemplateUsed(source.templateUsed);
      setContactCount(source.contactCount.toString());
      setObservations(source.observations || '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toTimeString().slice(0, 5);
      setDate(today);
      setTime(now);
      setActionTypeId('');
      setPhoneNumberId('');
      setListName('');
      setTemplateUsed('');
      setContactCount('');
      setObservations('');
    }
    setErrors({});
  }, [broadcast, initialData, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!date) newErrors.date = 'Data é obrigatória';
    if (!time) newErrors.time = 'Hora é obrigatória';
    if (!actionTypeId) newErrors.actionTypeId = 'Tipo é obrigatório';
    if (!phoneNumberId) newErrors.phoneNumberId = 'Conta é obrigatória';
    if (!listName.trim()) newErrors.listName = 'Lista é obrigatória';
    if (!templateUsed.trim()) newErrors.templateUsed = 'Template é obrigatório';
    if (!contactCount || parseInt(contactCount) <= 0) {
      newErrors.contactCount = 'Quantidade deve ser maior que 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const newBroadcast: Broadcast = {
      id: broadcast?.id || `b_${Date.now()}`,
      campaignId,
      date,
      time,
      actionTypeId,
      phoneNumberId,
      listName: listName.trim(),
      templateUsed: templateUsed.trim(),
      contactCount: parseInt(contactCount),
      observations: observations.trim() || undefined,
      status: broadcast?.status || 'preparing',
      createdAt: broadcast?.createdAt || new Date().toISOString(),
    };
    
    onSave(newBroadcast);
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            {isEditing ? 'Editar Disparo' : 'Registrar Novo Disparo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={errors.date ? 'border-destructive' : ''}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora *</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={errors.time ? 'border-destructive' : ''}
              />
              {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
            </div>
          </div>

          {/* Account Select */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Conta Usada *
            </Label>
            <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
              <SelectTrigger className={errors.phoneNumberId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione uma conta WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                {whatsappNumbers.length > 0 ? (
                  whatsappNumbers.map((num) => (
                    <SelectItem key={num.id} value={num.id}>
                      <div className="flex items-center gap-2">
                        {/* Bloqueio na Meta prevalece sobre a qualidade */}
                        <span className={
                          numeroBloqueado(num.metaStatus) ? 'text-destructive' :
                          num.qualityRating === 'HIGH' ? 'text-success' :
                          num.qualityRating === 'MEDIUM' ? 'text-warning' : 'text-destructive'
                        }>
                          {numeroBloqueado(num.metaStatus) ? '⛔' :
                           num.qualityRating === 'HIGH' ? '🟢' :
                           num.qualityRating === 'MEDIUM' ? '🟡' : '🔴'}
                        </span>
                        {num.customName || num.verifiedName} - {num.displayPhoneNumber}
                        {numeroBloqueado(num.metaStatus) && (
                          <span className="text-xs font-semibold text-destructive">
                            ({rotuloStatusNumero(num.metaStatus)})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhuma conta cadastrada
                  </div>
                )}
              </SelectContent>
            </Select>
            {errors.phoneNumberId && <p className="text-xs text-destructive">{errors.phoneNumberId}</p>}
            {(() => {
              const escolhido = whatsappNumbers.find(n => n.id === phoneNumberId);
              if (!escolhido || !numeroBloqueado(escolhido.metaStatus)) return null;
              return (
                <p className="text-xs text-destructive flex items-start gap-1 bg-destructive/10 border border-destructive/30 rounded p-2">
                  <Ban className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Este número está {rotuloStatusNumero(escolhido.metaStatus)?.toLowerCase()} na Meta e
                  não consegue enviar mensagens. O disparo provavelmente vai falhar.
                </p>
              );
            })()}
          </div>

          {/* Action Type Select */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tipo de Ação *
            </Label>
            <Select value={actionTypeId} onValueChange={setActionTypeId}>
              <SelectTrigger className={errors.actionTypeId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione o tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                {activeActionTypes.length > 0 ? (
                  activeActionTypes.map((at) => (
                    <SelectItem key={at.id} value={at.id}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: at.color }}
                        />
                        {at.name}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum tipo de ação cadastrado
                  </div>
                )}
              </SelectContent>
            </Select>
            {errors.actionTypeId && <p className="text-xs text-destructive">{errors.actionTypeId}</p>}
          </div>

          {/* List Name */}
          <div className="space-y-2">
            <Label htmlFor="listName">Lista Utilizada *</Label>
            <Input
              id="listName"
              placeholder="Ex: Lista VIP Janeiro"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className={errors.listName ? 'border-destructive' : ''}
            />
            {errors.listName && <p className="text-xs text-destructive">{errors.listName}</p>}
          </div>

          {/* Template */}
          <div className="space-y-2">
            <Label htmlFor="templateUsed">Template Usado *</Label>
            <Input
              id="templateUsed"
              placeholder="Ex: promo_janeiro_01"
              value={templateUsed}
              onChange={(e) => setTemplateUsed(e.target.value)}
              className={errors.templateUsed ? 'border-destructive' : ''}
            />
            {errors.templateUsed && <p className="text-xs text-destructive">{errors.templateUsed}</p>}
          </div>

          {/* Contact Count */}
          <div className="space-y-2">
            <Label htmlFor="contactCount">Quantidade de Contatos *</Label>
            <Input
              id="contactCount"
              type="number"
              min="1"
              placeholder="Ex: 500"
              value={contactCount}
              onChange={(e) => setContactCount(e.target.value)}
              className={errors.contactCount ? 'border-destructive' : ''}
            />
            {errors.contactCount && <p className="text-xs text-destructive">{errors.contactCount}</p>}
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              placeholder="Anotações sobre este disparo..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-primary">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              isEditing ? 'Salvar Alterações' : 'Registrar Disparo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BroadcastModal;
