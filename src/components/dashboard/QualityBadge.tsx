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
    sm: 'text-sm px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const { color, label, emoji } = config[rating];

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
