/**
 * PÁGINA PRINCIPAL - PAINEL DE PUBLICAÇÕES
 * =======================================
 *
 * Página principal do módulo de Publicações com navegação por abas.
 * Inclui duas seções: Publicações e Consultar Cliente/Processos.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Newspaper,
  Search,
  Filter,
  Eye,
  Plus,
  FileSearch,
  Calendar,
  Building2,
  Scale,
  RefreshCw,
} from "lucide-react";
import { Publication, PublicationStatus } from "@/types/publications";
import { apiService } from "@/services/apiService";
import { ProcessViewDialog } from "@/components/Publications/ProcessViewDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

function mapBackendStatus(s: string | undefined): PublicationStatus {
  if (!s) return 'nova';
  const v = s.toLowerCase();
  if (v === 'nova' || v === 'novo') return 'nova';
  if (v === 'lido' || v === 'pendente') return 'pendente';
  if (v === 'atribuida' || v === 'atribuído') return 'atribuida';
  if (v === 'finalizada' || v === 'finalizado') return 'finalizada';
  if (v === 'arquivado' || v === 'descartada') return 'descartada';
  return 'nova';
}

const getStatusBadge = (status: PublicationStatus) => {
  const statusConfig = {
    nova: {
      label: "Nova",
      variant: "default" as const,
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    pendente: {
      label: "Pendente",
      variant: "secondary" as const,
      color:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    atribuida: {
      label: "Atribuída",
      variant: "outline" as const,
      color:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
    finalizada: {
      label: "Finalizada",
      variant: "outline" as const,
      color:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    descartada: {
      label: "Descartada",
      variant: "destructive" as const,
      color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  };

  return statusConfig[ status ];
};

const getUrgencyColor = (urgencia?: string) => {
  switch (urgencia) {
    case "alta":
      return "text-red-600";
    case "media":
      return "text-yellow-600";
    case "baixa":
      return "text-green-600";
    default:
      return "text-gray-600";
  }
};

const htmlToText = (html?: string): string => {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = doc.body.textContent || "";
  return text.replace(/\s+/g, " ").trim();
};

export function Publications() {
  const [ activeTab, setActiveTab ] = useState("consultar");
  const [ searchTerm, setSearchTerm ] = useState("");
  const [ statusFilter, setStatusFilter ] = useState<string>("all");
  const [ extraFilterType, setExtraFilterType ] = useState<string>("none");
  const [ extraFilterValue, setExtraFilterValue ] = useState<string>("");
  const [ isLoading, setIsLoading ] = useState(false);
  const navigate = useNavigate();
  const [ publications, setPublications ] = useState<Publication[]>([]);

  // Estados para consulta de projetos
  const [ oabNumber, setOabNumber ] = useState("");
  const [ oabState, setOabState ] = useState("");
  const [ isSearching, setIsSearching ] = useState(false);
  const [ searchResults, setSearchResults ] = useState<any[]>([]);
  const [ archivedProjects, setArchivedProjects ] = useState<any[]>([]);
  const [ hasSearched, setHasSearched ] = useState(false);
  const [ showProcessDialog, setShowProcessDialog ] = useState(false);
  const [ viewingProcess, setViewingProcess ] = useState<any>(null);
  const [ juditRequests, setJuditRequests ] = useState<any[]>([]);
  const [ isLoadingRequests, setIsLoadingRequests ] = useState(false);
  const [ juditTrackings, setJuditTrackings ] = useState<any[]>([]);
  const [ isLoadingTrackings, setIsLoadingTrackings ] = useState(false);
  const [ isSyncingTrackings, setIsSyncingTrackings ] = useState(false);
  const COOLDOWN_MS = 30000;
  const [ tick, setTick ] = useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const getRemainingForReq = (reqId: string) => {
    const ts = Number(localStorage.getItem(`juditCooldownReq:${reqId}`) || 0);
    const diff = Date.now() - ts;
    const left = COOLDOWN_MS - diff;
    return Math.max(0, left);
  };
  const getRemainingForKey = (key: string) => {
    const ts = Number(localStorage.getItem(`juditCooldownKey:${key}`) || 0);
    const diff = Date.now() - ts;
    const left = COOLDOWN_MS - diff;
    return Math.max(0, left);
  };
  const [ showHistoryDialog, setShowHistoryDialog ] = useState(false);
  const [ historyData, setHistoryData ] = useState<any>(null);
  const [ historyTrackingId, setHistoryTrackingId ] = useState<string | null>(null);
  const [ isSyncingHistory, setIsSyncingHistory ] = useState(false);
  const [ createType, setCreateType ] = useState("lawsuit_cnj");
  const [ createKey, setCreateKey ] = useState("");
  const [ createResponseType, setCreateResponseType ] = useState("lawsuit");
  const [ isCreating, setIsCreating ] = useState(false);
  const [ createOnDemand, setCreateOnDemand ] = useState(false);
  const [ createIAEnabled, setCreateIAEnabled ] = useState(false);

  const [ monitorType, setMonitorType ] = useState<'cpf' | 'cnpj' | 'oab' | 'name' | 'lawsuit_cnj' | 'lawsuit_id'>('lawsuit_cnj');
  const [ monitorKey, setMonitorKey ] = useState('');
  const [ monitorRecurrence, setMonitorRecurrence ] = useState<number>(1);
  const [ monitorEmails, setMonitorEmails ] = useState('');
  const [ monitorStepTerms, setMonitorStepTerms ] = useState('');
  const [ monitorFixedTime, setMonitorFixedTime ] = useState(false);
  const [ monitorHourRange, setMonitorHourRange ] = useState<number>(21);
  const [ monitorWithAttachments, setMonitorWithAttachments ] = useState(false);
  const [ isRegistering, setIsRegistering ] = useState(false);
  const [ juditQuota, setJuditQuota ] = useState<{ used: number; max: number } | null>(null);

  const handleViewPublication = async (publication: Publication) => {
    try {
      if (publication.status === 'nova') {
        await apiService.updatePublication(publication.id, { status: 'pendente' });
      }
      navigate(`/publicacoes/${publication.id}`);
    } catch { }
  };

  const refreshPublications = async () => {
    const params: any = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    const data = await apiService.getPublications(params);
    const list = Array.isArray(data.publications) ? data.publications : [];
    const deriveFromJuditContent = (raw: string) => {
      try {
        const obj = JSON.parse(raw || '{}');
        const payload = obj?.payload || obj;
        const rd = payload?.response_data || payload?.result || payload?.response || {};
        const processo = rd?.code || rd?.lawsuit_cnj || '';
        const courts = Array.isArray(rd?.courts) ? rd.courts : [];
        const courtName = courts[ 0 ]?.name || '';
        const varaComarca = courtName || rd?.tribunal_acronym || rd?.tribunal || '';
        const parties = Array.isArray(rd?.parties) ? rd.parties : [];
        const nomePesquisado = parties[ 0 ]?.name || parties[ 0 ]?.document || '';
        const documentoPesquisado = parties[ 0 ]?.document || '';
        const diario = rd?.tribunal_acronym || '';
        const endRaw = rd?.end_date || rd?.closing_date || rd?.endAt || rd?.deadline_date || rd?.due_date || undefined;
        const dataEncerramento = endRaw ? new Date(String(endRaw)) : undefined;
        const searchType = payload?.search?.search_type || '';
        const searchKey = payload?.search?.search_key || '';
        const statusRaw = (rd?.status || rd?.state || '').toString().toLowerCase();
        const baseTag = statusRaw.includes('final') || statusRaw.includes('conclu') ? 'Concluído' : (statusRaw.includes('cancel') ? 'Cancelado' : 'Em Processo');
        return { processo, varaComarca, nomePesquisado, documentoPesquisado, diario, dataEncerramento, searchType, searchKey, baseTag };
      } catch {
        return { processo: '', varaComarca: '', nomePesquisado: '', documentoPesquisado: '', diario: '', dataEncerramento: undefined, searchType: '', searchKey: '', baseTag: 'Em Processo' };
      }
    };

    const mapped: Publication[] = list.map((p: any) => {
      const judit = p.source === 'Judit' ? deriveFromJuditContent(p.content) : { processo: '', varaComarca: '', nomePesquisado: '', documentoPesquisado: '', diario: '', dataEncerramento: undefined, searchType: '', searchKey: '', baseTag: 'Em Processo' } as any;
      const tagPrincipal = (() => {
        const s = String(p.status || '').toLowerCase();
        if (s.includes('final')) return 'Concluído';
        if (s.includes('descart') || s.includes('arquiv')) return 'Cancelado';
        return judit.baseTag || 'Em Processo';
      })();
      const atencao = (() => {
        if (!judit.dataEncerramento) return false;
        const now = new Date();
        const diff = (judit.dataEncerramento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 30 && tagPrincipal !== 'Concluído';
      })();
      return {
        id: p.id,
        dataPublicacao: new Date(p.publication_date),
        processo: judit.processo || p.process_number || '',
        diario: judit.diario || p.diario || '',
        varaComarca: judit.varaComarca || p.vara_comarca || '',
        nomePesquisado: judit.nomePesquisado || p.nome_pesquisado || '',
        documentoPesquisado: judit.documentoPesquisado || '',
        status: mapBackendStatus(p.status),
        conteudo: p.content,
        urgencia: (p.urgencia || 'media') as any,
        tags: [ ...(atencao ? [ 'Atenção' ] : []), tagPrincipal ],
        atencao,
        dataEncerramento: judit.dataEncerramento,
        juditSearchType: judit.searchType,
        juditSearchKey: judit.searchKey,
      };
    });
    setPublications(mapped);
  };

  const refreshJuditRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const data = await apiService.listJuditRequests();
      const list = Array.isArray(data?.requests) ? data.requests : [];
      setJuditRequests(list);
    } catch {
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleCreateJuditRequest = async () => {
    if (!createKey.trim()) return alert("Informe a chave de busca");
    setIsCreating(true);
    try {
      const normalizedCreateKey = (createType === 'cpf' || createType === 'cnpj' || createType === 'lawsuit_cnj' || createType === 'lawsuit_id')
        ? createKey.replace(/\D+/g, '')
        : createKey.trim();
      const payload: any = { search: { search_type: createType, search_key: normalizedCreateKey, response_type: createResponseType, search_params: {}, on_demand: createOnDemand } };
      if (createIAEnabled) payload.judit_ia = [ "summary" ];
      const result = await apiService.createJuditRequest(payload);
      if (result?.saved) {
        setJuditRequests((prev) => [ result.saved, ...prev ]);
      } else {
        await refreshJuditRequests();
      }
      setCreateKey("");
      alert("Consulta criada");
    } catch {
      alert("Erro ao criar consulta");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadPublications = async () => {
    setIsLoading(true);
    try {
      if (!oabNumber.trim() || !oabState.trim()) {
        alert('Informe OAB e Estado para carregar publicações');
        return;
      }
      await apiService.importCodiloPublications({ oabNumber, uf: oabState });
      await refreshPublications();
    } catch (error) {
      console.error('Erro ao carregar publicações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate5DayTask = () => {
    try {
      // Calcular data 5 dias a partir de hoje
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 5);

      // Criar objeto da tarefa
      const newTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: "Tarefa com prazo de 5 dias",
        description: "Tarefa criada automaticamente com prazo final de 5 dias",
        dueDate: futureDate,
        priority: "media",
        status: "pendente",
        createdAt: new Date(),
        createdBy: "Sistema",
        category: "geral",
        estimatedHours: 2,
      };

      // BACKEND: Implementar criação da tarefa
      // await fetch('/api/tarefas', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(newTask)
      // });

      console.log("Nova tarefa criada:", newTask);

      // Mostrar confirmação para o usuário
      alert(
        `✅ Tarefa criada com sucesso!\n\n📋 Título: ${newTask.title}\n📅 Prazo: ${futureDate.toLocaleDateString("pt-BR")}\n⏰ Data limite: ${futureDate.toLocaleDateString("pt-BR")} às 23:59\n\n🔄 A tarefa foi adicionada ao módulo de Tarefas automaticamente`,
      );

      // FUTURO: Navegar para o módulo de tarefas
      // navigate('/tarefas');
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      alert("❌ Erro ao criar tarefa com prazo de 5 dias. Tente novamente.");
    }
  };

  React.useEffect(() => {
    refreshPublications();
  }, [ statusFilter ]);

  React.useEffect(() => {
    if (activeTab === "consultas-judit") refreshJuditRequests();
    if (activeTab === "consultar") refreshJuditTrackings();
  }, [ activeTab ]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await apiService.get('/publications/external/judit/quota');
        const used = Number(data?.usage?.used || 0);
        const max = Number(data?.plan?.maxQueries || 0);
        setJuditQuota({ used, max });
      } catch (e) {
      }
    })();
  }, []);

  // const filteredPublications = publications.filter((pub) => {
  //   const matchesSearch =
  //     pub?.processo?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
  //     pub?.nomePesquisado?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
  //     pub?.varaComarca?.toLowerCase()?.includes(searchTerm?.toLowerCase());

  //   const matchesStatus = statusFilter === "all" || pub.status === statusFilter;
  //   const extraValue = extraFilterValue.trim().toLowerCase();
  //   const matchesExtra = (() => {
  //     if (!extraValue || extraFilterType === 'none') return true;
  //     if (extraFilterType === 'conta') return (pub?.juditSearchKey || '').toLowerCase().includes(extraValue);
  //     if (extraFilterType === 'nome') return (pub?.nomePesquisado || '').toLowerCase().includes(extraValue);
  //     if (extraFilterType === 'cpf') return (pub?.documentoPesquisado || '').toLowerCase().includes(extraValue);
  //     if (extraFilterType === 'processo') return (pub?.processo || '').toLowerCase().includes(extraValue);
  //     return true;
  //   })();
  //   return matchesSearch && matchesStatus && matchesExtra;
  const filteredPublications = publications.filter((pub) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      (!!pub?.processo && String(pub?.processo).toLowerCase().includes(search)) ||
      (!!pub?.nomePesquisado && String(pub?.nomePesquisado).toLowerCase().includes(search)) ||
      (!!pub?.varaComarca && String(pub?.varaComarca).toLowerCase().includes(search));
    const matchesStatus = statusFilter === "all" || pub.status === statusFilter;
    const extraValue = extraFilterValue.trim().toLowerCase();
    const matchesExtra = (() => {
      if (!extraValue || extraFilterType === 'none') return true;
      if (extraFilterType === 'conta') return (pub?.juditSearchKey || '').toLowerCase().includes(extraValue);
      if (extraFilterType === 'nome') return (pub?.nomePesquisado || '').toLowerCase().includes(extraValue);
      if (extraFilterType === 'cpf') return (pub?.documentoPesquisado || '').toLowerCase().includes(extraValue);
      if (extraFilterType === 'processo') return (pub?.processo || '').toLowerCase().includes(extraValue);
      return true;
    })();
    return matchesSearch && matchesStatus && matchesExtra;
  });

  const sortedPublications = [ ...filteredPublications ].sort((a, b) => {
    if (a.atencao && !b.atencao) return -1;
    if (!a.atencao && b.atencao) return 1;
    return b.dataPublicacao.getTime() - a.dataPublicacao.getTime();
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const recebidasHoje = filteredPublications.filter((p) => p.status === 'nova' && p.dataPublicacao.toISOString().slice(0, 10) === todayISO).length;
  const tratadasHoje = filteredPublications.filter((p) => p.status === 'finalizada' && p.dataPublicacao.toISOString().slice(0, 10) === todayISO).length;
  const descartadasHoje = filteredPublications.filter((p) => p.status === 'descartada' && p.dataPublicacao.toISOString().slice(0, 10) === todayISO).length;
  const naoTratadasHoje = filteredPublications.filter((p) => p.status === 'pendente' && p.dataPublicacao.toISOString().slice(0, 10) === todayISO).length;



  const handleSearchProcesses = async () => {
    if (!oabNumber.trim() || !oabState.trim()) {
      alert("Por favor, preencha o número da OAB e o estado");
      return;
    }

    setIsSearching(true);
    setHasSearched(false);

    try {
      const payload = {
        search: {
          search_type: 'oab',
          search_key: `${oabNumber}${oabState}`.replace(/[^A-Za-z0-9]/g, ''),
          response_type: 'lawsuits',
          search_params: {}
        }
      };
      const data = await apiService.createJuditRequest(payload);
      const responses = Array.isArray(data?.responses) ? data.responses : [];
      const mapped = responses.map((it: any) => {
        const d = it?.response_data || it;
        const numero = d?.code || d?.lawsuit_cnj || d?.id || '';
        const cnj = d?.lawsuit_cnj || d?.code || '';
        const parties = Array.isArray(d?.parties) ? d.parties : (Array.isArray(d?.crawler?.parties?.data) ? d.crawler.parties.data : []);
        const cliente = parties?.[ 0 ]?.name || parties?.[ 0 ]?.document || '';
        const cover = d?.cover || d?.crawler?.cover?.data || {};
        const vara = cover?.court_name || cover?.court || d?.tribunal || '';
        const ultima = d?.last_step?.summary || '';
        const dataUltima = d?.last_step?.date || d?.updated_at || undefined;
        const classe = d?.classification?.value || '';
        const valor = d?.amount || '';
        return {
          id: String(d?.id || numero || Math.random()),
          numero,
          cliente,
          vara,
          status: d?.status || 'Em Andamento',
          ultimaMovimentacao: ultima,
          dataUltimaMovimentacao: dataUltima ? new Date(dataUltima) : undefined,
          advogado: `${oabNumber}/${oabState}`,
          tipo: classe,
          valor,
        };
      });
      setSearchResults(mapped);
      setHasSearched(true);
    } catch (error) {
      console.error("Erro ao consultar processos:", error);
      alert("Erro ao consultar processos. Tente novamente.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewProcessDetails = (process: any) => {
    setViewingProcess(process);
    setShowProcessDialog(true);
  };

  const handleOpenProcessExternal = (process: any) => {
    // Abrir processo em sistema externo (PJe, etc.)
    console.log("Abrindo processo em sistema externo:", process);
    alert(`Abrindo processo ${process.numero} no sistema do tribunal`);
  };

  const handleRegisterJuditTracking = async () => {
    if (!monitorKey.trim()) {
      alert('Informe a chave (CPF/CNPJ/OAB/Name/CNJ/ID) para monitorar');
      return;
    }
    setIsRegistering(true);
    try {
      const emails = monitorEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      const stepTerms = monitorStepTerms
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const normalizedKey = (monitorType === 'cpf' || monitorType === 'cnpj' || monitorType === 'lawsuit_cnj' || monitorType === 'lawsuit_id')
        ? monitorKey.replace(/\D+/g, '')
        : (monitorType === 'oab' ? monitorKey.replace(/[^A-Za-z0-9]/g, '') : monitorKey.trim());
      const payload = {
        recurrence: monitorRecurrence,
        search: { search_type: monitorType, search_key: normalizedKey },
        notification_emails: emails,
        notification_filters: { step_terms: stepTerms },
        with_attachments: monitorWithAttachments,
        fixed_time: monitorFixedTime,
        hour_range: monitorHourRange,
      };
      const res = await apiService.registerJuditTracking(payload);
      try {
        const t = (res as any) || {};
        if (t?.tracking_id || t?.id) {
          setJuditTrackings(prev => [ t, ...prev ]);
        }
      } catch { }
      await refreshJuditTrackings();
      alert('Monitoramento registrado com sucesso');
    } catch (error) {
      console.error('Erro ao registrar monitoramento:', error);
      alert('Erro ao registrar monitoramento. Tente novamente.');
    } finally {
      setIsRegistering(false);
    }
  };

  const refreshJuditTrackings = async () => {
    setIsLoadingTrackings(true);
    try {
      const data = await apiService.listJuditTrackings();
      const list = Array.isArray(data?.db) ? data.db : (Array.isArray(data?.external?.page_data) ? data.external.page_data : (Array.isArray(data?.external?.trackings) ? data.external.trackings : []));
      setJuditTrackings(list);
    } catch {
    } finally {
      setIsLoadingTrackings(false);
    }
  };
  const handleForceSyncTrackings = async () => {
    setIsSyncingTrackings(true);
    try {
      const data = await apiService.listJuditTrackings({ forceSync: 'true' });
      const list = Array.isArray(data?.db) ? data.db : (Array.isArray(data?.external?.page_data) ? data.external.page_data : (Array.isArray(data?.external?.trackings) ? data.external.trackings : []));
      setJuditTrackings(list);
      alert('Monitoramentos sincronizados com a Judit');
    } catch {
      alert('Erro ao sincronizar monitoramentos com a Judit');
    } finally {
      setIsSyncingTrackings(false);
    }
  };

  const handlePauseTracking = async (id: string) => {
    try { await apiService.pauseJuditTracking(id); await refreshJuditTrackings(); } catch { alert('Erro ao pausar'); }
  };
  const handleResumeTracking = async (id: string) => {
    try { await apiService.resumeJuditTracking(id); await refreshJuditTrackings(); } catch { alert('Erro ao reativar'); }
  };
  const handleDeleteTracking = async (id: string) => {
    if (!confirm('Deseja deletar este monitoramento?')) return;
    try { await apiService.deleteJuditTracking(id); await refreshJuditTrackings(); } catch { alert('Erro ao deletar'); }
  };
  const handleViewTrackingHistory = async (id: string) => {
    setHistoryTrackingId(id);
    setShowHistoryDialog(true);
    try {
      const resp = await apiService.getJuditTrackingHistory(id, { page: 1, page_size: 20 });
      setHistoryData(resp);
    } catch { setHistoryData({ page_data: [] }); }
  };
  const handleForceSyncHistory = async () => {
    if (!historyTrackingId) return;
    setIsSyncingHistory(true);
    try {
      const resp = await apiService.getJuditTrackingHistory(historyTrackingId, { page: 1, page_size: 20, forceSync: 'true' });
      setHistoryData(resp);
    } catch {
      alert('Erro ao atualizar histórico da Judit');
    } finally {
      setIsSyncingHistory(false);
    }
  };

  const handleArchiveProcess = (project: any) => {
    if (
      confirm(
        `Deseja arquivar o projeto ${project.numero}?\n\nO projeto será movido para a seção de projetos arquivados.`,
      )
    ) {
      // Aqui você implementaria a lógica para arquivar o projeto
      // BACKEND: POST /api/projetos/{id}/arquivar
      console.log("Arquivando projeto:", project);

      // Adicionar à lista de arquivados
      const archivedProject = {
        ...project,
        dataArquivamento: new Date(),
        status: "Arquivado",
      };
      setArchivedProjects((prev) => [ archivedProject, ...prev ]);

      // Remover da lista ativa
      setSearchResults((prev) => prev.filter((p) => p.id !== project.id));

      alert(
        `✅ Projeto ${project.numero} arquivado com sucesso!\n\nO projeto foi movido para a seção de arquivados.`,
      );
    }
  };

  const handleRestoreProject = (project: any) => {
    if (
      confirm(
        `Deseja restaurar o projeto ${project.numero}?\n\nO projeto será movido de volta para a seção ativa.`,
      )
    ) {
      // Restaurar projeto
      const restoredProject = {
        ...project,
        status: "Em Andamento",
      };
      delete restoredProject.dataArquivamento;

      setSearchResults((prev) => [ restoredProject, ...prev ]);
      setArchivedProjects((prev) => prev.filter((p) => p.id !== project.id));

      alert(`✅ Projeto ${project.numero} restaurado com sucesso!`);
    }
  };

  const getProcessStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Em Andamento": "bg-blue-100 text-blue-800 border-blue-200",
      "Aguardando Documentos":
        "bg-yellow-100 text-yellow-800 border-yellow-200",
      Finalizado: "bg-green-100 text-green-800 border-green-200",
      Arquivado: "bg-gray-100 text-gray-800 border-gray-200",
      Suspenso: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[ status ] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  // Carregar projetos arquivados na inicialização
  React.useEffect(() => {
    setArchivedProjects([]);
  }, []);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Newspaper className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Painel de Publicações</h1>
          </div>
          <div className="flex items-center">
            <a href="/publicacoes" rel="noopener noreferrer">
              <Badge variant="outline" className="font-mono text-xs">
                {juditQuota ? `Judit ${juditQuota.used}/${juditQuota.max}` : 'Judit carregando...'}
              </Badge>
            </a>
          </div>
        </div>

        <Tabs defaultValue="consultar" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="publicacoes"
              className="flex items-center space-x-2"
            >
              <Newspaper className="h-4 w-4" />
              <span>Publicações</span>
            </TabsTrigger>

            <TabsTrigger
              value="consultar"
              className="flex items-center space-x-2"
            >
              <FileSearch className="h-4 w-4" />
              <span>Monitorar processos</span>
            </TabsTrigger>

            {/* <TabsTrigger
              value="arquivados"
              className="flex items-center space-x-2"
            >
              <Building2 className="h-4 w-4" />
              <span>Arquivados</span>
            </TabsTrigger> */}
            <TabsTrigger
              value="consultas-judit"
              className="flex items-center space-x-2"
            >
              <FileSearch className="h-4 w-4" />
              <span>Minhas Consultas</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA PUBLICAÇÕES */}
          <TabsContent value="publicacoes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2 mb-4">
                    <Newspaper className="h-5 w-5" />
                    <span>Lista de Publicações</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {/* <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filtros
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleLoadPublications}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Carregando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Carregar
                        </>
                      )}
                    </Button> */}
                    {/* <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCreate5DayTask}
                      className="bg-green-50 hover:bg-green-100 border-green-200"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Prazo 5 Dias
                    </Button> */}
                  </div>
                </div>
                {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="text-2xl font-bold">{recebidasHoje}</div>
                    <div className="text-xs uppercase text-muted-foreground">Recebidas hoje</div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="text-2xl font-bold">{tratadasHoje}</div>
                    <div className="text-xs uppercase text-muted-foreground">Tratadas hoje</div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="text-2xl font-bold">{descartadasHoje}</div>
                    <div className="text-xs uppercase text-muted-foreground">Descartadas hoje</div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="text-2xl font-bold">{naoTratadasHoje}</div>
                    <div className="text-xs uppercase text-muted-foreground">Não tratadas</div>
                  </div>
                </div> */}
                <div className="flex items-center space-x-2 mt-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Digite o processo ou termo pesquisado"
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="nova">Nova</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="atribuida">Atribuída</SelectItem>
                      <SelectItem value="finalizada">Finalizada</SelectItem>
                      <SelectItem value="descartada">Descartada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={extraFilterType} onValueChange={setExtraFilterType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filtro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem filtro</SelectItem>
                      <SelectItem value="conta">Por conta</SelectItem>
                      <SelectItem value="nome">Por nome</SelectItem>
                      <SelectItem value="cpf">Por CPF</SelectItem>
                      <SelectItem value="processo">Por nº processo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Valor do filtro"
                    className="w-56"
                    value={extraFilterValue}
                    onChange={(e) => setExtraFilterValue(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {statusFilter !== 'all' && (
                    <Badge variant="outline" className="text-xs">
                      Status: {statusFilter}
                    </Badge>
                  )}
                  {extraFilterType !== 'none' && !!extraFilterValue.trim() && (
                    <Badge variant="outline" className="text-xs">
                      {extraFilterType}: {extraFilterValue}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Publicação</TableHead>
                        <TableHead>Processo</TableHead>
                        <TableHead>Diário</TableHead>
                        <TableHead>Vara/Comarca</TableHead>
                        <TableHead>Nome Pesquisado</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Urgência</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPublications.map((publication) => {
                        const statusConfig = getStatusBadge(publication.status);
                        return (
                          <TableRow
                            key={publication.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleViewPublication(publication)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {publication.dataPublicacao.toLocaleDateString(
                                    "pt-BR",
                                    { timeZone: "UTC" }
                                  )}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {publication.processo}
                            </TableCell>
                            <TableCell>{publication.diario}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {publication.varaComarca}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {publication.nomePesquisado}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${statusConfig.color} px-2 py-1 text-xs font-medium`}
                              >
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(publication.tags) && publication.tags.map((t) => (
                                  <Badge key={t} className={t === 'Atenção' ? 'bg-red-600 text-white' : (t === 'Concluído' ? 'bg-green-600 text-white' : (t === 'Cancelado' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'))}>{t}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs font-medium ${getUrgencyColor(publication.urgencia)}`}
                              >
                                {publication.urgencia?.toUpperCase()}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewPublication(publication);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          {/* ABA CONSULTAR CLIENTE/PROJETOS */}
          <TabsContent value="consultar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileSearch className="h-5 w-5" />
                  <span>Monitorar processos</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Digite o número do CNJ do processo para monitorar suas ações.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Formulário de Consulta */}
                <div className="space-y-4">

                  {/* Informações sobre a consulta */}
                  {/* <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start space-x-3">
                      <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">
                          Como funciona a consulta:
                        </p>
                        <ul className="space-y-1 text-xs">
                          <li>
                            • Digite o número da OAB e o estado do advogado
                          </li>
                          <li>
                            • O sistema buscará todos os projetos onde este
                            advogado está atuando
                          </li>
                          <li>
                            • Serão exibidos apenas projetos com status ativo
                          </li>
                          <li>
                            • Clique em qualquer projeto para ver os detalhes
                            completos
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div> */}
                  {/* Registro de Monitoramento JUDIT */}
                  <div className="space-y-4">
                    <div className="text-sm font-medium">Registrar monitoramento </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tipo</label>
                        <Select value={monitorType} onValueChange={(v) => setMonitorType(v as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cpf">CPF</SelectItem>
                            <SelectItem value="cnpj">CNPJ</SelectItem>
                            <SelectItem value="oab">OAB</SelectItem>
                            <SelectItem value="name">Nome</SelectItem>
                            <SelectItem value="lawsuit_cnj">Número do Processo</SelectItem>
                            {/* <SelectItem value="lawsuit_id">ID Processo</SelectItem> */}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{monitorType === 'lawsuit_cnj' ? 'Nº do processo' : 'Valor'}</label>
                        <Input
                          placeholder={
                            monitorType === 'cpf' ? '999.999.999-99'
                              : monitorType === 'cnpj' ? '99.999.999/0001-99'
                                : monitorType === 'oab' ? '123456SP'
                                  : monitorType === 'name' ? 'Nome Completo'
                                    : monitorType === 'lawsuit_id' ? 'ID do processo'
                                      : '0000000-00.0000.0.00.0000'
                          }
                          value={monitorKey}
                          onChange={(e) => {
                            const v = e.target.value;
                            const isNumericType = monitorType === 'cpf' || monitorType === 'cnpj' || monitorType === 'lawsuit_cnj' || monitorType === 'lawsuit_id';
                            setMonitorKey(
                              isNumericType ? v.replace(/\D+/g, '') :
                                monitorType === 'oab' ? v.replace(/[^A-Za-z0-9]/g, '') :
                                  v
                            );
                          }}
                          className="font-mono"
                        />
                        {(monitorType === 'cpf' || monitorType === 'cnpj' || monitorType === 'lawsuit_cnj' || monitorType === 'lawsuit_id') && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Digite apenas números (sem pontos ou traços)
                          </div>
                        )}
                        {monitorType === 'oab' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Digite número+UF juntos, sem barras (ex.: 123456SP)
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Recorrência (vezes/dia)</label>
                        <Input type="number" min={1} value={monitorRecurrence} onChange={(e) => setMonitorRecurrence(parseInt(e.target.value || '1'))} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Emails de notificação (vírgula)</label>
                        <span className="text-sm ml-1">opcional*</span>
                        <Input placeholder="email1@dominio.com, email2@dominio.com" value={monitorEmails} onChange={(e) => setMonitorEmails(e.target.value)} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Filtrar por termos de andamento (vírgula)</label>
                        <span className="text-sm ml-1">opcional*</span>
                        <Input placeholder="petição, acordo" value={monitorStepTerms} onChange={(e) => setMonitorStepTerms(e.target.value)} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" checked={monitorWithAttachments} onChange={(e) => setMonitorWithAttachments(e.target.checked)} />
                        <span className="text-sm">Incluir anexos</span>
                      </div>
                      {/* <div className="flex items-center space-x-2">
                        <input type="checkbox" checked={monitorFixedTime} onChange={(e) => setMonitorFixedTime(e.target.checked)} />
                        <span className="text-sm">Hora fixa</span>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Janela de hora</label>
                        <Input type="number" min={0} max={23} value={monitorHourRange} onChange={(e) => setMonitorHourRange(parseInt(e.target.value || '21'))} />
                      </div> */}
                      <div className="flex items-end">
                        <Button onClick={handleRegisterJuditTracking} disabled={isRegistering || !monitorKey.trim()} className="w-full">
                          {isRegistering ? 'Registrando...' : 'Registrar Monitoramento'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <FileSearch className="h-5 w-5" />
                        <span>Meus Monitoramentos</span>
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const left = getRemainingForKey('trackingsSync');
                            if (left > 0) return;
                            localStorage.setItem('juditCooldownKey:trackingsSync', String(Date.now()));
                            handleForceSyncTrackings();
                          }}
                          disabled={isSyncingTrackings || getRemainingForKey('trackingsSync') > 0}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {isSyncingTrackings
                            ? 'Sincronizando...'
                            : (() => {
                              const left = getRemainingForKey('trackingsSync');
                              return left > 0 ? `Aguardar ${Math.ceil(left / 1000)}s` : 'Atualizar da API (1 request)';
                            })()}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                        <p>
                          <span className="font-medium">hour_range</span> é o horário em que a consulta será realizada no tribunal.
                        </p>
                        <div>
                          <p className="font-medium">Sobre o status do monitoramento:</p>
                          <ul className="space-y-1 text-xs mt-1">
                            <li>• <span className="font-medium">created</span>: Monitoramento criado, porém nunca executado.</li>
                            <li>• <span className="font-medium">updating</span>: Está com uma requisição em processamento.</li>
                            <li>• <span className="font-medium">updated</span>: Monitoramento atualizado com alguma resposta disponível. <span className="italic">updated_at</span> pode informar a data de última atualização e <span className="italic">request_id</span> o id da última request.</li>
                            <li>• <span className="font-medium">paused</span>: Monitoramento pausado, podendo ser reativado.</li>
                            <li>• <span className="font-medium">deleted</span>: Monitoramento cancelado e não pode mais ser reativado.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID do monitoramento</TableHead>
                            <TableHead>Nº do Processo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Recorrência</TableHead>
                            <TableHead>Horário (hour_range)</TableHead>
                            <TableHead>Última Atualização</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoadingTrackings ? (
                            <TableRow>
                              <TableCell colSpan={8}>Carregando...</TableCell>
                            </TableRow>
                          ) : (
                            (juditTrackings || []).map((t: any) => (
                              <TableRow key={t.tracking_id || t.id}>
                                <TableCell className="font-mono text-xs">{t.tracking_id || t.id}</TableCell>
                                <TableCell className="font-mono text-xs">{t.search?.search_key}</TableCell>
                                <TableCell><Badge className="px-2 py-1 text-xs">{t.status}</Badge></TableCell>
                                <TableCell>{t.recurrence ?? t.recurrence_count ?? 1}</TableCell>
                                <TableCell>{t.hour_range ?? t.hourRange ?? t.hour ?? '—'}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {t.last_webhook_received_at
                                    ? new Date(t.last_webhook_received_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                                    : 'Nunca'}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  {String(t.status)?.toLowerCase() === 'paused' ? (
                                    <Button size="sm" onClick={() => handleResumeTracking(t.tracking_id || t.id)}>Retomar</Button>
                                  ) : (
                                    <Button variant="outline" size="sm" onClick={() => handlePauseTracking(t.tracking_id || t.id)}>Pausar</Button>
                                  )}
                                  <Button variant="outline" size="sm" onClick={() => handleViewTrackingHistory(t.tracking_id || t.id)}>Histórico</Button>
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteTracking(t.tracking_id || t.id)}>Excluir</Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Resultados da Consulta */}
                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center space-y-2">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                      <p className="text-sm text-muted-foreground">
                        Consultando projetos...
                      </p>
                    </div>
                  </div>
                )}

                {searchResults.length > 0 && !isSearching && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        Projetos Encontrados ({searchResults.length})
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600"
                      >
                        Consulta realizada com sucesso
                      </Badge>
                    </div>

                    {/* Layout de Cards lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {searchResults.map((project) => (
                        <div
                          key={project.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-card"
                        >
                          {/* Header do Card */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground font-medium">
                              DATA DO PROJETO
                            </span>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                                onClick={() => handleArchiveProcess(project)}
                                title="Arquivar"
                              >
                                📁
                              </Button>
                            </div>
                          </div>

                          {/* Data */}
                          <div className="text-lg font-semibold mb-2">
                            {project.dataUltimaMovimentacao?.toLocaleDateString(
                              "pt-BR",
                            ) || "21/08/2025"}
                          </div>

                          {/* Cliente */}
                          <div className="mb-3">
                            <span className="text-xs text-muted-foreground font-medium">
                              CLIENTE
                            </span>
                            <div className="font-medium text-sm mt-1">
                              <span className="text-blue-600">
                                {project.cliente}
                              </span>
                            </div>
                            <div className="text-xs text-green-600 font-medium mt-1">
                              VISUALIZAR PROJETO
                            </div>
                          </div>

                          {/* Informações Adicionais */}
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <div className="text-xs text-muted-foreground">
                              <strong>Número:</strong> {project.numero}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <strong>Status:</strong>
                              <Badge
                                className={`ml-1 ${getProcessStatusColor(project.status)} text-xs`}
                              >
                                {project.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <strong>Vara:</strong> {project.vara}
                            </div>

                            {/* Botão Abrir Projeto */}
                            <div className="mt-3 pt-2">
                              <Button
                                size="sm"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() =>
                                  handleViewProcessDetails(project)
                                }
                              >
                                Abrir Projeto
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasSearched && searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="space-y-2">
                      <FileSearch className="h-12 w-12 mx-auto opacity-50" />
                      <p className="font-medium">Nenhum projeto encontrado</p>
                      <p className="text-sm">
                        Não foram encontrados projetos para a OAB {oabNumber}/
                        {oabState}
                      </p>
                      <p className="text-xs">
                        Verifique se o número da OAB está correto e tente
                        novamente
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA PROJETOS ARQUIVADOS */}
          <TabsContent value="arquivados" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <span>Projetos Arquivados</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Projetos que foram finalizados e arquivados
                </p>
              </CardHeader>
              <CardContent>
                {archivedProjects.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        Projetos Arquivados ({archivedProjects.length})
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-gray-600 border-gray-600"
                      >
                        📁 Arquivados
                      </Badge>
                    </div>

                    {/* Layout de Cards lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedProjects.map((project) => (
                        <div
                          key={project.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50 dark:bg-gray-800"
                        >
                          {/* Header do Card */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground font-medium">
                              DATA DO PROJETO
                            </span>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                onClick={() => handleRestoreProject(project)}
                                title="Restaurar Projeto"
                              >
                                ↩️
                              </Button>
                            </div>
                          </div>

                          {/* Data */}
                          <div className="text-lg font-semibold mb-2">
                            {project.dataUltimaMovimentacao?.toLocaleDateString(
                              "pt-BR",
                            ) || "21/08/2025"}
                          </div>

                          {/* Cliente */}
                          <div className="mb-3">
                            <span className="text-xs text-muted-foreground font-medium">
                              CLIENTE
                            </span>
                            <div className="font-medium text-sm mt-1">
                              <span className="text-blue-600">
                                {project.cliente}
                              </span>
                            </div>
                            <div className="text-xs text-green-600 font-medium mt-1">
                              VISUALIZAR PROJETO
                            </div>
                          </div>

                          {/* Status de Arquivado */}
                          <div className="mb-3">
                            <Badge className="bg-gray-100 text-gray-800 border-gray-200 text-xs">
                              📁 Arquivado
                            </Badge>
                          </div>

                          {/* Informações Adicionais */}
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <div className="text-xs text-muted-foreground">
                              <strong>Número:</strong> {project.numero}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <strong>Tipo:</strong> {project.tipo}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <strong>Valor:</strong> {project.valor}
                            </div>
                            {project.dataArquivamento && (
                              <div className="text-xs text-muted-foreground">
                                <strong>Arquivado em:</strong>{" "}
                                {project.dataArquivamento.toLocaleDateString(
                                  "pt-BR",
                                )}
                              </div>
                            )}

                            {/* Botão Abrir Projeto */}
                            <div className="mt-3 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() =>
                                  handleViewProcessDetails(project)
                                }
                              >
                                Visualizar Projeto
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="space-y-2">
                      <Building2 className="h-12 w-12 mx-auto opacity-50" />
                      <p className="font-medium">Nenhum projeto arquivado</p>
                      <p className="text-sm">
                        Os projetos arquivados aparecerão aqui
                      </p>
                      <p className="text-xs">
                        Arquive projetos finalizados para manter a organização
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consultas-judit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileSearch className="h-5 w-5" />
                  <span>Consultas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={createType} onValueChange={setCreateType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="oab">OAB</SelectItem>
                        <SelectItem value="lawsuit_cnj">Número do processo</SelectItem>
                        {/* <SelectItem value="lawsuit_id">ID Processo</SelectItem> */}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-sm font-medium">Valor</label>
                    <Input
                      placeholder="Valor da chave"
                      value={createKey}
                      onChange={(e) => {
                        const v = e.target.value;
                        const isNumericType = createType === 'cpf' || createType === 'cnpj' || createType === 'lawsuit_cnj' || createType === 'lawsuit_id';
                        setCreateKey(
                          isNumericType ? v.replace(/\D+/g, '') :
                            createType === 'oab' ? v.replace(/[^A-Za-z0-9]/g, '') :
                              v
                        );
                      }}
                    />
                    {createType === 'oab' && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Digite número+UF juntos, sem barras (ex.: 123456SP)
                      </div>
                    )}
                    {(createType === 'cpf' || createType === 'cnpj' || createType === 'lawsuit_cnj' || createType === 'lawsuit_id') && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Digite apenas números (sem pontos, traços ou barras)
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 md:col-span-1 md:items-end">
                    <input type="checkbox" checked={createOnDemand} onChange={(e) => setCreateOnDemand(e.target.checked)} />
                    <span className="text-sm">Consulta direta </span>
                  </div>
                  <div className="flex items-center space-x-2 md:col-span-1 md:items-end">
                    <input type="checkbox" checked={createIAEnabled} onChange={(e) => setCreateIAEnabled(e.target.checked)} />
                    <span className="text-sm">Resumo (IA)</span>
                  </div>
                  {/* <div className="space-y-2">
                    <label className="text-sm font-medium">Retorno</label>
                    <Select value={createResponseType} onValueChange={setCreateResponseType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Retorno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lawsuit">Processo</SelectItem>
                        <SelectItem value="lawsuits">Processos</SelectItem>
                        <SelectItem value="parties">Partes</SelectItem>
                        <SelectItem value="attachments">Anexos</SelectItem>
                        <SelectItem value="step">Andamentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div> */}
                  <div className="md:col-span-1 flex items-end">
                    <Button onClick={handleCreateJuditRequest} disabled={isCreating || !createKey.trim()} className="w-full">
                      {isCreating ? "Criando..." : "Criar Consulta"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Criada em</TableHead>
                        {/* <TableHead>Request ID</TableHead> */}
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nº do processo</TableHead>
                        <TableHead>Resumo (IA)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingRequests ? (
                        <TableRow>
                          <TableCell colSpan={7}>Carregando...</TableCell>
                        </TableRow>
                      ) : (
                        juditRequests.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                            {/* <TableCell className="font-mono text-xs">{r.request_id}</TableCell> */}
                            <TableCell>{r.search?.search_type}</TableCell>
                            <TableCell className="font-mono text-xs">{r.search?.search_key}</TableCell>
                            <TableCell className="text-sm">
                              {(() => {
                                const res = r?.result || {};
                                const pd = Array.isArray(res?.page_data) ? res.page_data : [];
                                const sumItem = pd.find((x: any) => String(x?.response_type) === "summary");
                                const raw =
                                  Array.isArray(sumItem?.response_data?.data)
                                    ? (sumItem?.response_data?.data as any[]).join("\n")
                                    : (sumItem?.response_data?.data || "");
                                const text = htmlToText(typeof raw === "string" ? raw : "");
                                return text ? (text.length > 120 ? `${text.slice(0, 120)}…` : text) : "—";
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge className="px-2 py-1 text-xs">{r.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/consultas-judit/${r.id}`)}
                              >
                                Ver detalhes
                              </Button>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const left = getRemainingForReq(r.id);
                                    if (left > 0) return;
                                    localStorage.setItem(`juditCooldownReq:${r.id}`, String(Date.now()));
                                    await apiService.refreshJuditRequest(r.id);
                                    await refreshJuditRequests();
                                  } catch (e) {
                                    alert('Não foi possível atualizar a consulta');
                                  }
                                }}
                                disabled={getRemainingForReq(r.id) > 0}
                              >
                                {(() => {
                                  const left = getRemainingForReq(r.id);
                                  return left > 0 ? `Aguardar ${Math.ceil(left / 1000)}s` : 'Atualizar';
                                })()}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal de Visualização de Processo */}
        <ProcessViewDialog
          process={viewingProcess}
          open={showProcessDialog}
          onOpenChange={setShowProcessDialog}
        />

        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Histórico do Monitoramento {historyTrackingId}</DialogTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const key = `historySync:${historyTrackingId || ''}`;
                    const left = getRemainingForKey(key);
                    if (left > 0) return;
                    localStorage.setItem(`juditCooldownKey:${key}`, String(Date.now()));
                    handleForceSyncHistory();
                  }}
                  disabled={isSyncingHistory || getRemainingForKey(`historySync:${historyTrackingId || ''}`) > 0}
                  className="mt-3"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isSyncingHistory
                    ? 'Sincronizando...'
                    : (() => {
                      const left = getRemainingForKey(`historySync:${historyTrackingId || ''}`);
                      return left > 0 ? `Aguardar ${Math.ceil(left / 1000)}s` : 'Atualizar da Judit';
                    })()}
                </Button>
              </div>
            </DialogHeader>
            <ScrollArea className="h-[480px]">
              <div className="space-y-4">
                {Array.isArray(historyData?.page_data) && historyData.page_data.length > 0 ? (
                  historyData.page_data.map((item: any) => (
                    <div key={item.response_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-xs">{item.response_id}</div>
                        <Badge variant="outline" className="text-xs">{item.response_type}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{item.response_data?.last_step?.content || item.response_data?.summary || '—'}</div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div><span className="text-muted-foreground">CNJ:</span> {item.response_data?.code || item.response_data?.last_step?.lawsuit_cnj || '—'}</div>
                        <div><span className="text-muted-foreground">Comarca:</span> {item.response_data?.city || item.response_data?.county || '—'}</div>
                        <div><span className="text-muted-foreground">Atualizado:</span> {item.response_data?.updated_at ? new Date(item.response_data.updated_at).toLocaleString('pt-BR') : '—'}</div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/processos-judit/${item.response_id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhum histórico encontrado</div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>


      </div>
    </DashboardLayout>
  );
}
