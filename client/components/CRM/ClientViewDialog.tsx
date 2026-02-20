import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  Edit,
  FileText,
  Tag,
} from 'lucide-react';
import { Client } from '@/types/crm';
import { apiService } from '@/services/apiService';

interface ClientViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onEdit?: (client: Client) => void;
}

export function ClientViewDialog({
  open,
  onOpenChange,
  client,
  onEdit
}: ClientViewDialogProps) {
  if (!client) return null;
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[ 0 ].charAt(0).toUpperCase();
    const first = parts[ 0 ].charAt(0);
    const last = parts[ parts.length - 1 ].charAt(0);
    return (first + last).toUpperCase();
  };
  const AVATAR_PALETTE = [
    'bg-slate-200 text-slate-700',
    'bg-indigo-200 text-indigo-700',
    'bg-emerald-200 text-emerald-700',
    'bg-sky-200 text-sky-700',
    'bg-violet-200 text-violet-700',
    'bg-rose-200 text-rose-700',
  ];
  const colorClassFor = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return AVATAR_PALETTE[ Math.abs(hash) % AVATAR_PALETTE.length ];
  };
  const [ attachments, setAttachments ] = useState<Array<{ name: string; url?: string; size?: number }>>([]);
  const [ loadingAttachments, setLoadingAttachments ] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!open || !client?.id) return;
      try {
        setLoadingAttachments(true);
        const res = await apiService.getClientAttachments(client.id);
        if (!mounted) return;
        setAttachments(res.attachments || []);
      } catch {
        if (!mounted) return;
        setAttachments([]);
      } finally {
        if (!mounted) return;
        setLoadingAttachments(false);
      }
    })();
    return () => { mounted = false; };
  }, [ open, client?.id ]);

  const formatCurrency = (value: number, currency: string) => {
    const formatters = {
      BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    };
    return formatters[ currency as keyof typeof formatters ]?.format(value) || `${currency} ${value}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getMaritalStatusLabel = (status: string) => {
    const statusMap = {
      single: 'Solteiro(a)',
      married: 'Casado(a)',
      divorced: 'Divorciado(a)',
      widowed: 'Viúvo(a)',
      separated: 'Separado(a)',
    };
    return statusMap[ status as keyof typeof statusMap ] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return colors[ status as keyof typeof colors ] || 'bg-gray-100 text-gray-800';
  };

  const triggerDownload = (url: string, name?: string) => {
    const a = document.createElement('a');
    a.href = url;
    if (name) {
      a.download = name;
    } else {
      a.setAttribute('download', '');
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Guard clause para evitar erros quando client é undefined
  if (!client) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cliente não encontrado</DialogTitle>
            <DialogDescription>
              As informações do cliente não estão disponíveis.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={client?.image} alt={client?.name || 'Cliente'} />
                <AvatarFallback className={`text-lg ${colorClassFor(client?.id || client?.name || '')}`}>
                  {client?.name ? getInitials(client.name) : 'CL'}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl">{client?.name || 'Cliente'}</DialogTitle>
                <DialogDescription className="flex items-center space-x-2">
                  {client?.organization && (
                    <>
                      <Building className="h-4 w-4" />
                      <span>{client.organization}</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(client?.status || 'active')}>
                {client?.status === 'active' ? 'Ativo' :
                  client?.status === 'inactive' ? 'Inativo' : 'Pendente'}
              </Badge>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(client)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <User className="h-5 w-5 mr-2" />
                Informações Pessoais
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{client.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{client.phone}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {client.address}, {client.city} - {client.state}, {client.zipCode}
                  </span>
                </div>
                {client.cpf && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CPF:</span>
                    <span>{client.cpf}</span>
                  </div>
                )}
                {client.rg && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">RG:</span>
                    <span>{client.rg}</span>
                  </div>
                )}
                {client.birthDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data de Nascimento:</span>
                    <span>{formatDate(client.birthDate)}</span>
                  </div>
                )}
                {client.maritalStatus && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estado Civil:</span>
                    <span>{getMaritalStatusLabel(client.maritalStatus)}</span>
                  </div>
                )}
                {client.professionalTitle && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profissão:</span>
                    <span>{client.professionalTitle}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Informações Financeiras
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Orçamento:</span>
                  <span className="font-medium">
                    {formatCurrency(client.budget, client.currency)}
                  </span>
                </div>
                {client.amountPaid && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Pago:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(client.amountPaid, client.currency)}
                    </span>
                  </div>
                )}
                {client.level && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Nível:</span>
                    <Badge variant="outline">{client.level}</Badge>
                  </div>
                )}
                {client.inssStatus && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status INSS:</span>
                    <Badge variant={client.inssStatus === 'active' ? 'default' : 'secondary'}>
                      {client.inssStatus === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags */}
          {client.tags && client.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <Tag className="h-5 w-5 mr-2" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {client.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Descrição */}
          {client.description && (
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <FileText className="h-5 w-5 mr-2" />
                Descrição
              </h3>
              <p className="text-sm text-muted-foreground">
                {client.description}
              </p>
            </div>
          )}

          {/* Informações Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <Calendar className="h-5 w-5 mr-2" />
                Datas Importantes
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span>{formatDate(client.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Atualizado em:</span>
                  <span>{formatDate(client.updatedAt)}</span>
                </div>
              </div>
            </div>

            {(client.referredBy || client.registeredBy) && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Referências</h3>
                <div className="space-y-2 text-sm">
                  {client.referredBy && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Indicado por:</span>
                      <span>{client.referredBy}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cadastrado por:</span>
                    <span>{client.registeredBy || 'Sistema Automático'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* IMPLEMENTAÇÃO: Seção de Documentos do Cliente */}
            <div className="col-span-2">
              <Separator className="my-6" />
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Documentos do Cliente
                </h3>
                {/* COMENTÁRIO IMPLEMENTAÇÃO FUTURA:
                    Esta seção mostrará os arquivos enviados no formulário de cliente.

                    BACKEND IMPLEMENTA��ÃO:
                    - Tabela: client_files
                      * id, client_id, original_name, file_path, file_type, file_size
                      * uploaded_at, uploaded_by
                    - API: GET /api/clients/{id}/files
                    - Storage: AWS S3 ou similar para arquivos

                    FUNCIONALIDADES:
                    - Preview de imagens (PNG, JPEG)
                    - Download de PDFs
                    - Controle de acesso (só quem pode ver)
                    - Logs de acesso aos arquivos
                */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {loadingAttachments && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Carregando documentos...</p>
                    </div>
                  )}
                  {!loadingAttachments && attachments.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum documento anexado</p>
                      <p className="text-sm">Os arquivos enviados no cadastro aparecerão aqui</p>
                    </div>
                  )}
                  {!loadingAttachments && attachments.map((att) => (
                    <div key={att.name} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{att.name}</p>
                          <p className="text-xs text-muted-foreground">{att.size ? `${Math.round(att.size / 1024)} KB` : ''}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex space-x-2">
                        {att.url && (
                          <>
                            <Button asChild size="sm" variant="outline" className="flex-1">
                              <a href={att.url} target="_blank" rel="noreferrer">Visualizar</a>
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => triggerDownload(att.url, att.name)}>
                              Download
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
