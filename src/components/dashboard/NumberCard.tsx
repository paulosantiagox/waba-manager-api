import { WhatsAppNumber } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import QualityBadge from './QualityBadge';
import { Phone, History, Edit2, Trash2, MessageCircle, Eye, EyeOff, Tag, Ban, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { numeroBloqueado, rotuloStatusNumero } from '@/hooks/useAccountHealth';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NumberCardProps {
  number: WhatsAppNumber;
  onViewHistory?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: (visible: boolean) => void;
}

const NumberCard = ({ number, onViewHistory, onEdit, onDelete, onToggleVisibility }: NumberCardProps) => {
  const getRecoveryDate = () => {
    if (number.qualityRating === 'HIGH') return null;
    const recoveryDate = addDays(new Date(number.lastChecked), 7);
    return format(recoveryDate, "dd/MM/yyyy", { locale: ptBR });
  };

  const recoveryDate = getRecoveryDate();
  const daysToRecovery = () => {
    if (number.qualityRating === 'HIGH') return null;
    const recoveryDate = addDays(new Date(number.lastChecked), 7);
    const today = new Date();
    const diffTime = recoveryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const days = daysToRecovery();

  // Bloqueio na Meta tem prioridade sobre a qualidade: um número BANIDO segue
  // com quality_rating GREEN, então sem isto ele aparecia como "🟢 Alta".
  const bloqueado = numeroBloqueado(number.metaStatus);
  const rotuloBloqueio = rotuloStatusNumero(number.metaStatus);
  const nomeReprovado = number.nameStatus === 'DECLINED';

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 hover:shadow-elevated animate-slide-up",
      !number.isVisible && "opacity-50 grayscale scale-95",
      bloqueado && "ring-2 ring-destructive/60"
    )}>
      {/* Status indicator bar */}
      <div className={cn(
        "h-1",
        bloqueado ? "bg-destructive" : [
          number.qualityRating === 'HIGH' && "gradient-success",
          number.qualityRating === 'MEDIUM' && "gradient-warning",
          number.qualityRating === 'LOW' && "gradient-danger",
        ]
      )} />
      
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar/Photo */}
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {number.photo ? (
                <img 
                  src={number.photo} 
                  alt={number.verifiedName} 
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <Phone className="w-6 h-6 text-primary" />
              )}
            </div>
            {number.isVisible && (
              <div className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Custom Name */}
            {number.customName && (
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold text-foreground text-sm">{number.customName}</span>
              </div>
            )}
            
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                ✓ {number.verifiedName}
              </p>
              <h3 className="font-medium text-foreground">
                {number.displayPhoneNumber}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Bloqueio na Meta vem primeiro — é o que importa de fato */}
              {rotuloBloqueio && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                  bloqueado
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-warning/15 text-warning border border-warning/30'
                )}>
                  <Ban className="w-3 h-3" />
                  {rotuloBloqueio}
                </span>
              )}
              <QualityBadge rating={number.qualityRating} size="sm" />
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {number.messagingLimitTier}
              </span>
            </div>

            {nomeReprovado && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Nome comercial reprovado pela Meta
              </p>
            )}

            {bloqueado && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Ban className="w-3 h-3 flex-shrink-0" />
                Número não pode enviar mensagens — verifique em business.facebook.com/accountquality
              </p>
            )}

            {recoveryDate && (
              <p className={cn(
                "text-sm flex items-center gap-1",
                number.qualityRating === 'MEDIUM' ? "text-warning" : "text-destructive"
              )}>
                {number.qualityRating === 'MEDIUM' ? '⚠️' : '⛔'} Recuperação em {days} dias ({recoveryDate})
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              ID: {number.phoneNumberId}
            </p>
          </div>
        </div>

        {/* Visibility Toggle */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            {number.isVisible ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">Visível</span>
            <Switch 
              checked={number.isVisible}
              onCheckedChange={onToggleVisibility}
              className="scale-75"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onViewHistory}
          >
            <History className="w-4 h-4 mr-1" />
            Histórico
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NumberCard;
