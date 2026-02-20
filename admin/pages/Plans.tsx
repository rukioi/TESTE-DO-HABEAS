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
  const [ plans, setPlans ] = useState<any[]>([]);
  const [ error, setError ] = useState<string | null>(null);
  const [ isLoading, setIsLoading ] = useState(true);

  const [ newPlan, setNewPlan ] = useState<{ name: string; stripePriceId: string; maxQueries: number; maxUsers: number; price?: number; additionalQueryFee?: number }>({
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
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.stripePriceId) {
      alert('Informe nome e stripePriceId');
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
      setError(err instanceof Error ? err.message : 'Failed to create plan');
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
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Excluir este plano?')) return;
    try {
      setError(null);
      await deletePlan(id);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planos</h1>
            <p className="text-gray-600">Controle de nome, Stripe Price e requisições</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Criar novo plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Nome</label>
                <Input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Stripe Price ID</label>
                <div className="relative">
                  <CreditCard className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={newPlan.stripePriceId} onChange={(e) => setNewPlan({ ...newPlan, stripePriceId: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Max Queries</label>
                <Input type="number" min={0} value={newPlan.maxQueries} onChange={(e) => setNewPlan({ ...newPlan, maxQueries: parseInt(e.target.value || '0') })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Max Users</label>
                <Input type="number" min={1} value={newPlan.maxUsers} onChange={(e) => setNewPlan({ ...newPlan, maxUsers: parseInt(e.target.value || '1') })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Preço (R$)</label>
                <Input type="number" step="0.01" min={0} onChange={(e) => (setNewPlan as any)({ ...newPlan, price: parseFloat(e.target.value || '0') })} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Taxa Excedente (R$)</label>
                <Input type="number" step="0.01" min={0} onChange={(e) => (setNewPlan as any)({ ...newPlan, additionalQueryFee: parseFloat(e.target.value || '0') })} />
              </div>
            </div>
            <Button onClick={handleCreatePlan}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Plano
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planos existentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Carregando planos...</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Stripe Price ID</TableHead>
                      <TableHead>Max Queries</TableHead>
                      <TableHead>Max Users</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Taxa Excedente</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="w-40">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum plano cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      plans.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Input value={p.name} onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, name: e.target.value } : pl))} />
                          </TableCell>
                          <TableCell>
                            <Input value={p.stripePriceId} onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, stripePriceId: e.target.value } : pl))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} value={p.maxQueries || 0} onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, maxQueries: parseInt(e.target.value || '0') } : pl))} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.maxUsers}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={typeof p.price === 'number' ? p.price : (p.price ? Number(p.price) : 0)}
                              onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, price: parseFloat(e.target.value || '0') } : pl))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={typeof p.additionalQueryFee === 'number' ? p.additionalQueryFee : (p.additionalQueryFee ? Number(p.additionalQueryFee) : 0)}
                              onChange={(e) => setPlans(plans.map(pl => pl.id === p.id ? { ...pl, additionalQueryFee: parseFloat(e.target.value || '0') } : pl))}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{new Date(p.updatedAt || p.createdAt).toLocaleString()}</span>
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <Button variant="secondary" onClick={() => handleUpdatePlan(p)}>
                              <Save className="h-4 w-4 mr-2" />
                              Salvar
                            </Button>
                            <Button variant="destructive" onClick={() => handleDeletePlan(p.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
