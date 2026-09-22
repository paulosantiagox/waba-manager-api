import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AlertasSaudeMeta from '@/components/dashboard/AlertasSaudeMeta';
import { useAllWhatsAppNumbers } from '@/hooks/useWhatsAppNumbers';
import { useVerificarSaude } from '@/hooks/useAccountHealth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Alertas da Meta (banimento, bloqueio, pagamento, nome reprovado) numa tela
 * própria. Saiu do Dashboard a pedido: quem quer ver, entra aqui.
 */
const AlertasMeta = () => {
  const { can } = useAuth();
  const { data: numeros = [], isLoading } = useAllWhatsAppNumbers();
  const { mutateAsync: verificarSaude } = useVerificarSaude();
  const [verificando, setVerificando] = useState(false);

  const verificarAgora = async () => {
    setVerificando(true);
    try {
      const disparadas = await verificarSaude();
      toast.success(disparadas > 0 ? 'Contas verificadas na Meta' : 'Já havia uma verificação em andamento');
    } catch (e) {
      toast.error(`Erro ao verificar: ${e instanceof Error ? e.message : 'desconhecido'}`);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Alertas da Meta
          </h1>
          <p className="text-muted-foreground mt-1">
            Banimentos, bloqueios, erro de pagamento e nomes reprovados em todas as contas
          </p>
        </div>
        {can('user') && (
          <Button onClick={verificarAgora} disabled={verificando} className="gap-2">
            {verificando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            {verificando ? 'Verificando…' : 'Verificar agora'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className={cn('max-w-5xl')}>
          <AlertasSaudeMeta numeros={numeros} abertoPorPadrao />
        </div>
      )}
    </DashboardLayout>
  );
};

export default AlertasMeta;
