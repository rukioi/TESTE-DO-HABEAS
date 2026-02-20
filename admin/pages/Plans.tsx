import React, { useEffect, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Trash2, CreditCard } from 'lucide-react';
import { useAdminApi } from '../hooks/useAdminApi';

export function AdminPlans() {
  const { getPlans, createPlan, updatePlan, deletePlan } = useAdminApi() as any;
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newPlan, setNewPlan] = useState<{
    name: string;
    stripePriceId: string;
    maxQueries: number;
    maxUsers: number;
    price?: number;
    additionalQueryFee?: number;
  }>({
    name: '',
    stripePriceId: '',
    maxQueries: 0,
    maxUsers: 5,
    price: 0,
    additionalQueryFee: 0,
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await getPlans();
      setPlans(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar planos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.stripePriceId) {
      alert('Informe nome e Stripe Price ID');
      return;
    }
    try {
      setError(null);
      await createPlan({
        name: newPlan.name,
        stripePriceId: newPlan.stripePriceId,
        maxUsers: newPlan.maxUsers,
        maxQueries: newPlan.maxQueries,
        price: newPlan.price,
        additionalQueryFee: newPlan.additionalQueryFee,
      });
      setNewPlan({ name: '', stripePriceId: '', maxQueries: 0, maxUsers: 5, price: 0, additionalQueryFee: 0 });
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar plano');
    }
  };

  const handleUpdatePlan = async (p: any) => {
    try {
      setError(null);
      await updatePlan(p.id, {
        name: p.name,
        stripePriceId: p.stripePriceId,
        maxQueries: p.maxQueries || 0,
        maxUsers: p.maxUsers || 5,
        price: typeof p.price === 'number' ? p.price : (p.price ? Number(p.price) : 0),
        additionalQueryFee: typeof p.additionalQueryFee === 'number' ? p.additionalQueryFee : (p.additionalQueryFee ? Number(p.additionalQueryFee) : 0),
      });
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar plano');
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Excluir este plano?')) return;
    try {
      setError(null);
      await deletePlan(id);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir plano');
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 bg-[#1B223C] min-h-screen">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Planos</h1>
          <p className="text-sm text-gray-400 mt-1">Controle de nome, Stripe Price e requisições</p>
        </div>

        {error && (
          <Alert className="border-red-800 bg-red-950/20 text-red-400">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Plus className="h-5 w-5 mr-2 text-[#e19a00]" />
              Criar novo plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Nome</label>
                <Input
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  className="bg-[#1B223C] border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Stripe Price ID</label>
                <div className="relative">
                  <CreditCard className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    className="pl-8 bg-[#1B223C] border-gray-700 text-white"
                    value={newPlan.stripePriceId}
                    onChange={(e) => setNewPlan({ ...newPlan, stripePriceId: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max Queries</label>
                <Input
                  type="number"
                  min={0}
                  value={newPlan.maxQueries}
                  onChange={(e) => setNewPlan({ ...newPlan, maxQueries: parseInt(e.target.value || '0') })}
                  className="bg-[#1B223C] border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Max Users</label>
                <Input
                  type="number"
                  min={1}
                  value={newPlan.maxUsers}
                  onChange={(e) => setNewPlan({ ...newPlan, maxUsers: parseInt(e.target.value || '1') })}
                  className="bg-[#1B223C] border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Preço (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={newPlan.price ?? ''}
                  onChange={(e) => setNewPlan({ ...newPlan, price: parseFloat(e.target.value || '0') })}
                  className="bg-[#1B223C] border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Taxa excedente (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={newPlan.additionalQueryFee ?? ''}
                  onChange={(e) => setNewPlan({ ...newPlan, additionalQueryFee: parseFloat(e.target.value || '0') })}
                  className="bg-[#1B223C] border-gray-700 text-white"
                />
              </div>
            </div>
            <Button onClick={handleCreatePlan} className="bg-[#e19a00] hover:bg-[#c78b00] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Criar plano
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-white">Planos existentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-10 w-10 border-4 border-[#e19a00] border-t-transparent rounded-full mx-auto" />
                <p className="mt-3 text-gray-400">Carregando planos...</p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700 hover:bg-transparent">
                        <TableHead className="text-gray-400">Nome</TableHead>
                        <TableHead className="text-gray-400 hidden lg:table-cell">Stripe Price ID</TableHead>
                        <TableHead className="text-gray-400">Max Queries</TableHead>
                        <TableHead className="text-gray-400">Max Users</TableHead>
                        <TableHead className="text-gray-400 hidden md:table-cell">Preço</TableHead>
                        <TableHead className="text-gray-400 hidden md:table-cell">Taxa excedente</TableHead>
                        <TableHead className="text-gray-400 hidden sm:table-cell">Atualizado</TableHead>
                        <TableHead className="text-gray-400 w-40">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.length === 0 ? (
                        <TableRow className="border-gray-700 hover:bg-transparent">
                          <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                            Nenhum plano cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        plans.map((p) => (
                          <TableRow key={p.id} className="border-gray-700 hover:bg-gray-800/50">
                            <TableCell>
                              <Input
                                value={p.name}
                                onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, name: e.target.value } : pl))}
                                className="bg-[#1B223C] border-gray-700 text-white h-9 text-sm"
                              />
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Input
                                value={p.stripePriceId}
                                onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, stripePriceId: e.target.value } : pl))}
                                className="bg-[#1B223C] border-gray-700 text-white h-9 text-sm"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                value={p.maxQueries || 0}
                                onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, maxQueries: parseInt(e.target.value || '0') } : pl))}
                                className="bg-[#1B223C] border-gray-700 text-white h-9 text-sm w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-[#e19a00]/20 text-[#e19a00] border-[#e19a00]/40">
                                {p.maxUsers}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={typeof p.price === 'number' ? p.price : (p.price ? Number(p.price) : 0)}
                                onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, price: parseFloat(e.target.value || '0') } : pl))}
                                className="bg-[#1B223C] border-gray-700 text-white h-9 text-sm w-24"
                              />
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={typeof p.additionalQueryFee === 'number' ? p.additionalQueryFee : (p.additionalQueryFee ? Number(p.additionalQueryFee) : 0)}
                                onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, additionalQueryFee: parseFloat(e.target.value || '0') } : pl))}
                                className="bg-[#1B223C] border-gray-700 text-white h-9 text-sm w-24"
                              />
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-gray-500">
                              {new Date(p.updatedAt || p.createdAt).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdatePlan(p)}
                                  className="border-gray-600 text-gray-300 hover:bg-[#1B223C] h-8"
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Salvar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeletePlan(p.id)}
                                  className="h-8"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Excluir
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
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
