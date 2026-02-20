import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building,
  Plus,
  Search,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  Users,
  Settings,
  Trash2,
  Calendar,
  FolderKanban,
  CheckSquare,
  UserCircle,
  Key,
  ChevronDown,
  ChevronRight,
  Mail,
  XCircle,
  Banknote,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TenantForm } from '../components/TenantForm';
import { TenantViewDialog } from '../components/TenantViewDialog';
import { useAdminApi, Tenant } from '../hooks/useAdminApi';
import { ApiConfigModal } from '../components/ApiConfigModal';
import { cn } from '@/lib/utils';

type TenantDetail = {
  users: Array<{ id: string; name: string; email: string; accountType: string; createdAt: string }>;
  registrationKeys: Array<{ id: string; accountType: string; status: string; createdAt: string }>;
};

export function AdminTenants() {
  const { getTenants, getTenantDetail, deleteTenant, updateTenant, toggleTenantStatus, revokeRegistrationKey, deleteRegistrationKey, assignPlanToTenant, getPlans } = useAdminApi();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  const [apiConfigTenant, setApiConfigTenant] = useState<Tenant | null>(null);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [tenantDetails, setTenantDetails] = useState<Record<string, TenantDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [showAssignPlanModal, setShowAssignPlanModal] = useState(false);
  const [assignPlanTenant, setAssignPlanTenant] = useState<Tenant | null>(null);
  const [assignPlanMonths, setAssignPlanMonths] = useState(1);
  const [assignPlanSelectedPlanId, setAssignPlanSelectedPlanId] = useState<string>('');
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [assignPlanLoading, setAssignPlanLoading] = useState(false);
  const [assignPlanError, setAssignPlanError] = useState<string | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    const filtered = tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTenants(filtered);
  }, [tenants, searchTerm]);

  const loadTenants = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getTenants();
      setTenants(data);
      setFilteredTenants(data);
    } catch (err) {
      console.error('Failed to load tenants:', err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar tenants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (
      !confirm(
        'Tem certeza que deseja excluir este tenant? Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }

    try {
      await deleteTenant(tenantId);
      await loadTenants();
    } catch (err) {
      console.error('Failed to delete tenant:', err);
      setError(err instanceof Error ? err.message : 'Falha ao excluir tenant');
      alert('Falha ao excluir tenant');
    }
  };

  const handleViewTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowViewDialog(true);
  };

  const handleConfigureApis = (tenant: Tenant) => {
    setApiConfigTenant(tenant);
    setShowApiConfigModal(true);
  };

  const handleOpenAssignPlanModal = async (tenant: Tenant) => {
    setAssignPlanTenant(tenant);
    setAssignPlanSelectedPlanId('');
    setAssignPlanMonths(1);
    setAssignPlanError(null);
    setShowAssignPlanModal(true);
    try {
      const plansData = await getPlans();
      setPlans(Array.isArray(plansData) ? plansData : []);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setAssignPlanError(err instanceof Error ? err.message : 'Falha ao carregar planos');
      setPlans([]);
    }
  };

  const handleCloseAssignPlanModal = () => {
    setShowAssignPlanModal(false);
    setAssignPlanTenant(null);
    setAssignPlanSelectedPlanId('');
    setAssignPlanMonths(1);
    setAssignPlanError(null);
  };

  const handleConfirmAssignPlan = async () => {
    if (!assignPlanTenant || !assignPlanSelectedPlanId) {
      setAssignPlanError('Selecione um plano');
      return;
    }
    if (plans.length === 0) {
      setAssignPlanError('Nenhum plano disponível');
      return;
    }
    try {
      setAssignPlanLoading(true);
      setAssignPlanError(null);
      const result = await assignPlanToTenant(assignPlanTenant.id, assignPlanSelectedPlanId, assignPlanMonths);
      const validUntil = result?.currentPeriodEnd
        ? new Date(result.currentPeriodEnd).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '—';
      handleCloseAssignPlanModal();
      await loadTenants();
      if (expandedTenantId === assignPlanTenant.id) {
        await refreshTenantDetail(assignPlanTenant.id);
      }
      alert(`Plano concedido com sucesso. Válido até ${validUntil}.`);
    } catch (err) {
      console.error('Failed to assign plan:', err);
      setAssignPlanError(err instanceof Error ? err.message : 'Falha ao conceder plano');
    } finally {
      setAssignPlanLoading(false);
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus = !tenant.isActive;
    const confirmMessage = newStatus
      ? `✅ ATIVAR TENANT "${tenant.name}"?\n\n🔓 Todos os usuários deste tenant poderão fazer login e acessar o sistema normalmente.\n\n✓ Funcionalidades serão liberadas\n✓ Acesso completo restaurado`
      : `🔒 DESATIVAR TENANT "${tenant.name}"?\n\n⚠️ ATENÇÃO: Todos os usuários deste tenant serão BLOQUEADOS imediatamente!\n\n❌ Não conseguirão fazer login\n❌ Receberão mensagem para renovar conta`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setError(null);
      await toggleTenantStatus(tenant.id, newStatus);
      await loadTenants();
    } catch (err) {
      console.error('Failed to toggle tenant status:', err);
      setError(
        err instanceof Error ? err.message : 'Falha ao alterar status do tenant'
      );
    }
  };

  const handleExtendPlan = async (tenant: Tenant) => {
    const newDate = prompt('Digite a nova data de expiração (formato: AAAA-MM-DD):');
    if (!newDate) return;

    try {
      setError(null);
      await updateTenant(tenant.id, { planExpiresAt: new Date(newDate).toISOString() });
      await loadTenants();
      alert('Data de expiração atualizada com sucesso!');
    } catch (err) {
      console.error('Failed to extend plan:', err);
      setError(
        err instanceof Error ? err.message : 'Falha ao estender plano'
      );
    }
  };

  const getPlanBadgeColor = (planType: string) => {
    const t = planType?.toLowerCase() || '';
    if (t === 'enterprise') return 'bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/40';
    if (t === 'premium') return 'bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/40';
    if (t === 'basic') return 'bg-[#6B7280]/20 text-[#9CA3AF] border-[#6B7280]/40';
    return 'bg-[#e19a00]/20 text-[#F5A100] border-[#e19a00]/40';
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const toggleTenantExpand = async (tenant: Tenant) => {
    const id = tenant.id;
    if (expandedTenantId === id) {
      setExpandedTenantId(null);
      return;
    }
    setExpandedTenantId(id);
    if (tenantDetails[id]) return;
    setLoadingDetailId(id);
    try {
      const detail = await getTenantDetail(id);
      setTenantDetails((prev) => ({ ...prev, [id]: detail }));
    } catch (err) {
      console.error('Failed to load tenant detail:', err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar detalhes do tenant');
    } finally {
      setLoadingDetailId(null);
    }
  };

  const refreshTenantDetail = async (tenantId: string) => {
    try {
      const detail = await getTenantDetail(tenantId);
      setTenantDetails((prev) => ({ ...prev, [tenantId]: detail }));
    } catch (err) {
      console.error('Failed to refresh tenant detail:', err);
    }
  };

  const handleRevokeKey = async (keyId: string, tenantId: string) => {
    if (!confirm('Revogar esta chave? Ela não poderá ser utilizada.')) return;
    try {
      await revokeRegistrationKey(keyId);
      await refreshTenantDetail(tenantId);
    } catch (err) {
      console.error('Failed to revoke key:', err);
      setError(err instanceof Error ? err.message : 'Falha ao revogar chave');
    }
  };

  const handleDeleteKey = async (keyId: string, tenantId: string) => {
    if (!confirm('Excluir esta chave? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteRegistrationKey(keyId);
      await refreshTenantDetail(tenantId);
    } catch (err) {
      console.error('Failed to delete key:', err);
      setError(err instanceof Error ? err.message : 'Falha ao excluir chave');
    }
  };

  const getKeyStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/40',
      USED: 'bg-green-500/20 text-green-400 border-green-500/40',
      EXPIRED: 'text-[#F5A100] border-[#F5A100]/50',
      REVOKED: 'bg-red-500/20 text-red-400 border-red-500/40',
    };
    const label: Record<string, string> = {
      ACTIVE: 'Ativa',
      USED: 'Utilizada',
      EXPIRED: 'Expirada',
      REVOKED: 'Revogada',
    };
    return (
      <Badge variant="outline" className={map[status] || 'text-gray-400'}>
        {label[status] || status}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 bg-[#1B223C] min-h-screen">
        {/* Header: título + botão Criar Tenant (responsivo) */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Gerenciamento de Tenants
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Gerencie todos os tenants e suas configurações
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="w-full sm:w-auto bg-[#e19a00] hover:bg-[#c78b00] text-white border-0 shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Tenant
          </Button>
        </div>

        {/* Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar tenants..."
              className="pl-10 bg-[#2A2F45] border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-[#e19a00]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <Alert className="border-red-800 bg-red-950/20 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-white">
              <Building className="h-5 w-5 mr-2 text-[#e19a00]" />
              Tenants ({filteredTenants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-10 w-10 border-4 border-[#e19a00] border-t-transparent rounded-full mx-auto" />
                <p className="mt-3 text-gray-400">Carregando tenants...</p>
              </div>
            ) : (
              <div className="rounded-lg border border-black-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-transparent">
                        <TableHead className="text-gray-400 font-medium">Tenant</TableHead>
                        <TableHead className="text-gray-400 font-medium">Plano</TableHead>
                        <TableHead className="text-gray-400 font-medium">Usuários</TableHead>
                        <TableHead className="text-gray-400 font-medium hidden lg:table-cell">Dados</TableHead>
                        <TableHead className="text-gray-400 font-medium">Status</TableHead>
                        <TableHead className="text-gray-400 font-medium hidden md:table-cell">Criado em</TableHead>
                        <TableHead className="w-12 text-gray-400 font-medium text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.length === 0 ? (
                        <TableRow className="border-gray-700 hover:bg-transparent">
                          <TableCell
                            colSpan={7}
                            className="text-center py-12 text-gray-400"
                          >
                            Nenhum tenant encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTenants.map((tenant) => {
                          const isExpanded = expandedTenantId === tenant.id;
                          const detail = tenantDetails[tenant.id];
                          const loadingDetail = loadingDetailId === tenant.id;
                          return (
                            <React.Fragment key={tenant.id}>
                              <TableRow
                                className={cn(
                                  'border-gray-700 hover:bg-gray-800/50 cursor-pointer transition-colors',
                                  isExpanded && 'bg-[#e19a00]/10'
                                )}
                                onClick={() => toggleTenantExpand(tenant)}
                              >
                                <TableCell className={cn(isExpanded && 'border-l-[6px] border-[#e19a00]')}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400 shrink-0">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </span>
                                    <div>
                                      <div className="font-medium text-white">
                                        {tenant.name}
                                      </div>
                                      <div className="text-xs text-gray-500 font-mono truncate max-w-[120px] sm:max-w-none">
                                        {tenant.id}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Badge
                                    variant="outline"
                                    className={getPlanBadgeColor(tenant.planType)}
                                  >
                                    {(tenant.planType || 'basic').toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5">
                                    <Users className="h-4 w-4 text-[#3B82F6]" />
                                    <span className="text-white text-sm">
                                      {tenant.userCount}/{tenant.maxUsers}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                                  <div className="space-y-1 text-xs text-gray-400">
                                    <div className="flex items-center gap-1">
                                      <UserCircle className="h-3.5 w-3 text-[#06B6D4]" />
                                      {tenant.stats.clients} clientes
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <FolderKanban className="h-3.5 w-3 text-[#F5A100]" />
                                      {tenant.stats.projects} projetos
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <CheckSquare className="h-3.5 w-3 text-green-400" />
                                      {tenant.stats.tasks} tarefas
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <div className="space-y-1">
                                    <Badge
                                      variant="outline"
                                      className={
                                        tenant.isActive
                                          ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                          : 'bg-red-500/20 text-red-400 border-red-500/40'
                                      }
                                    >
                                      {tenant.isActive ? 'Ativo' : 'Inativo'}
                                    </Badge>
                                    <div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleStatus(tenant);
                                        }}
                                        disabled={isLoading}
                                        className={
                                          tenant.isActive
                                            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-medium h-8'
                                            : 'text-green-400 hover:text-green-300 hover:bg-green-500/10 text-xs font-medium h-8'
                                        }
                                      >
                                        {isLoading ? (
                                          <span className="flex items-center gap-1">
                                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            Processando...
                                          </span>
                                        ) : tenant.isActive ? (
                                          '🔒 Desativar'
                                        ) : (
                                          '✅ Ativar'
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-gray-400" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3 text-[#6B7280]" />
                                    {new Date(tenant.createdAt).toLocaleDateString(
                                      'pt-BR'
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      className="bg-[#2A2F45] border-gray-700"
                                    >
                                      <DropdownMenuItem
                                        onClick={() => handleViewTenant(tenant)}
                                        className="text-gray-300 focus:bg-gray-700 focus:text-white"
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Ver detalhes
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleConfigureApis(tenant)}
                                        className="text-gray-300 focus:bg-gray-700 focus:text-white"
                                      >
                                        <Settings className="mr-2 h-4 w-4" />
                                        Configurar APIs
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleOpenAssignPlanModal(tenant)}
                                        className="text-[#e19a00] focus:bg-[#e19a00]/10 focus:text-[#F5A100]"
                                      >
                                        <Banknote className="mr-2 h-4 w-4" />
                                        Conceder Plano (Pix)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteTenant(tenant.id)}
                                        className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="border-gray-700 hover:bg-transparent">
                                  <TableCell colSpan={7} className="p-0 align-top border-l-[6px] border-[#e19a00] bg-[#e19a00]/10">
                                    <div className="border-t border-[#e19a00]/40 bg-[#1e2439]/90 px-4 py-4 rounded-b-lg">
                                      {loadingDetail ? (
                                        <div className="flex items-center justify-center py-8 text-gray-400">
                                          <span className="w-5 h-5 border-2 border-[#e19a00] border-t-transparent rounded-full animate-spin mr-2" />
                                          Carregando usuários e chaves...
                                        </div>
                                      ) : detail ? (
                                        <div className="space-y-6">
                                          <div>
                                            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                              <UserCircle className="h-4 w-4 text-[#e19a00]" />
                                              Usuários
                                            </h4>
                                            {detail.users.length === 0 ? (
                                              <p className="text-sm text-gray-500 py-2">Nenhum usuário registrado.</p>
                                            ) : (
                                              <div className="overflow-x-auto rounded-lg border border-gray-700">
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow className="border-gray-700 hover:bg-transparent">
                                                      <TableHead className="text-gray-400 text-xs">Nome</TableHead>
                                                      <TableHead className="text-gray-400 text-xs">Email</TableHead>
                                                      <TableHead className="text-gray-400 text-xs">Data de registro</TableHead>
                                                      <TableHead className="text-gray-400 text-xs">Tipo de conta</TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {detail.users.map((u) => (
                                                      <TableRow key={u.id} className="border-gray-700">
                                                        <TableCell className="text-sm text-white py-2">{u.name}</TableCell>
                                                        <TableCell className="text-sm text-gray-300 py-2 flex items-center gap-1">
                                                          <Mail className="h-3 w-3 text-gray-500" />
                                                          {u.email}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-gray-400 py-2">
                                                          {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                          <Badge variant="outline" className={getPlanBadgeColor(u.accountType)}>
                                                            {u.accountType}
                                                          </Badge>
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            )}
                                          </div>
                                          <div>
                                            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                                              <Key className="h-4 w-4 text-[#3B82F6]" />
                                              Chaves de registro vinculadas
                                            </h4>
                                            {detail.registrationKeys.length === 0 ? (
                                              <p className="text-sm text-gray-500 py-2">Nenhuma chave vinculada.</p>
                                            ) : (
                                              <div className="overflow-x-auto rounded-lg border border-gray-700">
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow className="border-gray-700 hover:bg-transparent">
                                                      <TableHead className="text-gray-400 text-xs">Tipo</TableHead>
                                                      <TableHead className="text-gray-400 text-xs">Status</TableHead>
                                                      <TableHead className="text-gray-400 text-xs">Criada em</TableHead>
                                                      <TableHead className="text-gray-400 text-xs text-right">Ações</TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {detail.registrationKeys.map((k) => (
                                                      <TableRow key={k.id} className="border-gray-700">
                                                        <TableCell className="text-sm text-white py-2">{k.accountType}</TableCell>
                                                        <TableCell className="py-2">{getKeyStatusBadge(k.status)}</TableCell>
                                                        <TableCell className="text-sm text-gray-400 py-2">
                                                          {new Date(k.createdAt).toLocaleDateString('pt-BR')}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                          {(k.status === 'ACTIVE' || k.status === 'REVOKED') ? (
                                                            <div className="flex justify-end gap-1 flex-wrap">
                                                              {k.status === 'ACTIVE' && (
                                                                <Button
                                                                  size="sm"
                                                                  variant="ghost"
                                                                  onClick={() => handleRevokeKey(k.id, tenant.id)}
                                                                  className="text-[#F5A100] hover:bg-[#F5A100]/10 h-8 text-xs"
                                                                  title="Revogar"
                                                                >
                                                                  <XCircle className="h-3 w-3 mr-1" /> Revogar
                                                                </Button>
                                                              )}
                                                              <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleDeleteKey(k.id, tenant.id)}
                                                                className="text-red-400 hover:bg-red-500/10 h-8 text-xs"
                                                                title="Excluir"
                                                              >
                                                                <Trash2 className="h-3 w-3 mr-1" /> Excluir
                                                              </Button>
                                                            </div>
                                                          ) : (
                                                            <span className="text-xs text-gray-500">—</span>
                                                          )}
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <TenantForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          onSuccess={loadTenants}
        />

        <TenantViewDialog
          tenant={selectedTenant}
          open={showViewDialog}
          onOpenChange={setShowViewDialog}
        />

        <ApiConfigModal
          tenant={apiConfigTenant}
          open={showApiConfigModal}
          onOpenChange={setShowApiConfigModal}
          onSuccess={loadTenants}
        />

        <Dialog open={showAssignPlanModal} onOpenChange={(open) => !open && handleCloseAssignPlanModal()}>
          <DialogContent className="bg-[#2A2F45] border-gray-700 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Banknote className="h-5 w-5 text-[#e19a00]" />
                Conceder Plano (Pagamento PIX/Manual)
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {assignPlanTenant
                  ? `Selecione o plano e a vigência para o tenant "${assignPlanTenant.name}". O cliente terá acesso completo conforme o plano escolhido.`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {assignPlanError && (
                <Alert className="border-red-800 bg-red-950/20 text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{assignPlanError}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-2">
                <Label htmlFor="assign-plan-select" className="text-gray-300">
                  Plano
                </Label>
                <Select
                  value={assignPlanSelectedPlanId}
                  onValueChange={setAssignPlanSelectedPlanId}
                >
                  <SelectTrigger
                    id="assign-plan-select"
                    className="bg-[#1B223C] border-gray-600 text-white placeholder:text-gray-500 focus:ring-[#e19a00]"
                  >
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2F45] border-gray-700">
                    {plans.length === 0 ? (
                      <div className="py-4 px-3 text-center text-sm text-gray-500">Nenhum plano disponível</div>
                    ) : (
                      plans.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        className="text-gray-300 focus:bg-gray-700 focus:text-white"
                      >
                        {p.name}
                      </SelectItem>
                    ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="assign-plan-months" className="text-gray-300">
                  Meses de vigência
                </Label>
                <Input
                  id="assign-plan-months"
                  type="number"
                  min={1}
                  max={24}
                  value={assignPlanMonths}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 1;
                    setAssignPlanMonths(Math.min(24, Math.max(1, v)));
                  }}
                  className="bg-[#1B223C] border-gray-600 text-white placeholder:text-gray-500 focus-visible:ring-[#e19a00]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCloseAssignPlanModal}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmAssignPlan}
                disabled={!assignPlanSelectedPlanId || plans.length === 0 || assignPlanLoading}
                className="bg-[#e19a00] hover:bg-[#c78b00] text-white"
              >
                {assignPlanLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Concedendo...
                  </>
                ) : (
                  'Conceder'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
