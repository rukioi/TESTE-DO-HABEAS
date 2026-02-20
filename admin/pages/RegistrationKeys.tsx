import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { v4 as uuidv4 } from 'uuid';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Calendar,
  AlertTriangle,
  RefreshCcw,
  Eye,
  EyeOff,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdminApi';

interface RegistrationKey {
  id: string;
  key: string;
  accountType: string;
  isUsed: boolean;
  isRevoked: boolean;
  isActive: boolean;
  isExpired: boolean;
  usedBy?: string;
  usedAt?: string;
  userInfo?: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    usedAt: string;
  };
  tenantInfo?: {
    id: string;
    name: string;
    isActive: boolean;
  };
  createdAt: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
}

export function AdminRegistrationKeys() {
  const { getRegistrationKeys, createRegistrationKey, revokeRegistrationKey, deleteRegistrationKey, getTenants, isLoading } = useAdminApi();
  const [keys, setKeys] = useState<RegistrationKey[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('SIMPLES');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [registrationKey, setRegistrationKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTenantId, setFilterTenantId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredKeys = keys.filter((key) => {
    if (filterStatus !== 'all') {
      const statusMap: Record<string, string> = { ativa: 'ACTIVE', utilizada: 'USED' };
      if (statusMap[filterStatus] && key.status !== statusMap[filterStatus]) return false;
    }
    if (filterTenantId !== 'all' && key.tenantInfo?.id !== filterTenantId) return false;
    if (filterType !== 'all' && key.accountType !== filterType) return false;
    return true;
  });

  useEffect(() => {
    loadKeys();
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await getTenants();
      setTenants(data);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    }
  };

  const loadKeys = async () => {
    try {
      setError(null);
      setIsLoadingKeys(true);
      const data = await getRegistrationKeys();
      if (Array.isArray(data)) {
        setKeys(data);
      } else if (data && Array.isArray(data.keys)) {
        setKeys(data.keys);
      } else {
        setKeys([]);
      }
    } catch (err) {
      console.error('Failed to load keys:', err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar chaves de registro');
      setKeys([]);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const handleCreateKey = async () => {
    try {
      setError(null);
      if (!selectedTenantId) {
        setError('Selecione um tenant antes de criar a chave.');
        return;
      }
      if (!selectedAccountType) {
        setError('Selecione o tipo de conta.');
        return;
      }
      const newKey = await createRegistrationKey({
        tenantId: selectedTenantId,
        accountType: selectedAccountType,
        key: registrationKey,
        usesAllowed: 1,
        singleUse: true,
      });
      setSuccess(`Chave criada com sucesso: ${newKey.key}`);
      setIsCreateDialogOpen(false);
      setSelectedTenantId('');
      setSelectedAccountType('SIMPLES');
      setRegistrationKey('');
      await loadKeys();
    } catch (err) {
      console.error('Failed to create key:', err);
      setError(err instanceof Error ? err.message : 'Falha ao criar chave');
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Tem certeza que deseja revogar esta chave de registro?')) return;
    try {
      setError(null);
      await revokeRegistrationKey(keyId);
      setSuccess('Chave revogada com sucesso');
      await loadKeys();
    } catch (err) {
      console.error('Failed to revoke key:', err);
      setError(err instanceof Error ? err.message : 'Falha ao revogar chave');
    }
  };

  const handleDeleteKey = async (key: RegistrationKey) => {
    if (key.isUsed) {
      setError('Não é possível excluir uma chave que já foi utilizada');
      return;
    }
    const confirmMessage = `⚠️ DELETAR CHAVE DE REGISTRO?\n\n🗑️ Esta ação é IRREVERSÍVEL!\n\n📋 DETALHES:\n• ID: ${key.id.substring(0, 8)}...\n• Status: ${key.status}\n• Tipo: ${key.accountType}\n• Tenant: ${key.tenantInfo?.name || 'Sem tenant'}\n\n${key.userInfo ? '❌ Esta chave já foi UTILIZADA e NÃO pode ser deletada!' : '✅ Esta chave está INATIVA e pode ser deletada.'}\n\nConfirma?`;
    if (!confirm(confirmMessage)) return;
    try {
      setError(null);
      await deleteRegistrationKey(key.id);
      setSuccess('Chave excluída com sucesso');
      await loadKeys();
    } catch (err) {
      console.error('Failed to delete key:', err);
      setError(err instanceof Error ? err.message : 'Falha ao excluir chave');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Chave copiada para a área de transferência');
    setTimeout(() => setSuccess(null), 3000);
  };

  const getStatusBadge = (key: RegistrationKey) => {
    switch (key.status) {
      case 'USED':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/40"><CheckCircle className="h-3 w-3 mr-1" />Utilizada</Badge>;
      case 'REVOKED':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/40"><XCircle className="h-3 w-3 mr-1" />Revogada</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-[#F5A100] border-[#F5A100]/50"><AlertTriangle className="h-3 w-3 mr-1" />Expirada</Badge>;
      case 'ACTIVE':
        return <Badge variant="outline" className="bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/40"><Key className="h-3 w-3 mr-1" />Ativa</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-400 border-gray-600"><Key className="h-3 w-3 mr-1" />Desconhecido</Badge>;
    }
  };

  const getAccountTypeBadge = (accountType: string) => {
    const colors: Record<string, string> = {
      SIMPLES: 'bg-green-500/20 text-green-400 border-green-500/40',
      COMPOSTA: 'bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/40',
      GERENCIAL: 'bg-[#8B5CF6]/20 text-[#A78BFA] border-[#8B5CF6]/40',
    };
    return (
      <Badge variant="outline" className={colors[accountType] || 'bg-gray-500/20 text-gray-400 border-gray-500/40'}>
        {accountType}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 bg-[#1B223C] min-h-screen">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Chaves de Registro</h1>
            <p className="text-sm text-gray-400 mt-1">Gerencie chaves para novas contas</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto bg-[#e19a00] hover:bg-[#c78b00] text-white border-0">
                <Plus className="h-4 w-4 mr-2" />
                Criar Chave
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2A2F45] border-gray-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-white">Criar chave de registro</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Selecione o tenant e o tipo de conta para a nova chave
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant" className="text-gray-300">Tenant <span className="text-red-400">*</span></Label>
                  <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                    <SelectTrigger className="bg-[#1B223C] border-gray-700 text-white">
                      <SelectValue placeholder="Selecione um tenant" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2A2F45] border-gray-700">
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id} className="text-white focus:bg-[#1B223C]">
                          {tenant.name} ({tenant.userCount || 0}/{tenant.maxUsers || 5} usuários)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountType" className="text-gray-300">Tipo de conta</Label>
                  <Select value={selectedAccountType} onValueChange={setSelectedAccountType}>
                    <SelectTrigger className="bg-[#1B223C] border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2A2F45] border-gray-700">
                      <SelectItem value="SIMPLES" className="text-white focus:bg-[#1B223C]">Conta Simples</SelectItem>
                      <SelectItem value="COMPOSTA" className="text-white focus:bg-[#1B223C]">Conta Composta</SelectItem>
                      <SelectItem value="GERENCIAL" className="text-white focus:bg-[#1B223C]">Conta Gerencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key" className="text-gray-300">Chave (opcional)</Label>
                  <div className="relative w-full">
                    <Input
                      id="key"
                      value={registrationKey}
                      type={showKey ? 'text' : 'password'}
                      onChange={(e) => setRegistrationKey(e.target.value)}
                      className="pr-10 bg-[#1B223C] border-gray-700 text-white"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      onClick={() => setShowKey(!showKey)}
                      aria-label={showKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-[#1B223C]"
                    onClick={() => setRegistrationKey(uuidv4())}
                  >
                    <RefreshCcw className="h-3 w-3 mr-1" />
                    Gerar aleatoriamente
                  </Button>
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-[#1B223C]"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setSelectedTenantId('');
                      setSelectedAccountType('SIMPLES');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateKey}
                    disabled={isLoading || !selectedTenantId}
                    className="bg-[#e19a00] hover:bg-[#c78b00] text-white"
                  >
                    {isLoading ? 'Criando...' : 'Criar chave'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Alert className="border-red-800 bg-red-950/20 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-800 bg-green-950/20 text-green-400">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-white flex items-center">
                <Key className="h-5 w-5 mr-2 text-[#e19a00]" />
                Chaves de registro
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className={viewMode === 'list' ? 'bg-[#e19a00] hover:bg-[#c78b00] text-white' : 'text-gray-400 hover:text-white'}
                  onClick={() => setViewMode('list')}
                  title="Modo Lista"
                >
                  <LayoutList className="h-4 w-4 mr-1" />
                  Lista
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className={viewMode === 'kanban' ? 'bg-[#e19a00] hover:bg-[#c78b00] text-white' : 'text-gray-400 hover:text-white'}
                  onClick={() => setViewMode('kanban')}
                  title="Modo Kanban"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Kanban
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Label className="text-gray-400 text-sm whitespace-nowrap">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] h-9 bg-[#1B223C] border-gray-700 text-white text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2F45] border-gray-700">
                    <SelectItem value="all" className="text-white focus:bg-[#1B223C]">Todos</SelectItem>
                    <SelectItem value="ativa" className="text-white focus:bg-[#1B223C]">Ativa</SelectItem>
                    <SelectItem value="utilizada" className="text-white focus:bg-[#1B223C]">Utilizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-gray-400 text-sm whitespace-nowrap">Tenant</Label>
                <Select value={filterTenantId} onValueChange={setFilterTenantId}>
                  <SelectTrigger className="w-[180px] h-9 bg-[#1B223C] border-gray-700 text-white text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2F45] border-gray-700">
                    <SelectItem value="all" className="text-white focus:bg-[#1B223C]">Todos</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-white focus:bg-[#1B223C]">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-gray-400 text-sm whitespace-nowrap">Tipo</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px] h-9 bg-[#1B223C] border-gray-700 text-white text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2F45] border-gray-700">
                    <SelectItem value="all" className="text-white focus:bg-[#1B223C]">Todos</SelectItem>
                    <SelectItem value="GERENCIAL" className="text-white focus:bg-[#1B223C]">Gerencial</SelectItem>
                    <SelectItem value="COMPOSTA" className="text-white focus:bg-[#1B223C]">Composta</SelectItem>
                    <SelectItem value="SIMPLES" className="text-white focus:bg-[#1B223C]">Simples</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingKeys ? (
              <div className="text-center py-12">
                <div className="animate-spin h-10 w-10 border-4 border-[#e19a00] border-t-transparent rounded-full mx-auto" />
                <p className="mt-3 text-gray-400">Carregando chaves...</p>
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma chave encontrada</p>
              </div>
            ) : viewMode === 'kanban' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredKeys.map((key) => (
                  <Card key={key.id} className="bg-[#1B223C] border-gray-700 overflow-hidden">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <code className="text-xs bg-[#2A2F45] px-2 py-1 rounded text-gray-300 truncate flex-1">
                            {key.id.substring(0, 8)}...
                          </code>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0 text-gray-400 hover:text-white" onClick={() => copyToClipboard(key.id)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {getStatusBadge(key)}
                        {getAccountTypeBadge(key.accountType)}
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-4 space-y-2 text-sm">
                      {key.tenantInfo && (
                        <div>
                          <p className="text-gray-400 text-xs">Tenant</p>
                          <p className="text-white font-medium truncate">{key.tenantInfo.name}</p>
                        </div>
                      )}
                      {key.userInfo ? (
                        <div>
                          <p className="text-gray-400 text-xs">Usuário vinculado</p>
                          <p className="text-white truncate">{key.userInfo.name}</p>
                          <p className="text-gray-500 text-xs truncate">{key.userInfo.email}</p>
                        </div>
                      ) : (
                        <p className="text-red-400 text-sm">Chave inativa</p>
                      )}
                      <p className="text-gray-500 text-xs">Criado: {new Date(key.createdAt).toLocaleDateString('pt-BR')}</p>
                      <div className="flex justify-end gap-1 pt-2 border-t border-gray-700">
                        {key.status === 'ACTIVE' && !key.isUsed && !key.isRevoked && (
                          <Button size="sm" variant="ghost" onClick={() => handleRevokeKey(key.id)} className="text-[#F5A100] hover:bg-[#F5A100]/10 h-8" title="Revogar" disabled={isLoading}>
                            <XCircle className="h-3 w-3 mr-1" /> Revogar
                          </Button>
                        )}
                        {((key.status === 'ACTIVE' && !key.isUsed && !key.userInfo) || key.status === 'REVOKED') && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteKey(key)} className="text-red-400 hover:bg-red-500/10 h-8" title="Excluir" disabled={isLoading}>
                            <Trash2 className="h-3 w-3 mr-1" /> Excluir
                          </Button>
                        )}
                        {(key.isUsed || key.userInfo) && <span className="text-xs text-gray-500 py-1">Usada</span>}
                        {key.status === 'EXPIRED' && <span className="text-xs text-gray-500 py-1">Inativa</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma chave corresponde aos filtros</p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-transparent">
                        <TableHead className="text-gray-400">Chave</TableHead>
                        <TableHead className="text-gray-400">Tenant</TableHead>
                        <TableHead className="text-gray-400 hidden md:table-cell">Tipo</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400 hidden lg:table-cell">Usuário vinculado</TableHead>
                        <TableHead className="text-gray-400 hidden sm:table-cell">Criado</TableHead>
                        <TableHead className="text-gray-400 text-right w-24">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredKeys.map((key) => (
                        <TableRow key={key.id} className="border-gray-700 hover:bg-gray-800/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-[#1B223C] px-2 py-1 rounded text-gray-300 truncate max-w-[80px] sm:max-w-[120px]">
                                {key.id.substring(0, 8)}...
                              </code>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white" onClick={() => copyToClipboard(key.id)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {key.tenantInfo ? (
                              <div>
                                <p className="text-sm font-medium text-white truncate max-w-[100px] sm:max-w-none">{key.tenantInfo.name}</p>
                                <p className="text-xs text-gray-500">{key.tenantInfo.isActive ? 'Ativo' : 'Inativo'}</p>
                              </div>
                            ) : (
                              <span className="text-gray-500">Sem tenant</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{getAccountTypeBadge(key.accountType)}</TableCell>
                          <TableCell>{getStatusBadge(key)}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {key.userInfo ? (
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-white truncate">{key.userInfo.name}</p>
                                <p className="text-xs text-gray-500 truncate">{key.userInfo.email}</p>
                                <p className="text-xs text-gray-500">Registrado: {new Date(key.userInfo.usedAt).toLocaleDateString('pt-BR')}</p>
                              </div>
                            ) : (
                              <span className="text-red-400 text-sm">Chave inativa</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-gray-500">
                            {new Date(key.createdAt).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {key.status === 'ACTIVE' && !key.isUsed && !key.isRevoked && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRevokeKey(key.id)}
                                  className="text-[#F5A100] hover:bg-[#F5A100]/10 h-8 w-8 p-0"
                                  title="Revogar"
                                  disabled={isLoading}
                                >
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              )}
                              {((key.status === 'ACTIVE' && !key.isUsed && !key.userInfo) || key.status === 'REVOKED') && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteKey(key)}
                                  className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                                  title="Excluir"
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              {(key.isUsed || key.userInfo) && <span className="text-xs text-gray-500 py-1">Usada</span>}
                              {key.status === 'EXPIRED' && <span className="text-xs text-gray-500 py-1">Inativa</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
