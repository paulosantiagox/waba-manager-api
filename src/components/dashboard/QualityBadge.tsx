import { cn } from '@/lib/utils';
import { QualityRating } from '@/types';

interface QualityBadgeProps {
  rating: QualityRating;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const QualityBadge = ({ rating, showLabel = true, size = 'md' }: QualityBadgeProps) => {
  const config = {
    HIGH: {
      color: 'bg-success text-success-foreground',
      dot: 'bg-success',
      label: 'Alta',
      emoji: '🟢'
    },
    MEDIUM: {
      color: 'bg-warning text-warning-foreground',
      dot: 'bg-warning',
      label: 'Média',
      emoji: '🟡'
    },
    LOW: {
      color: 'bg-destructive text-destructive-foreground',
      dot: 'bg-destructive',
      label: 'Baixa',
      emoji: '🔴'
    }
  };

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1'
  };

  const { color, label, emoji } = config[rating] ?? config.MEDIUM;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      color,
      sizeClasses[size]
    )}>
      <span>{emoji}</span>
      {showLabel && <span>{label}</span>}
    </span>
  );
};

export default QualityBadge;
