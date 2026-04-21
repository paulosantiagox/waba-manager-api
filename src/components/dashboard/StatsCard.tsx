import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

const StatsCard = ({ title, value, subtitle, icon: Icon, trend, variant = 'default' }: StatsCardProps) => {
  const variants = {
    default: 'bg-card',
    primary: 'gradient-primary text-primary-foreground',
    success: 'gradient-success text-success-foreground',
    warning: 'gradient-warning text-warning-foreground',
  };

  const isColored = variant !== 'default';

  return (
    <div className={cn(
      "rounded-xl p-6 shadow-card border border-border/50 animate-slide-up transition-all duration-300 hover:shadow-elevated hover:-translate-y-1",
      variants[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            isColored ? "opacity-90" : "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && (
            <p className={cn(
              "text-sm",
              isColored ? "opacity-80" : "text-muted-foreground"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={cn(
              "text-sm font-medium",
              trend.positive ? "text-success" : "text-destructive"
            )}>
              {trend.positive ? '+' : ''}{trend.value}% vs mês anterior
            </p>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          isColored ? "bg-white/20" : "bg-primary/10"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            isColored ? "" : "text-primary"
          )} />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
