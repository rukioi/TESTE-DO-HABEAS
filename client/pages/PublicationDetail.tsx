/**
 * PÁGINA DE DETALHES DA PUBLICAÇÃO
 * ===============================
 *
 * Página dedicada para visualizar os detalhes completos de uma publicação
 * baseada no layout fornecido na imagem de referência.
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Printer,
  FileText,
  Calendar,
  Building2,
  Scale,
  User,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Settings,
  Plus,
  Lightbulb,
  ChevronDown,
  ListTodo,
  UserPlus,
  Eye,
} from "lucide-react";
import { Publication, PublicationStatus } from "@/types/publications";
import { apiService } from "@/services/apiService";
import { TaskForm } from "@/components/Tasks/TaskForm";

function mapPublication(record: any): Publication {
  return {
    id: record.id,
    dataPublicacao: new Date(record.publication_date),
    processo: record.process_number || '',
    diario: record.diario || '',
    varaComarca: record.vara_comarca || '',
    nomePesquisado: record.nome_pesquisado || '',
    status: (record.status || 'nova') as PublicationStatus,
    conteudo: record.content || '',
    observacoes: record.observacoes || '',
    responsavel: record.responsavel || undefined,
    numeroProcesso: record.process_number || undefined,
    cliente: undefined,
    urgencia: (record.urgencia || 'media') as any,
    tags: Array.isArray(record.tags) ? record.tags : [],
    atribuidoPara: record.atribuida_para_id ? { id: record.atribuida_para_id, nome: record.atribuida_para_nome || '', email: '', cargo: '', ativo: true } : undefined,
    dataAtribuicao: record.data_atribuicao ? new Date(record.data_atribuicao) : undefined,
    tarefasVinculadas: Array.isArray(record.tarefas_vinculadas) ? record.tarefas_vinculadas : [],
  };
}

const getStatusConfig = (status: PublicationStatus) => {
  const statusConfigs = {
    nova: {
      label: "NOVA",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800",
      icon: FileText
    },
    pendente: {
      label: "PENDENTE",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
      icon: AlertTriangle
    },
    atribuida: {
      label: "ATRIBUÍDA",
      className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800",
      icon: UserPlus
    },
    finalizada: {
      label: "FINALIZADA",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800",
      icon: CheckCircle
    },
    descartada: {
      label: "DESCARTADA",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800",
      icon: Trash2
    }
  };

  return statusConfigs[ status ];
};

export function PublicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ showTaskForm, setShowTaskForm ] = useState(false);
  const [ publicationTasks, setPublicationTasks ] = useState<any[]>([]);
  const [ publication, setPublication ] = useState<Publication | null>(null);
  const [ showRawContent, setShowRawContent ] = useState(false);
  const parsedContent = React.useMemo(() => {
    try { return publication?.conteudo ? JSON.parse(publication.conteudo) : null; } catch { return null; }
  }, [ publication?.conteudo ]);
  const lawsuit = React.useMemo(() => {
    if (!parsedContent) return null;
    const payload = parsedContent?.payload || parsedContent;
    const rd = payload?.response_data || payload?.result?.response_data || payload?.result || payload?.response || parsedContent?.response_data || null;
    return rd || null;
  }, [ parsedContent ]);
  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
  const fmtDateTime = (s?: string) => s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'UTC' }) : '—';
  const fmtCurrency = (n?: number) => typeof n === 'number' ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
  const toArray = (v: any) => Array.isArray(v) ? v : [];
  const safeText = (v: any) => (typeof v === 'string' && v.trim().length > 0) ? v : '—';

  useEffect(() => {
    async function load() {
      try {
        const data = await apiService.getPublication(id!);
        const rec = data.publication || data;
        setPublication(mapPublication(rec));
      } catch (e) {
        setPublication(null);
      }
    }
    if (id) load();
  }, [ id ]);

  if (!publication) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-muted-foreground">Publicação não encontrada</h1>
            <Button onClick={() => navigate("/publicacoes")} className="mt-4">
              Voltar para Publicações
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statusConfig = getStatusConfig(publication.status);
  const StatusIcon = statusConfig.icon;

  const handlePrint = () => {
    window.print();
  };

  const handleDiscard = async () => {
    try {
      await apiService.updatePublication(publication.id, { status: 'descartada' });
      navigate("/publicacoes");
    } catch { }
  };

  const handleComplete = async () => {
    try {
      await apiService.updatePublication(publication.id, { status: 'finalizada' });
      navigate("/publicacoes");
    } catch { }
  };

  /**
   * INTEGRAÇÃO COM SISTEMA DE TAREFAS
   * =================================
   *
   * BACKEND: Quando uma tarefa é criada vinculada à publicação:
   * 1. POST /api/tarefas com { publicacaoId: publication.id }
   * 2. Atualizar campo tarefasVinculadas da publicação
   * 3. Se tarefa for atribuída a alguém, mudar status da publicação para 'atribuida'
   * 4. Enviar notificação para o responsável atribuído
   */
  const handleAddTask = () => {
    setShowTaskForm(true);
  };

  const handleTaskSubmit = async (taskData: any) => {
    try {
      const resp = await apiService.createTask({
        title: taskData.title,
        description: taskData.description,
        assignedTo: taskData.assignedTo,
        priority: taskData.priority,
        startDate: taskData.startDate,
        endDate: taskData.endDate,
        tags: taskData.tags,
        notes: `Vinculada à publicação ${publication.id}`,
      });
      const taskId = resp?.task?.id || resp?.id;
      const tarefas = [ ...(publication.tarefasVinculadas || []), taskId ].filter(Boolean);
      await apiService.updatePublication(publication.id, {
        status: 'atribuida',
        atribuidaParaId: taskData.assignedTo,
        atribuidaParaNome: taskData.assignedToName || '',
        dataAtribuicao: new Date().toISOString(),
        tarefasVinculadas: tarefas,
      });
      setShowTaskForm(false);
      navigate('/tarefas');
    } catch (e) {
      setShowTaskForm(false);
    }
  };


  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/publicacoes")}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>VOLTAR</span>
            </Button>
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Publicação</h1>
              <Badge className={`${statusConfig.className} px-3 py-1 flex items-center space-x-1`}>
                <StatusIcon className="h-3 w-3" />
                <span className="font-medium">{statusConfig.label}</span>
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  GERENCIAMENTOS
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleAddTask}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Tarefa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="destructive" size="sm" onClick={handleDiscard}>
              <Trash2 className="h-4 w-4 mr-2" />
              DESCARTAR
            </Button>
            <Button variant="default" size="sm" onClick={handleComplete}>
              <CheckCircle className="h-4 w-4 mr-2" />
              CONCLUIR
            </Button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lado Esquerdo - Informações da Publicação */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações do Diário */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações da Publicação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Diário</label>
                  <p className="text-sm mt-1 leading-relaxed">{publication.diario}</p>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vara</label>
                  <p className="text-sm mt-1 flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{publication.varaComarca}</span>
                  </p>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Divulgação em</label>
                  <p className="text-sm mt-1 flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {publication.dataPublicacao.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - Publicado em: {publication.dataPublicacao.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                  </p>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Processo</label>
                  <p className="text-sm mt-1 flex items-center space-x-2">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{safeText(publication.processo)}</span>
                  </p>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Termo encontrado</label>
                  <p className="text-sm mt-1 flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{safeText(publication.nomePesquisado)}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhes do Processo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const rd = lawsuit || {};
                  const resumo = rd?.last_step?.content ?? rd?.last_step?.summary;
                  const dataMov = rd?.last_step?.step_date || rd?.last_step?.date || '';
                  const tribunal = rd?.tribunal || rd?.tribunal_acronym || '';
                  const numero = rd?.code || rd?.lawsuit_cnj || publication.numeroProcesso || publication.processo || '';
                  const status = rd?.status || rd?.situation || '';
                  const parties = Array.isArray(rd?.parties) ? rd.parties : [];

                  if (lawsuit) {
                    return (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg border">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">Resumo</div>
                              <div className="font-medium">{safeText(resumo)}</div>
                            </div>
                            {status && (
                              <Badge variant="outline" className="font-mono text-xs">{safeText(status)}</Badge>
                            )}
                          </div>
                          <Separator className="my-4" />
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">Processo</div>
                              <div className="font-mono">{numero || '—'}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">Última movimentação</div>
                              <div className="font-medium">{fmtDateTime(dataMov)}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">Órgão</div>
                              <div className="font-medium">{safeText(tribunal)}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">Partes</div>
                              <div className="font-medium">{parties.length || 0}</div>
                            </div>
                          </div>
                        </div>

                        {parties.length > 0 && (
                          <div className="p-4 rounded-lg border">
                            <div className="text-sm text-muted-foreground mb-2">Partes no processo</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {toArray(parties).map((p: any, idx: number) => (
                                <div key={idx} className="border rounded-lg p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="truncate pr-2">
                                      <div className="font-medium truncate">{p?.name || '—'}</div>
                                      {p?.main_document && (
                                        <div className="text-xs text-muted-foreground">{p.main_document}</div>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="text-xs">{p?.person_type || 'parte'}</Badge>
                                  </div>
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    <span className="mr-2">Lado: {p?.side || '—'}</span>
                                    <span>Inferida: {p?.was_inferred ? 'Sim' : 'Não'}</span>
                                  </div>
                                  {Array.isArray(p?.lawyers) && p.lawyers.length > 0 && (
                                    <div className="mt-2">
                                      <div className="text-xs font-medium">Advogados</div>
                                      <div className="text-xs text-muted-foreground">
                                        {toArray(p.lawyers).map((l: any, i: number) => (
                                          <span key={i} className="mr-2">{l?.name || '—'}{l?.document ? ` (${l.document})` : ''}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {Array.isArray(p?.documents) && p.documents.length > 0 && (
                                    <div className="mt-2">
                                      <div className="text-xs font-medium">Documentos</div>
                                      <div className="text-xs text-muted-foreground">
                                        {toArray(p.documents).map((d: any, i: number) => (
                                          <span key={i} className="mr-2">{d?.document || '—'}{d?.document_type ? ` (${d.document_type})` : ''}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          {/* <Button variant="outline" size="sm" onClick={() => setShowRawContent(v => !v)}>
                            {showRawContent ? 'Ocultar JSON' : 'Ver JSON bruto'}
                          </Button> */}
                        </div>
                        {showRawContent && (
                          <div className="bg-muted/30 p-4 rounded-lg">
                            <pre className="text-xs whitespace-pre-wrap">{publication.conteudo}</pre>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {publication.conteudo || '—'}
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            {lawsuit && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Metadados do Processo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Código</div>
                        <div className="font-mono">{lawsuit.code || '—'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Nome</div>
                        <div className="font-medium">{safeText(lawsuit.name)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Área</div>
                        <div className="font-medium">{safeText(lawsuit.area)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Cidade</div>
                        <div className="font-medium">{safeText(lawsuit.city)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Comarca</div>
                        <div className="font-medium">{safeText(lawsuit.county)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">UF</div>
                        <div className="font-medium">{safeText(lawsuit.state)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Valor</div>
                        <div className="font-medium">{fmtCurrency(lawsuit.amount)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Fase</div>
                        <div className="font-medium">{safeText(lawsuit.phase)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className="font-medium">{safeText(lawsuit.status)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Situação</div>
                        <div className="font-medium">{safeText(lawsuit.situation)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Segredo de Justiça</div>
                        <div className="font-medium">{typeof lawsuit.secrecy_level === 'number' ? lawsuit.secrecy_level : '—'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Justiça Gratuita</div>
                        <div className="font-medium">{lawsuit.free_justice ? 'Sim' : 'Não'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Justiça</div>
                        <div className="font-medium">{safeText(lawsuit.justice)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Descrição da Justiça</div>
                        <div className="font-medium">{safeText(lawsuit.justice_description)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Tribunal</div>
                        <div className="font-medium">{safeText([ lawsuit.tribunal, lawsuit.tribunal_acronym ].filter(Boolean).join(' / '))}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Sistema</div>
                        <div className="font-medium">{safeText(lawsuit.system)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Instância</div>
                        <div className="font-medium">{typeof lawsuit.instance === 'number' ? lawsuit.instance : '—'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Criado em</div>
                        <div className="font-medium">{fmtDateTime(lawsuit.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Atualizado em</div>
                        <div className="font-medium">{fmtDateTime(lawsuit.updated_at)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Distribuição</div>
                        <div className="font-medium">{fmtDate(lawsuit.distribution_date)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Assuntos e Classificações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Assuntos</div>
                      <div className="flex flex-wrap gap-2">
                        {toArray(lawsuit.subjects).map((s: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{[ s.code, s.name ].filter(Boolean).join(' - ')}</Badge>
                        ))}
                        {(!Array.isArray(lawsuit.subjects) || lawsuit.subjects.length === 0) && <span className="text-sm text-muted-foreground">—</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Classificações</div>
                      <div className="flex flex-wrap gap-2">
                        {toArray(lawsuit.classifications).map((c: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{[ c.code, c.name ].filter(Boolean).join(' - ')}</Badge>
                        ))}
                        {(!Array.isArray(lawsuit.classifications) || lawsuit.classifications.length === 0) && <span className="text-sm text-muted-foreground">—</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Órgãos/Cortes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {toArray(lawsuit.courts).map((c: any, i: number) => (
                        <div key={i} className="border rounded-lg p-3">
                          <div className="text-sm text-muted-foreground">Código</div>
                          <div className="font-mono">{safeText(c.code)}</div>
                          <div className="text-sm text-muted-foreground mt-2">Nome</div>
                          <div className="font-medium">{safeText(c.name)}</div>
                        </div>
                      ))}
                      {(!Array.isArray(lawsuit.courts) || lawsuit.courts.length === 0) && <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Andamentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {toArray(lawsuit.steps).map((s: any) => (
                        <div key={s.step_id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-xs">{s.step_id}</div>
                            <Badge variant="outline" className="text-xs">{s.private ? 'Privado' : 'Público'}</Badge>
                          </div>
                          <div className="text-sm mt-1">{safeText(s.content)}</div>
                          <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-muted-foreground">
                            <div>Data: {fmtDateTime(s.step_date)}</div>
                            <div>Atualizado: {fmtDateTime(s.updated_at)}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-muted-foreground">
                            <div>CNJ: {s.lawsuit_cnj || '—'}</div>
                            <div>Instância: {typeof s.lawsuit_instance === 'number' ? s.lawsuit_instance : '—'}</div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">crawl_id: {s?.tags?.crawl_id || '—'}</div>
                        </div>
                      ))}
                      {(!Array.isArray(lawsuit.steps) || lawsuit.steps.length === 0) && <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Anexos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {toArray(lawsuit.attachments).map((a: any) => (
                        <div key={a.attachment_id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-xs">{a.attachment_id}</div>
                            <Badge variant="outline" className="text-xs">{a.status || '—'}</Badge>
                          </div>
                          <div className="text-sm font-medium mt-1">{safeText(a.attachment_name)}</div>
                          <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-muted-foreground">
                            <div>Data: {fmtDate(a.attachment_date)}</div>
                            <div>Extensão: {a.extension || '—'}</div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">crawl_id: {a?.tags?.crawl_id || '—'}</div>
                        </div>
                      ))}
                      {(!Array.isArray(lawsuit.attachments) || lawsuit.attachments.length === 0) && <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Processos Relacionados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {toArray(lawsuit.related_lawsuits).map((r: any, i: number) => (
                        <div key={i} className="border rounded-lg p-3">
                          <div className="text-sm text-muted-foreground">Código</div>
                          <div className="font-mono">{safeText(r.code)}</div>
                          <div className="text-sm text-muted-foreground mt-2">Tribunal</div>
                          <div className="font-medium">{safeText(r.tribunal)}</div>
                        </div>
                      ))}
                      {(!Array.isArray(lawsuit.related_lawsuits) || lawsuit.related_lawsuits.length === 0) && <span className="text-sm text-muted-foreground">—</span>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Crawler e Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">crawl_id</div>
                        <div className="font-mono">{lawsuit?.crawler?.crawl_id || lawsuit?.tags?.crawl_id || '—'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Fonte</div>
                        <div className="font-medium">{lawsuit?.crawler?.source_name || '—'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Atualizado</div>
                        <div className="font-medium">{fmtDateTime(lawsuit?.crawler?.updated_at)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Peso</div>
                        <div className="font-medium">{typeof lawsuit?.crawler?.weight === 'number' ? lawsuit.crawler.weight : '—'}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Dicionário</div>
                        <div className="font-medium">{fmtDateTime(lawsuit?.tags?.dictionary_updated_at)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Lado Direito - Informações do Processo */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">PROCESSO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Número</label>
                  <p className="text-sm mt-1 font-mono text-primary">
                    {publication.numeroProcesso || publication.processo}
                  </p>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <p className="text-sm mt-1 font-medium">
                    {publication.cliente || publication.nomePesquisado}
                  </p>
                </div>

                {publication.responsavel && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Responsável</label>
                      <p className="text-sm mt-1">{publication.responsavel}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tratamentos Sugeridos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">GERENCIAMENTOS SUGERIDOS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Esta publicação tem <span className="font-semibold">67%</span> de chances de conter um prazo
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    ADICIONAR PRAZO DE 5 DIAS
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de Criação de Tarefa */}
        <TaskForm
          open={showTaskForm}
          onOpenChange={setShowTaskForm}
          onSubmit={handleTaskSubmit}
          isEditing={false}
        />
      </div>
    </DashboardLayout>
  );
}
