import React, { useState, useMemo, useEffect } from "react";
import {
  createSafeOnOpenChange,
  createSafeDialogHandler,
} from "@/lib/dialog-fix";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Users,
  Plus,
  Search,
  Filter,
  Target,
  BarChart3,
  TrendingUp,
  Grid3X3,
  List,
  Edit2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientForm } from "@/components/CRM/ClientForm";
import { ClientsTable } from "@/components/CRM/ClientsTable";
import { Pipeline } from "@/components/CRM/Pipeline";
import { AdvancedFilters } from "@/components/CRM/AdvancedFilters";
import { DealForm } from "@/components/CRM/DealForm";
import { ClientViewDialog } from "@/components/CRM/ClientViewDialog";
import { DealViewDialog } from "@/components/CRM/DealViewDialog";
import { Client, Deal, PipelineStage, DealStage } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { apiService } from "@/services/apiService";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";

// Helper function to map Deal (backend) to Deal (frontend)
const mapApiDealToDeal = (deal: any): Deal => ({
  id: deal.id,
  title: deal.title,
  contactName: deal.contact_name || deal.contactName || "",
  organization: deal.organization || "",
  email: deal.email || "",
  mobile: deal.phone || deal.mobile || "",
  address: deal.address || "",
  budget: Number(deal.budget || 0),
  currency: deal.currency || "BRL",
  stage: (deal.stage as DealStage) || "contacted",
  tags: Array.isArray(deal.tags) ? deal.tags : [],
  description: deal.description || "",
  createdAt: deal.created_at || deal.createdAt || new Date().toISOString(),
  updatedAt: deal.updated_at || deal.updatedAt || new Date().toISOString(),
});

// Helper function to map Deal (frontend) to Deal data (backend)
const mapDealToProjectData = (deal: Partial<Deal>) => ({
  title: deal.title,
  contactName: deal.contactName,
  organization: deal.organization,
  email: deal.email,
  mobile: deal.mobile,
  address: deal.address,
  budget: deal.budget,
  currency: deal.currency,
  stage: deal.stage,
  tags: deal.tags,
  description: deal.description,
});

interface PipelineListViewProps {
  deals: Deal[];
  stages: PipelineStage[];
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (dealId: string) => void;
  onMoveDeal: (dealId: string, newStage: DealStage) => void;
  onViewDeal: (deal: Deal) => void;
}

function PipelineListView({
  deals,
  stages,
  onEditDeal,
  onDeleteDeal,
  onMoveDeal,
  onViewDeal,
}: PipelineListViewProps) {
  const getStageInfo = (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    return stage || { name: stageId, color: "gray" };
  };

  const getStageColor = (color: string) => {
    const colors = {
      blue: "bg-blue-100 text-blue-800",
      yellow: "bg-yellow-100 text-yellow-800",
      purple: "bg-purple-100 text-purple-800",
      orange: "bg-orange-100 text-orange-800",
      green: "bg-green-100 text-green-800",
      red: "bg-red-100 text-red-800",
      gray: "bg-gray-100 text-gray-800",
    };
    return colors[ color ] || colors.gray;
  };
  const getStageAccentTriangle = (color: string) => {
    const map = {
      blue: "border-t-blue-500",
      yellow: "border-t-yellow-500",
      purple: "border-t-purple-500",
      orange: "border-t-orange-500",
      green: "border-t-green-500",
      red: "border-t-red-500",
      gray: "border-t-gray-400",
    };
    return map[ color ] || map.gray;
  };
  const getStageAccentBar = (color: string) => {
    const map = {
      blue: "bg-blue-500",
      yellow: "bg-yellow-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      green: "bg-green-500",
      red: "bg-red-500",
      gray: "bg-gray-400",
    };
    return map[ color ] || map.gray;
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat(
      currency === "USD" ? "en-US" : currency === "EUR" ? "de-DE" : "pt-BR",
      { style: "currency", currency: currency || "BRL" }
    ).format(value);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {deals.map((deal) => {
        const stageInfo = getStageInfo(deal.stage);
        const showBudget = deal.stage === "proposal" || deal.stage === "won";
        return (
          <Card
            key={deal.id}
            className="relative overflow-hidden hover:shadow-md transition-all cursor-pointer rounded-xl border flex flex-col h-full"
            onClick={() => onViewDeal(deal)}
          >
            <span className={`absolute top-0 right-0 w-0 h-0 border-t-[24px] border-l-[24px] border-l-transparent ${getStageAccentTriangle(stageInfo.color)}`} />
            <span className={`absolute bottom-0 left-0 right-0 h-[4px] ${getStageAccentBar(stageInfo.color)}`} />
            <CardContent className="p-4 space-y-3 flex flex-col flex-1">
              <div className="flex items-center justify-between">
                <Badge className={getStageColor(stageInfo.color)}>
                  {stageInfo.name}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  Criado em {new Date(deal.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold">{deal.title}</h3>
                {deal.organization && (
                  <div className="text-xs text-muted-foreground">{deal.organization}</div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className="truncate">{deal.email}</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className="truncate">{deal.mobile}</span>
                </div>
              </div>

              {showBudget && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-[10px] font-medium text-muted-foreground">ORÇAMENTO</div>
                  <div className="text-lg font-bold text-blue-700">
                    {formatCurrency(deal.budget, deal.currency)}
                  </div>
                </div>
              )}

              {deal.description && (
                <p className="text-xs text-muted-foreground">{deal.description}</p>
              )}

              <div className="mt-auto pt-2 border-t flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-[160px] flex-1 sm:flex-none" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={deal.stage}
                    onValueChange={(v) => onMoveDeal(deal.id, v as DealStage)}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contacted">Em Contato</SelectItem>
                      <SelectItem value="proposal">Com Proposta</SelectItem>
                      <SelectItem value="won">Cliente Bem Sucedido</SelectItem>
                      <SelectItem value="lost">Cliente Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
                  <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEditDeal(deal); }}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button className="w-full sm:w-auto" variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); onDeleteDeal(deal.id); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {deals.length === 0 && (
        <div className="text-center py-8 text-muted-foreground col-span-full">
          Nenhum deal encontrado no pipeline.
        </div>
      )}
    </div>
  );
}

interface PipelineVisualizationViewProps {
  deals: Deal[];
  stages: PipelineStage[];
  onViewDeal: (deal: Deal) => void;
}

function PipelineVisualizationView({
  deals,
  stages,
  onViewDeal,
}: PipelineVisualizationViewProps) {
  const groups = stages.map((stage) => ({
    stage,
    items: deals
      .filter((d) => d.stage === stage.id)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    total: deals
      .filter((d) => d.stage === stage.id)
      .reduce((sum, d) => sum + (d.budget || 0), 0),
  }));

  const getStageColor = (color: string) => {
    const colors = {
      blue: "bg-blue-100 text-blue-800",
      yellow: "bg-yellow-100 text-yellow-800",
      purple: "bg-purple-100 text-purple-800",
      orange: "bg-orange-100 text-orange-800",
      green: "bg-green-100 text-green-800",
      red: "bg-red-100 text-red-800",
      gray: "bg-gray-100 text-gray-800",
    };
    return colors[ color ] || colors.gray;
  };

  const getStageContainerStyle = (color: string) => {
    const styles = {
      blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
      yellow: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
      purple: "bg-purple-50 border-purple-200 hover:bg-purple-100",
      orange: "bg-orange-50 border-orange-200 hover:bg-orange-100",
      green: "bg-green-50 border-green-200 hover:bg-green-100",
      red: "bg-red-50 border-red-200 hover:bg-red-100",
      gray: "bg-gray-50 border-gray-200 hover:bg-gray-100",
    };
    return styles[ color ] || styles.gray;
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {groups.map((group) => (
        <Card key={group.stage.id} className="border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge className={getStageColor(group.stage.color)}>
                  {group.stage.name}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {group.items.length} negócio(s)
                </span>
              </div>
              <div className="text-xs font-medium">
                {formatCurrency(group.total, "BRL")}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.items.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhum negócio</div>
            ) : (
              group.items.map((deal) => (
                <div
                  key={deal.id}
                  className={`p-3 border rounded cursor-pointer transition-colors ${getStageContainerStyle(group.stage.color)}`}
                  onClick={() => onViewDeal(deal)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback>
                          {deal.title.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {deal.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {deal.contactName}
                        </div>
                      </div>
                    </div>
                    {[ "proposal", "won" ].includes(deal.stage) && (
                      <div className="text-xs font-semibold">
                        {formatCurrency(deal.budget, deal.currency)}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex items-center space-x-2">
                    {deal.email && <span>{deal.email}</span>}
                    {deal.mobile && <span>{deal.mobile}</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CRM() {
  const [ activeTab, setActiveTab ] = useState("clients");
  const [ showClientForm, setShowClientForm ] = useState(false);
  const [ showAdvancedFilters, setShowAdvancedFilters ] = useState(false);
  const [ showDealForm, setShowDealForm ] = useState(false);
  const [ showClientView, setShowClientView ] = useState(false);
  const [ showDealView, setShowDealView ] = useState(false);
  const [ editingClient, setEditingClient ] = useState<Client | undefined>();
  const [ editingDeal, setEditingDeal ] = useState<Deal | undefined>();
  const [ viewingClient, setViewingClient ] = useState<Client | null>(null);
  const [ viewingDeal, setViewingDeal ] = useState<Deal | null>(null);
  const [ dealInitialStage, setDealInitialStage ] = useState<
    DealStage | undefined
  >();
  const {
    clients,
    createClient,
    updateClient,
    deleteClient,
    isLoading: clientsLoading,
  } = useClients();
  const { user } = useAuth();
  // Removido: useProjects (não utilizado)
  // const { projects, createProject, updateProject, deleteProject, isLoading: projectsLoading } = useProjects();

  const [ deals, setDeals ] = useState<Deal[]>([]);
  const [ isLoadingDeals, setIsLoadingDeals ] = useState<boolean>(false);
  const [ errorDeals, setErrorDeals ] = useState<string | null>(null);
  const [ dealStageFilter, setDealStageFilter ] = useState<DealStage | "all">("all");
  const [ dealTagsFilter, setDealTagsFilter ] = useState<string[]>([]);
  const availableDealTags = useMemo(
    () => Array.from(new Set(deals.flatMap((d) => d.tags || []))).sort(),
    [ deals ]
  );

  // Helper function to load deals from the API with optional filters
  const loadDeals = async (filters?: { stage?: string; tags?: string[] }) => {
    try {
      setIsLoadingDeals(true);
      setErrorDeals(null);

      const params: any = {};
      if (filters?.stage && filters.stage !== "all") {
        params.stage = filters.stage;
      }
      if (filters?.tags && filters.tags.length > 0) {
        params.tags = filters.tags.join(",");
      }

      const response = await apiService.getDeals(params);
      // Backend retorna { deals: [...], pagination: {...} } ou array simples
      if (response?.deals) {
        setDeals(response.deals.map(mapApiDealToDeal));
      } else if (Array.isArray(response)) {
        setDeals(response.map(mapApiDealToDeal));
      } else {
        setDeals([]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar negócios:", error);
      setErrorDeals(error?.message || "Não foi possível carregar os negócios do pipeline.");
      setDeals([]);
    } finally {
      setIsLoadingDeals(false);
    }
  };

  // Carregar deals corretamente com useEffect (efeitos colaterais)
  useEffect(() => {
    loadDeals();
  }, []);

  // Recarregar deals quando filtros de estágio/tags mudarem
  useEffect(() => {
    loadDeals({
      stage: dealStageFilter,
      tags: dealTagsFilter,
    });
  }, [ dealStageFilter, dealTagsFilter ]);

  // Map projects to deals for frontend display
  // const deals = useMemo(() => {
  //   return projects.map(mapProjectToDeal);
  // }, [projects]);
  const [ selectedClients, setSelectedClients ] = useState<string[]>([]);
  const [ searchTerm, setSearchTerm ] = useState("");
  const [ dealSearchTerm, setDealSearchTerm ] = useState("");
  const [ statusFilter, setStatusFilter ] = useState<string>("all");
  const [ advancedFilters, setAdvancedFilters ] = useState<any>(null);
  const [ pipelineViewMode, setPipelineViewMode ] = useState<"kanban" | "list" | "visualizacao">(
    "list",
  );
  const [ editingStages, setEditingStages ] = useState(false);
  const [ tempStageNames, setTempStageNames ] = useState<{
    [ key: string ]: string;
  }>({});

  // Create safe dialog handler
  const safeSetEditingStages = createSafeOnOpenChange((open: boolean) =>
    setEditingStages(open),
  );

  // Filter clients based on search, status, and advanced filters
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.organization?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || client.status === statusFilter;

      // Apply advanced filters if they exist
      if (advancedFilters) {
        if (advancedFilters.locations.length > 0) {
          const clientLocation = `${client.city} - ${client.state}`;
          if (!advancedFilters.locations.includes(clientLocation)) {
            return false;
          }
        }
        if (advancedFilters.clientType) {
          if (advancedFilters.clientType === "juridico" && !client.organization) {
            return false;
          }
          if (advancedFilters.clientType === "fisico" && client.organization) {
            return false;
          }
        }

        console.log("🚀 ~ CRM ~ client:", client)

        const min = typeof advancedFilters.budgetMin === "string" ? parseFloat(advancedFilters.budgetMin) : advancedFilters.budgetMin;
        const max = typeof advancedFilters.budgetMax === "string" ? parseFloat(advancedFilters.budgetMax) : advancedFilters.budgetMax;
        if (!isNaN(min) || !isNaN(max)) {
          const clientBudget = Number(client.budget);

          if (isNaN(clientBudget)) {
            return false;
          }
          if (!isNaN(min) && clientBudget < min) {
            return false;
          }
          if (!isNaN(max) && clientBudget > max) {
            return false;
          }
        }
        if (advancedFilters.tags.length > 0) {
          const hasMatchingTag = advancedFilters.tags.some((tag: string) =>
            client.tags.some((clientTag) =>
              clientTag.toLowerCase().includes(tag.toLowerCase()),
            ),
          );
          if (!hasMatchingTag) {
            return false;
          }
        }
      }

      return matchesSearch && matchesStatus;
    });
  }, [ clients, searchTerm, statusFilter, advancedFilters ]);

  // Filter deals based on search term (servidor filtra por estágio/tags; aqui só busca textual)
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        deal.title.toLowerCase().includes(dealSearchTerm.toLowerCase()) ||
        deal.contactName.toLowerCase().includes(dealSearchTerm.toLowerCase()) ||
        deal.organization?.toLowerCase().includes(dealSearchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [ deals, dealSearchTerm ]);

  // Initial pipeline stages configuration
  // Persistência de nomes dos stages por tenant
  const STAGE_PREF_KEY = useMemo(
    () => (user?.tenantId ? `pipelineStages_${user.tenantId}` : `pipelineStages_default`),
    [ user?.tenantId ]
  );

  const loadStagePreferences = () => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STAGE_PREF_KEY) : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as { id: DealStage; name: string; color: string }[];
      }
      return null;
    } catch {
      return null;
    }
  };

  const saveStagePreferences = (stages: { id: DealStage; name: string; color: string }[]) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STAGE_PREF_KEY, JSON.stringify(stages));
      }
    } catch {
      // ignore
    }
  };

  // PIPELINE SIMPLIFICADO: Apenas 4 estágios conforme solicitado
  const [ pipelineStagesConfig, setPipelineStagesConfig ] = useState<
    { id: DealStage; name: string; color: string }[]
  >([
    { id: "contacted", name: "Em Contato", color: "blue" },
    { id: "proposal", name: "Com Proposta", color: "yellow" },
    { id: "won", name: "Cliente Bem Sucedido", color: "green" },
    { id: "lost", name: "Cliente Perdido", color: "red" },
  ]);

  // Carregar preferências salvas de stages quando o usuário/tenant estiver disponível
  useEffect(() => {
    const saved = loadStagePreferences();
    if (saved) {
      setPipelineStagesConfig(saved);
    }
  }, [ STAGE_PREF_KEY ]);

  // REMOVIDOS: opportunity, advanced, general conforme solicitação
  // IMPLEMENTAÇÃO FUTURA: Editar nomes dos stages também deve atualizar nos deals

  // Pipeline stages com deals filtrados
  const pipelineStages = pipelineStagesConfig.map((stage) => ({
    ...stage,
    deals: filteredDeals.filter((deal) => deal.stage === stage.id),
  }));

  const handleSubmitClient = async (data: any) => {
    try {
      const { attachments, removeAttachments, ...payload } = data || {};
      let clientId: string | undefined;
      if (editingClient) {
        const res = await updateClient(editingClient.id, payload);
        clientId = res?.client?.id || editingClient.id;
        setEditingClient(undefined);
      } else {
        const res = await createClient(payload);
        clientId = res?.client?.id;
      }
      if (clientId && Array.isArray(removeAttachments) && removeAttachments.length > 0) {
        await apiService.deleteClientAttachments(clientId, removeAttachments);
      }
      if (clientId && Array.isArray(attachments) && attachments.length > 0) {
        const form = new FormData();
        attachments.forEach((f: File) => form.append('attachments', f));
        await apiService.uploadClientAttachments(clientId, form);
      }
      await loadDeals();
      setShowClientForm(false);
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      // Mostrar toast de erro aqui se necessário
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [ ...prev, clientId ],
    );
  };

  const handleSelectAllClients = (checked: boolean) => {
    setSelectedClients(
      checked ? filteredClients.map((client) => client.id) : [],
    );
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setShowClientForm(true);
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteClient(clientId);
      await loadDeals();
      setSelectedClients(selectedClients.filter((id) => id !== clientId));
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
    }
  };

  const handleViewClient = (client: Client) => {
    setViewingClient(client);
    setShowClientView(true);
  };

  const handleEditFromView = (client: Client) => {
    setEditingClient(client);
    setShowClientView(false);
    setShowClientForm(true);
  };

  const handleAddDeal = (stage: DealStage) => {
    setDealInitialStage(stage);
    setEditingDeal(undefined);
    setShowDealForm(true);
  };

  const handleEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setDealInitialStage(undefined);
    setShowDealForm(true);
  };

  const handleViewDeal = (deal: Deal) => {
    const match =
      clients.find(
        (c) =>
          (c.email &&
            deal.email &&
            c.email.trim().toLowerCase() ===
            deal.email.trim().toLowerCase()) ||
          (c.name &&
            deal.contactName &&
            c.name.trim().toLowerCase() ===
            deal.contactName.trim().toLowerCase()),
      ) || null;
    if (match) {
      setViewingClient(match);
      setShowClientView(true);
    } else {
      setViewingDeal(deal);
      setShowDealView(true);
    }
  };

  const handleEditFromDealView = (deal: Deal) => {
    setEditingDeal(deal);
    setShowDealView(false);
    setShowDealForm(true);
  };

  const handleDeleteDeal = async (dealId: string) => {
    try {
      await apiService.deleteDeal(dealId);
      setDeals((prevDeals) => prevDeals.filter((deal) => deal.id !== dealId)); // Atualiza estado local
    } catch (error) {
      console.error("Erro ao excluir negócio:", error);
      toast({
        title: "Erro ao excluir negócio",
        description: "Não foi possível excluir o negócio.",
        variant: "destructive",
      });
    }
  };

  // Handle moving a deal to a different stage (drag and drop)
  const handleMoveDeal = async (dealId: string, newStage: DealStage) => {
    try {
      console.log("Moving deal:", dealId, "to stage:", newStage);

      setDeals((prevDeals) =>
        prevDeals.map((deal) =>
          deal.id === dealId ? { ...deal, stage: newStage } : deal,
        ),
      );

      // Rota dedicada para mover estágio (PATCH)
      await apiService.patch(`/deals/${dealId}/stage`, { stage: newStage });

      toast({
        title: "Negócio movido com sucesso",
        description: `Negócio movido para "${newStage === "contacted" ? "Em Contato" : newStage === "proposal" ? "Com Proposta" : newStage === "won" ? "Cliente Bem Sucedido" : "Cliente Perdido"}"`,
      });
    } catch (error) {
      console.error("Erro ao mover negócio:", error);
      await loadDeals({ stage: dealStageFilter, tags: dealTagsFilter });
      toast({
        title: "Erro ao mover negócio",
        description:
          "Não foi possível atualizar o estágio do negócio. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleApplyAdvancedFilters = (filters: any) => {
    setAdvancedFilters(filters);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters(null);
  };

  const handleSubmitDeal = async (data: any) => {
    try {
      if (editingDeal) {
        await apiService.updateDeal(editingDeal.id, data);
        setEditingDeal(undefined);
      } else {
        await apiService.createDeal(data);
      }

      setShowDealForm(false);
      setDealInitialStage(undefined);
      await loadDeals(); // Recarrega deals após a submissão
    } catch (error) {
      console.error("Erro ao salvar negócio:", error);
      toast({
        title: "Erro ao salvar negócio",
        description: "Não foi possível salvar o negócio. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Calculate metrics
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.status === "active").length;
  const totalRevenuePotential = deals.reduce(
    (sum, deal) => sum + deal.budget,
    0,
  );
  const wonDeals = deals.filter((d) => d.stage === "won").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>CRM</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
            <p className="text-muted-foreground">
              Gerenciamento de clientes e relacionamentos
            </p>
          </div>
          <Button onClick={() => {
            setEditingClient(null)
            setShowClientForm(true)
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Cliente
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Clientes
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClients}</div>
              <p className="text-xs text-muted-foreground">
                {activeClients} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pipeline Total
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalRevenuePotential)}
              </div>
              <p className="text-xs text-muted-foreground">
                {deals.length} negócios ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Taxa de Conversão
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deals.length > 0
                  ? Math.round((wonDeals / deals.length) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {wonDeals} negócios fechados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Receita Fechada
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(
                  deals
                    .filter((d) => d.stage === "won")
                    .reduce((sum, deal) => sum + deal.budget, 0),
                )}
              </div>
              <p className="text-xs text-muted-foreground">Este mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline de Vendas</TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center space-x-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Procurar clientes..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  {/* <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem> */}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(true)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Mais Filtros
                {advancedFilters && (
                  <Badge variant="secondary" className="ml-2">
                    Ativos
                  </Badge>
                )}
              </Button>
              {advancedFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAdvancedFilters}
                >
                  Limpar Filtros
                </Button>
              )}
            </div>

            {/* Clients Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Lista de Clientes ({filteredClients.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClientsTable
                  clients={filteredClients}
                  selectedClients={selectedClients}
                  onSelectClient={handleSelectClient}
                  onSelectAll={handleSelectAllClients}
                  onEditClient={handleEditClient}
                  onDeleteClient={handleDeleteClient}
                  onViewClient={handleViewClient}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Pipeline de Vendas
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {/* Visualização única da pipeline */}

                    {/* Edit Stages Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingStages(true);
                        const initialNames: Record<string, string> = {};
                        pipelineStagesConfig.forEach((stage) => {
                          initialNames[ stage.id ] = stage.name;
                        });
                        setTempStageNames(initialNames);
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Editar Nomes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filtros avançados por estágio e tags */}
                <div className="grid gap-3 grid-cols-1 md:grid-cols-3 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Procurar por título/contato/organização..."
                      className="pl-10"
                      value={dealSearchTerm}
                      onChange={(e) => setDealSearchTerm(e.target.value)}
                    />
                  </div>

                  <Select
                    value={dealStageFilter}
                    onValueChange={(v) => setDealStageFilter(v as DealStage | "all")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Estágio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os estágios</SelectItem>
                      <SelectItem value="contacted">Em Contato</SelectItem>
                      <SelectItem value="proposal">Com Proposta</SelectItem>
                      <SelectItem value="won">Cliente Bem Sucedido</SelectItem>
                      <SelectItem value="lost">Cliente Perdido</SelectItem>
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Filter className="h-4 w-4 mr-2" />
                        Filtrar por Tags
                        {dealTagsFilter.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {dealTagsFilter.length} selecionada(s)
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      {availableDealTags.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">
                          Nenhuma tag disponível
                        </div>
                      ) : (
                        availableDealTags.map((tag) => (
                          <DropdownMenuItem
                            key={tag}
                            onClick={() => {
                              setDealTagsFilter((prev) =>
                                prev.includes(tag)
                                  ? prev.filter((t) => t !== tag)
                                  : [ ...prev, tag ]
                              );
                            }}
                          >
                            <span className="flex items-center justify-between w-full">
                              <span>{tag}</span>
                              {dealTagsFilter.includes(tag) && (
                                <Badge variant="secondary">Ativa</Badge>
                              )}
                            </span>
                          </DropdownMenuItem>
                        ))
                      )}
                      {dealTagsFilter.length > 0 && (
                        <DropdownMenuItem
                          onClick={() => setDealTagsFilter([])}
                          className="text-red-600"
                        >
                          Limpar seleção
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Loading / Error / Empty-State */}
                {errorDeals && (
                  <Card className="border-red-200 bg-red-50 mb-4">
                    <CardContent className="p-3 text-sm text-red-700">
                      {errorDeals}
                    </CardContent>
                  </Card>
                )}

                {isLoadingDeals ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <Card key={idx} className="animate-pulse">
                        <CardHeader className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {Array.from({ length: 3 }).map((__, i) => (
                            <div key={i} className="h-16 bg-gray-200 rounded"></div>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : pipelineViewMode === "kanban" ? (
                  <Pipeline
                    stages={pipelineStages}
                    onAddDeal={handleAddDeal}
                    onEditDeal={handleEditDeal}
                    onDeleteDeal={handleDeleteDeal}
                    onMoveDeal={handleMoveDeal}
                    onViewDeal={handleViewDeal}
                  />
                ) : pipelineViewMode === "list" ? (
                  <PipelineListView
                    deals={filteredDeals}
                    stages={pipelineStages}
                    onEditDeal={handleEditDeal}
                    onDeleteDeal={handleDeleteDeal}
                    onMoveDeal={handleMoveDeal}
                    onViewDeal={handleViewDeal}
                  />
                ) : (
                  <PipelineVisualizationView
                    deals={filteredDeals}
                    stages={pipelineStages}
                    onViewDeal={handleViewDeal}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Client Form Modal */}
        <ClientForm
          open={showClientForm}
          onOpenChange={setShowClientForm}
          client={editingClient}
          onSubmit={handleSubmitClient}
          isEditing={!!editingClient}
          existingTags={
            /* Extrair todas as tags únicas dos clientes existentes */
            Array.from(
              new Set(clients.flatMap((client) => client.tags || [])),
            ).sort()
          }
        />

        {/* Advanced Filters Dialog */}
        <AdvancedFilters
          open={showAdvancedFilters}
          onOpenChange={setShowAdvancedFilters}
          onApplyFilters={handleApplyAdvancedFilters}
          existingTags={
            /* IMPLEMENTAÇÃO MELHORADA: Extrair todas as tags únicas dos clientes existentes */
            Array.from(
              new Set(clients.flatMap((client) => client.tags || [])),
            ).sort()
          }
          existingLocations={
            Array.from(
              new Set(
                clients
                  .map((c) => `${c.city} - ${c.state}`)
                  .filter((loc) => loc && !loc.includes("undefined") && !loc.includes("null"))
              )
            ).sort()
          }
        />

        {/* Deal Form Modal */}
        <DealForm
          open={showDealForm}
          onOpenChange={setShowDealForm}
          deal={editingDeal}
          initialStage={dealInitialStage}
          onSubmit={handleSubmitDeal}
          isEditing={!!editingDeal}
        />

        {/* Client View Dialog */}
        <ClientViewDialog
          open={showClientView}
          onOpenChange={setShowClientView}
          client={viewingClient}
          onEdit={handleEditFromView}
        />

        <DealViewDialog
          open={showDealView}
          onOpenChange={setShowDealView}
          deal={viewingDeal}
          onEdit={handleEditFromDealView}
        />

        {/* Stage Names Editing Dialog */}
        <Dialog open={editingStages} onOpenChange={safeSetEditingStages}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Nomes dos Stages</DialogTitle>
              <DialogDescription>
                Personalize os nomes dos stages do pipeline de vendas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {pipelineStagesConfig.map((stage) => (
                <div key={stage.id}>
                  <label className="text-sm font-medium">
                    {stage.name} (Atual)
                  </label>
                  <Input
                    value={tempStageNames[ stage.id ] || stage.name}
                    onChange={(e) =>
                      setTempStageNames({
                        ...tempStageNames,
                        [ stage.id ]: e.target.value,
                      })
                    }
                    placeholder={stage.name}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={createSafeDialogHandler(() => {
                  safeSetEditingStages(false);
                  setTempStageNames({});
                })}
              >
                Cancelar
              </Button>
              <Button
                onClick={createSafeDialogHandler(() => {
                  const newConfig = pipelineStagesConfig.map((stage) => ({
                    ...stage,
                    name: tempStageNames[ stage.id ] || stage.name,
                  }));
                  setPipelineStagesConfig(newConfig);
                  saveStagePreferences(newConfig);
                  safeSetEditingStages(false);
                  setTempStageNames({});
                  toast({
                    title: "Stages atualizados",
                    description:
                      "Nomes dos stages foram atualizados e salvos para este tenant.",
                  });
                })}
              >
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
