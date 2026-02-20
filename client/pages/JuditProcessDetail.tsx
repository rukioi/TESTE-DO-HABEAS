import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiService } from "@/services/apiService";
import {
  FileSearch,
  Scale,
  Building2,
  Calendar,
  User,
  RefreshCw,
  ArrowLeft,
  FileText,
} from "lucide-react";

export function JuditProcessDetail() {
  const { responseId } = useParams();
  const navigate = useNavigate();
  const [ loading, setLoading ] = React.useState(false);
  const [ syncing, setSyncing ] = React.useState(false);
  const [ item, setItem ] = React.useState<any | null>(null);

  const load = React.useCallback(async () => {
    if (!responseId) return;
    setLoading(true);
    try {
      const data = await apiService.getJuditHistoryItem(responseId);
      setItem(data?.item || null);
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [ responseId ]);

  React.useEffect(() => { load(); }, [ load ]);

  const handleSync = async () => {
    if (!item?.tracking_id) return;
    setSyncing(true);
    try {
      await apiService.getJuditTrackingHistory(item.tracking_id, { page: 1, page_size: 50, forceSync: 'true' });
      await load();
    } catch {
    } finally {
      setSyncing(false);
    }
  };

  const d = item?.response_data || {};
  const numero = d?.code || d?.lawsuit_cnj || '';
  const diario = d?.tribunal_acronym || '';
  const vara = d?.county || d?.courts?.[ 0 ]?.name || d?.city || '';
  const status = d?.status || d?.state || '';
  const ultima = d?.last_step?.content || d?.last_step?.summary || '';
  const dataUltima = d?.last_step?.date || d?.updated_at || d?.crawler?.updated_at || undefined;
  const partes = Array.isArray(d?.parties) ? d.parties : [];
  const subjects = Array.isArray(d?.subjects) ? d.subjects : [];
  const amount = d?.amount;
  const area = d?.area || '';
  const stepsRaw = Array.isArray(d?.steps) ? d.steps : Array.isArray(d?.movement) ? d.movement : Array.isArray(d?.andamentos) ? d.andamentos : [];
  const steps = stepsRaw.map((s: any) => ({
    date: s?.date || s?.datetime || s?.moved_at || s?.updated_at,
    content: s?.content || s?.summary || s?.status || s?.title,
    id: s?.id || s?.step_id || s?.code || s?.slug,
  }));
  const sortedSteps = steps.sort((a: any, b: any) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSearch className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Processo Judit</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleSync} disabled={syncing || loading || !item?.tracking_id}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {syncing ? "Atualizando..." : "Atualizar da Judit"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-mono text-sm">{numero || '—'}</span>
                <Badge className="px-2 py-1 text-xs">{status || '—'}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Response ID: <span className="font-mono">{item?.response_id}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Informações do Processo
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Scale className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Número do Processo
                        </p>
                        <p className="font-mono text-sm text-muted-foreground">
                          {numero || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Vara/Comarca</p>
                        <p className="text-sm text-muted-foreground">
                          {vara || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Diário</p>
                        <p className="text-sm text-muted-foreground">
                          {diario || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Área</p>
                        <p className="text-sm text-muted-foreground">
                          {area || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Valor da Causa</p>
                        <p className="text-sm text-muted-foreground">
                          {amount !== undefined ? `R$ ${Number(amount).toLocaleString('pt-BR')}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Status e Movimentação
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Status Atual</p>
                        <p className="text-sm text-muted-foreground">
                          {status || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Última movimentação</p>
                        <p className="text-sm text-muted-foreground">
                          {dataUltima ? new Date(dataUltima).toLocaleString('pt-BR') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Resumo</p>
                        <p className="text-sm text-muted-foreground">
                          {ultima || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Partes
                </h3>
                <div className="space-y-2">
                  {partes.length > 0 ? partes.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.side || p.type || 'Parte'}</p>
                      </div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">Nenhuma parte listada</div>}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Assuntos
                </h3>
                <div className="space-y-2">
                  {subjects.length > 0 ? subjects.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                      </div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">Nenhum assunto listado</div>}
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Andamentos
              </h3>
              {sortedSteps.length > 0 ? (
                <ScrollArea className="h-[360px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Conteúdo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSteps.map((s: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">
                            {s.date ? new Date(s.date).toLocaleString('pt-BR') : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{s.content || '—'}</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum andamento disponível</div>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Detalhes Brutos
              </h3>
              <ScrollArea className="h-[280px]">
                <pre className="text-xs bg-muted/30 p-3 rounded-md overflow-x-auto">
                  {JSON.stringify(d, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
