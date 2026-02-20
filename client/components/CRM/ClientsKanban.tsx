import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, Mail, Phone, Eye, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Client } from '@/types/crm';

type ClientStatus = 'active' | 'inactive' | 'pending';

interface Column {
  id: ClientStatus;
  name: string;
  color: string;
  clients: Client[];
}

interface ClientsKanbanProps {
  clients: Client[];
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onViewClient: (client: Client) => void;
  onMoveClient: (clientId: string, newStatus: ClientStatus) => void;
}

const statusConfig: Record<ClientStatus, { name: string; color: string }> = {
  active: { name: 'Ativo', color: 'bg-green-100 text-green-800' },
  pending: { name: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  inactive: { name: 'Inativo', color: 'bg-gray-100 text-gray-800' },
};

export function ClientsKanban({ clients, onEditClient, onDeleteClient, onViewClient, onMoveClient }: ClientsKanbanProps) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<ClientStatus | null>(null);
  const [pageByColumn, setPageByColumn] = React.useState<Record<string, number>>({});
  const CARDS_PER_PAGE = 5;

  const columns: Column[] = [
    { id: 'active', name: statusConfig.active.name, color: statusConfig.active.color, clients: clients.filter(c => c.status === 'active') },
    { id: 'pending', name: statusConfig.pending.name, color: statusConfig.pending.color, clients: clients.filter(c => c.status === 'pending') },
    { id: 'inactive', name: statusConfig.inactive.name, color: statusConfig.inactive.color, clients: clients.filter(c => c.status === 'inactive') },
  ];

  const getCurrentPageClients = (list: Client[], colId: string) => {
    const current = pageByColumn[colId] || 0;
    const start = current * CARDS_PER_PAGE;
    const end = start + CARDS_PER_PAGE;
    const sorted = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sorted.slice(start, end);
  };

  const getTotalPages = (list: Client[]) => {
    return Math.ceil(list.length / CARDS_PER_PAGE);
  };

  const nextPage = (colId: string, totalPages: number) => {
    const current = pageByColumn[colId] || 0;
    if (current < totalPages - 1) {
      setPageByColumn(prev => ({ ...prev, [colId]: current + 1 }));
    }
  };

  const prevPage = (colId: string) => {
    const current = pageByColumn[colId] || 0;
    if (current > 0) {
      setPageByColumn(prev => ({ ...prev, [colId]: current - 1 }));
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    setDragOverColumn(null);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, col: ClientStatus) => {
    e.preventDefault();
    setDragOverColumn(col);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, target: ClientStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDraggedId(null);
    setDragOverColumn(null);
    if (id) onMoveClient(id, target);
  };

  const formatCurrency = (value?: number, currency?: string) => {
    if (typeof value !== 'number') return '—';
    const map: Record<string, Intl.NumberFormat> = {
      BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    };
    const fmt = map[(currency || 'BRL').toUpperCase()] || map.BRL;
    return fmt.format(value);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 w-full min-h-[600px]">
        {columns.map(col => (
          <div
            key={col.id}
            className="flex flex-col h-full"
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <Card className={`flex-1 flex flex-col ${dragOverColumn === col.id ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{col.name}</CardTitle>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{col.clients.length} clientes</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 p-3 pt-0">
                {getCurrentPageClients(col.clients, col.id).map(client => (
                  <Card
                    key={client.id}
                    className={`cursor-move hover:shadow-md transition-all ${draggedId === client.id ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, client.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm font-medium line-clamp-2">{client.name}</h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 w-6 p-0">
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onViewClient(client)}>
                                <Eye className="mr-2 h-3 w-3" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEditClient(client)}>
                                <Edit className="mr-2 h-3 w-3" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDeleteClient(client.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-3 w-3" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={client.image} alt={client.name} />
                            <AvatarFallback className="text-xs">
                              {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            {client.organization && (
                              <div className="text-xs text-muted-foreground truncate">{client.organization}</div>
                            )}
                          </div>
                          <Badge className={statusConfig[client.status as ClientStatus]?.color || 'bg-gray-100 text-gray-800'} variant="secondary">
                            {statusConfig[client.status as ClientStatus]?.name || client.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 mr-1" />
                            <span className="truncate">{client.email}</span>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 mr-1" />
                            <span className="truncate">{client.phone}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-green-600">
                            {formatCurrency(client.budget, client.currency)}
                          </div>
                          {client.tags && client.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {client.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                              {client.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">+{client.tags.length - 2}</Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Atualizado: {new Date(client.updatedAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {col.clients.length > CARDS_PER_PAGE && (
                  <div className="flex items-center justify-between pt-3 border-t">
                    <Button size="sm" variant="ghost" onClick={() => prevPage(col.id)} disabled={!pageByColumn[col.id] || pageByColumn[col.id] === 0} className="h-6 w-6 p-0">
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      {(pageByColumn[col.id] || 0) + 1} / {getTotalPages(col.clients)}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => nextPage(col.id, getTotalPages(col.clients))} disabled={(pageByColumn[col.id] || 0) >= getTotalPages(col.clients) - 1} className="h-6 w-6 p-0">
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {col.clients.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Nenhum cliente</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
