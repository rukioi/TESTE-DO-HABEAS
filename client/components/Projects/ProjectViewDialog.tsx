import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  FolderKanban,
  DollarSign,
  Calendar,
  Edit,
  Users,
  Tag,
  FileText,
  AlertTriangle,
  Clock,
  User,
  Building,
  Mail,
  Phone,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { apiService } from '@/services/apiService';

interface ProjectViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onEdit?: (project: Project) => void;
}

export function ProjectViewDialog({
  open,
  onOpenChange,
  project,
  onEdit
}: ProjectViewDialogProps) {
  if (!project) return null;
  const [ attachments, setAttachments ] = useState<Array<{ name: string; url?: string; size?: number }>>([]);
  const [ loadingAttachments, setLoadingAttachments ] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!open || !project?.id) return;
      try {
        setLoadingAttachments(true);
        const res = await apiService.getProjectAttachments(project.id as any);
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
  }, [ open, project?.id ]);

  const formatCurrency = (value: number, currency: string) => {
    const formatters = {
      BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
      USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
      EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    };
    return formatters[ currency as keyof typeof formatters ]?.format(value) || `${currency} ${value}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Não informada';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Data inválida';
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Data inválida';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = [ 'Bytes', 'KB', 'MB', 'GB' ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[ i ];
  };

  const getStatusLabel = (status: string) => {
    const statusMap = {
      planejamento: 'Planejamento',
      andamento: 'Em Andamento',
      revisao: 'Em Revisão',
      aguardando_cliente: 'Aguardando Cliente',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
      arquivado: 'Arquivado',
    };
    return statusMap[ status as keyof typeof statusMap ] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      planejamento: 'bg-blue-100 text-blue-800',
      andamento: 'bg-yellow-100 text-yellow-800',
      revisao: 'bg-purple-100 text-purple-800',
      aguardando_cliente: 'bg-orange-100 text-orange-800',
      concluido: 'bg-green-100 text-green-800',
      cancelado: 'bg-red-100 text-red-800',
      arquivado: 'bg-gray-100 text-gray-800',
    };
    return colors[ status as keyof typeof colors ] || 'bg-gray-100 text-gray-800';
  };

  const normalizePriority = (p: string) => (p === 'urgent' ? 'high' : p);

  const getPriorityLabel = (priority: string) => {
    const p = normalizePriority(priority);
    const priorityMap = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
    };
    return priorityMap[ p as keyof typeof priorityMap ] || p;
  };

  const getPriorityColor = (priority: string) => {
    const p = normalizePriority(priority);
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-red-900 text-red-100',
    };
    return colors[ p as keyof typeof colors ] || 'bg-gray-100 text-gray-800';
  };

  const isOverdue = new Date(project.due_date) < new Date() &&
    ![ 'concluido', 'cancelado', 'arquivado' ].includes(project.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FolderKanban className="h-8 w-8 text-blue-600" />
              <div>
                <DialogTitle className="text-xl">{project.title}</DialogTitle>
                <DialogDescription className="space-y-2">
                  <span className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>{project.client_name}</span>
                    {project.organization && (
                      <>
                        <span>•</span>
                        <Building className="h-4 w-4" />
                        <span>{project.organization}</span>
                      </>
                    )}
                  </span>
                  {/* IMPLEMENTAÇÃO: Mostrar colaborador que criou o projeto */}
                  {project.created_by && (
                    <span className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                      Criado por: {project.created_by}
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(project.status)}>
                {getStatusLabel(project.status)}
              </Badge>
              <Badge className={getPriorityColor(project.priority)}>
                {getPriorityLabel(project.priority)}
              </Badge>
              {isOverdue && (
                <Badge className="bg-red-100 text-red-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Atrasado
                </Badge>
              )}
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(project)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progresso */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso do Projeto</span>
              <span className="text-sm text-muted-foreground">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" />
          </div>

          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Cronograma
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Data de Início:</span>
                  <span>{formatDate(project.start_date)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                    {formatDate(project.due_date)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Criado em:</span>
                  <span>{formatDate(project.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Atualizado em:</span>
                  <span>{formatDate(project.updated_at)}</span>
                </div>
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
                    {formatCurrency(project.budget, project.currency)}
                  </span>
                </div>
                {project.address && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Endereço:</span>
                    <span className="text-right flex-1 ml-2">{project.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Equipe Atribuída */}
          {project.assigned_to && Array.isArray(project.assigned_to) && project.assigned_to.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <Users className="h-5 w-5 mr-2" />
                Equipe Atribuída
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.assigned_to.map((member) => (
                  <Badge key={member} variant="outline">
                    {member}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Contatos */}
          {project.contacts && Array.isArray(project.contacts) && project.contacts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <User className="h-5 w-5 mr-2" />
                Contatos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.contacts.map((contact) => (
                  <div key={contact.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{contact.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {contact.role}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{contact.email}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{contact.phone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.tags && Array.isArray(project.tags) && project.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <Tag className="h-5 w-5 mr-2" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Descrição */}
          {project.description && (
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <FileText className="h-5 w-5 mr-2" />
                Descrição
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {project.description}
              </p>
            </div>
          )}

          {/* Notas */}
          {project.notes && (
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-3">
                <FileText className="h-5 w-5 mr-2" />
                Observações
              </h3>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm">{project.notes}</p>
              </div>
            </div>
          )}

          {/* Anexos */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Documentos do Projeto
            </h3>
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
                    </div>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    {att.url && (
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <a href={att.url} target="_blank" rel="noreferrer">Abrir</a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* IMPLEMENTAÇÃO MELHORADA: Seção de Documentos do Projeto - só aparece quando há documentos */}
          {(project.files && Array.isArray(project.files) && project.files.length > 0) && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Documentos do Projeto
                  {/* ({project.files.length}) */}
                </h3>
                {/* COMENTÁRIO IMPLEMENTAÇÃO:
                    Esta seção só é visível quando há documentos anexados ao projeto.

                    ESTRUTURA DO BACKEND:
                    - project.files: Array de objetos com { id, name, type, size, url, uploadedAt, uploadedBy }
                    - API: GET /api/projects/{id}/files
                    - Storage: AWS S3 ou pasta local para arquivos

                    FUNCIONALIDADES:
                    - Preview inline para imagens
                    - Download direto para PDFs
                    - Histórico de uploads
                    - Controle de permissões de acesso
                */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.files.map((file, index) => (
                    <div key={file.id || index} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${file.type?.includes('pdf') ? 'bg-red-100' :
                          file.type?.includes('image') ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                          <FileText className={`h-5 w-5 ${file.type?.includes('pdf') ? 'text-red-600' :
                            file.type?.includes('image') ? 'text-blue-600' : 'text-gray-600'
                            }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.size && formatFileSize(file.size)} • {file.type?.split('/')[ 1 ]?.toUpperCase() || 'Arquivo'}
                          </p>
                          {file.uploadedAt && (
                            <p className="text-xs text-muted-foreground">
                              Enviado: {formatDate(file.uploadedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex space-x-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          {file.type?.includes('image') ? 'Preview' : 'Visualizar'}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
