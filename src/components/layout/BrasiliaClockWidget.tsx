import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface ClockWidgetProps {
  collapsed?: boolean;
  timezone: string;
  label: string;
}

function getOffsetVsBrasilia(timezone: string, now: Date): string {
  if (timezone === 'America/Sao_Paulo') return '';

  // Get hour in each timezone
  const getHour = (tz: string) =>
    parseFloat(new Intl.DateTimeFormat('en', { timeZone: tz, hour: 'numeric', hour12: false }).format(now));
  const getMin = (tz: string) =>
    parseFloat(new Intl.DateTimeFormat('en', { timeZone: tz, minute: 'numeric' }).format(now));

  const toMinutes = (tz: string) => getHour(tz) * 60 + getMin(tz);

  let diff = toMinutes(timezone) - toMinutes('America/Sao_Paulo');
  // Wrap around midnight
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;

  const h = Math.floor(Math.abs(diff) / 60);
  const m = Math.abs(diff) % 60;
  const sign = diff >= 0 ? '+' : '-';
  return m > 0 ? `${sign}${h}h${m}` : `${sign}${h}h`;
}

export function ClockWidget({ collapsed = false, timezone, label }: ClockWidgetProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const offset = getOffsetVsBrasilia(timezone, now);

  // Formatar data completa em português
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Formatar hora com segundos
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = dateFormatter.format(now);
  const formattedTime = timeFormatter.format(now);

  // Capitalizar primeira letra do dia da semana
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-1 px-1">
        <span className="text-[8px] text-sidebar-foreground/50 uppercase">{label.split(' ')[0]}</span>
        <span className="text-xs font-mono font-semibold text-sidebar-foreground">
          {formattedTime.slice(0, 5)}
        </span>
        {offset && (
          <span className="text-[8px] font-mono text-sidebar-foreground/40">{offset}</span>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 mb-1 rounded-lg bg-sidebar-accent/50">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-3.5 h-3.5 text-sidebar-foreground/60" />
        <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wide flex-1">
          {label}
        </span>
        {offset && (
          <span className="text-[10px] font-mono font-semibold text-sidebar-foreground/50 bg-sidebar-accent px-1.5 py-0.5 rounded-full">
            {offset}
          </span>
        )}
      </div>
      <p className="text-xs text-sidebar-foreground/80 capitalize leading-tight">
        {capitalizedDate}
      </p>
      <p className="text-lg font-mono font-bold text-sidebar-foreground tabular-nums">
        {formattedTime}
      </p>
    </div>
  );
}

// Componente legado para compatibilidade
export function BrasiliaClockWidget({ collapsed = false }: { collapsed?: boolean }) {
  return <ClockWidget collapsed={collapsed} timezone="America/Sao_Paulo" label="Horário de Brasília" />;
}

export function ManausClockWidget({ collapsed = false }: { collapsed?: boolean }) {
  return <ClockWidget collapsed={collapsed} timezone="America/Manaus" label="Horário de Manaus" />;
}
