import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Upload, Loader2, ChevronDown, MapPin, Scale, Info } from 'lucide-react';
import { Client } from '@/types/crm';
import { apiService } from '@/services/apiService';
import { useAuth } from '../../hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { DatePickerBR } from '@/components/ui/date-picker-br';

// Schema atualizado: Cidade e Estado não são mais obrigatórios
const clientSchema = z.object({
  name: z.string({ required_error: 'Nome é obrigatório' }).min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  mobile: z.string({ required_error: 'Telefone é obrigatório' }).min(1, 'Telefone é obrigatório'),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  budget: z.number().min(0, 'Orçamento deve ser positivo').optional(),
  // Endereço - Cidade e Estado são opcionais
  zipCode: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  // Informações Jurídicas
  pis: z.string().optional(),
  cei: z.string().optional(),
  professionalTitle: z.string().optional(),
  maritalStatus: z.string().optional(),
  inssStatus: z.string().optional(),
  // Informações Adicionais
  description: z.string().optional(),
  amountPaid: z.number().optional(),
  referredBy: z.string().optional(),
  registeredBy: z.string().optional(),
  currency: z.enum(['BRL', 'USD', 'EUR'], { required_error: 'Moeda é obrigatória' }),
  // Campos mantidos para compatibilidade com banco
  country: z.string().optional(),
  organization: z.string().optional(),
  level: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  onSubmit: (data: ClientFormData & { tags?: string[]; attachments?: File[]; removeAttachments?: string[] }) => Promise<void>;
  isEditing?: boolean;
  existingTags?: string[]; // Tags existentes de outros clientes
}

const maritalStatuses = [
  { value: 'single', label: 'Solteiro(a)' },
  { value: 'married', label: 'Casado(a)' },
  { value: 'divorced', label: 'Divorciado(a)' },
  { value: 'widowed', label: 'Viúvo(a)' },
];

const inssStatuses = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'retired', label: 'Aposentado' },
  { value: 'pensioner', label: 'Pensionista' },
];

export function ClientForm({ open, onOpenChange, client, onSubmit, isEditing = false, existingTags = [] }: ClientFormProps) {
  const [tags, setTags] = React.useState<string[]>(client?.tags || []);
  const [newTag, setNewTag] = React.useState('');
  const [selectedExistingTag, setSelectedExistingTag] = React.useState('');
  const { user } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  
  // Estados para controlar expansão das seções
  const [isDadosEssenciaisOpen, setIsDadosEssenciaisOpen] = React.useState(true);
  const [isEnderecoOpen, setIsEnderecoOpen] = React.useState(false);
  const [isInformacoesJuridicasOpen, setIsInformacoesJuridicasOpen] = React.useState(false);
  const [isInformacoesAdicionaisOpen, setIsInformacoesAdicionaisOpen] = React.useState(false);

  // Upload de arquivos
  const [clientFiles, setClientFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const MAX_FILES_BY_PLAN = 3;
  const [existingAttachments, setExistingAttachments] = React.useState<Array<{ name: string; url?: string }>>([]);
  const [attachmentsToRemove, setAttachmentsToRemove] = React.useState<string[]>([]);
  const [loadingExistingAttachments, setLoadingExistingAttachments] = React.useState(false);
  const [loadingCEP, setLoadingCEP] = React.useState(false);

  // Atualizar tags quando client mudar
  React.useEffect(() => {
    setTags(client?.tags || []);
    setSelectedExistingTag('');
  }, [client]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!open || !isEditing || !client?.id) return;
      try {
        setLoadingExistingAttachments(true);
        const res = await apiService.getClientAttachments(client.id);
        if (!mounted) return;
        setExistingAttachments(res.attachments || []);
      } catch {
        if (!mounted) return;
        setExistingAttachments([]);
      } finally {
        if (!mounted) return;
        setLoadingExistingAttachments(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, isEditing, client?.id]);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name || '',
      email: client?.email || '',
      mobile: client?.phone || '',
      cpf: client?.cpf || '',
      rg: client?.rg || '',
      birthDate: client?.birthDate || '',
      budget: Number(client?.budget) || 0,
      zipCode: client?.zipCode || '',
      state: client?.state || '',
      city: client?.city || '',
      address: client?.address || '',
      pis: client?.pis || '',
      cei: client?.cei || '',
      professionalTitle: client?.professionalTitle || '',
      maritalStatus: client?.maritalStatus || '',
      inssStatus: client?.inssStatus || '',
      description: client?.description || '',
      amountPaid: Number(client?.amountPaid) || 0,
      referredBy: client?.referredBy || '',
      registeredBy: client?.registeredBy || user?.name || '',
      currency: client?.currency || 'BRL',
      country: client?.country || 'BR',
      organization: client?.organization || '',
      level: client?.level || '',
    },
  });

  // Atualizar formulário quando client mudar
  React.useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || '',
        email: client.email || '',
        mobile: client.phone || '',
        cpf: client.cpf || '',
        rg: client.rg || '',
        birthDate: client.birthDate || '',
        budget: Number(client?.budget) || 0,
        zipCode: client.zipCode || '',
        state: client.state || '',
        city: client.city || '',
        address: client.address || '',
        pis: client.pis || '',
        cei: client.cei || '',
        professionalTitle: client.professionalTitle || '',
        maritalStatus: client.maritalStatus || '',
        inssStatus: client.inssStatus || '',
        description: client.description || '',
        amountPaid: Number(client?.amountPaid) || 0,
        referredBy: client.referredBy || '',
        registeredBy: client.registeredBy || user?.name || '',
        currency: client.currency || 'BRL',
        country: client.country || 'BR',
        organization: client.organization || '',
        level: client.level || '',
      });
    } else {
      form.reset({
        name: '',
        email: '',
        mobile: '',
        cpf: '',
        rg: '',
        birthDate: '',
        budget: 0,
        zipCode: '',
        state: '',
        city: '',
        address: '',
        pis: '',
        cei: '',
        professionalTitle: '',
        maritalStatus: '',
        inssStatus: '',
        description: '',
        amountPaid: 0,
        referredBy: '',
        registeredBy: user?.name || '',
        currency: 'BRL',
        country: 'BR',
        organization: '',
        level: '',
      });
    }
  }, [client, form, user]);

  const handleSubmit = async (data: ClientFormData) => {
    setSaving(true);
    setGeneralError(null);
    try {
      await onSubmit({ ...data, tags, attachments: clientFiles, removeAttachments: attachmentsToRemove });
      onOpenChange(false);
      form.reset();
      setTags([]);
      setClientFiles([]);
      setAttachmentsToRemove([]);
      setSelectedExistingTag('');
    } catch (error) {
      setGeneralError('Falha ao salvar cliente. Verifique os campos obrigatórios e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleInvalid = () => {
    setGeneralError('Corrija os campos obrigatórios destacados.');
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const addExistingTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
      setSelectedExistingTag('');
    }
  };

  // Gerenciamento de arquivos
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (clientFiles.length + files.length > MAX_FILES_BY_PLAN) {
      setFileError(`Limite excedido. Seu plano permite até ${MAX_FILES_BY_PLAN} arquivos por cliente.`);
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      setFileError('Apenas arquivos PNG, JPEG e PDF são permitidos.');
      return;
    }

    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setFileError('Arquivos devem ter no máximo 10MB.');
      return;
    }

    setClientFiles([...clientFiles, ...files]);
    setFileError(null);
  };

  const removeFile = (index: number) => {
    setClientFiles(clientFiles.filter((_, i) => i !== index));
    setFileError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Função para buscar CEP na API BrasilAPI
  const fetchCEP = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    
    if (cleanCEP.length !== 8) {
      return;
    }

    setLoadingCEP(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCEP}`);
      
      if (!response.ok) {
        throw new Error('CEP não encontrado');
      }

      const data = await response.json();
      
      // Preenche os campos automaticamente
      if (data.city) {
        form.setValue('city', data.city, { shouldValidate: true });
      }
      
      if (data.state) {
        form.setValue('state', data.state, { shouldValidate: true });
      }
      
      // Preenche o endereço com neighborhood e street
      if (data.neighborhood || data.street) {
        const addressParts = [];
        if (data.neighborhood) {
          addressParts.push(data.neighborhood);
        }
        if (data.street) {
          addressParts.push(data.street);
        }
        form.setValue('address', addressParts.join(', '), { shouldValidate: true });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setLoadingCEP(false);
    }
  };

  // Handler para o campo CEP
  const handleCEPChange = (value: string) => {
    const cleanCEP = value.replace(/\D/g, '');
    let formattedCEP = cleanCEP;
    if (cleanCEP.length > 5) {
      formattedCEP = cleanCEP.slice(0, 5) + '-' + cleanCEP.slice(5, 8);
    }
    return formattedCEP;
  };

  // Handler para quando o CEP perder o foco (onBlur)
  const handleCEPBlur = async (value: string) => {
    const cleanCEP = value.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      await fetchCEP(cleanCEP);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" disableClose={saving}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Cliente' : 'Adicionar Cliente'}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados essenciais e informações adicionais do cliente
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, handleInvalid)} className="space-y-6">
            {generalError && (
              <Alert variant="destructive">
                <AlertDescription>{generalError}</AlertDescription>
              </Alert>
            )}

            <Card className="w-full">
              <CardContent className="space-y-6 pt-6">
                {/* SEÇÃO 1: Dados Essenciais */}
                <Collapsible open={isDadosEssenciaisOpen} onOpenChange={setIsDadosEssenciaisOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background hover:bg-muted/30 transition-all duration-150",
                        "hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">Dados Essenciais</h3>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          isDadosEssenciaisOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-6 pt-4">
                    {/* Informações básicas do paciente */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Informações básicas do paciente
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nome - Ocupa 2 colunas */}
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Nome Completo *</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome completo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Telefone - Ocupa 2 colunas */}
                        <FormField
                          control={form.control}
                          name="mobile"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Telefone *</FormLabel>
                              <FormControl>
                                <Input placeholder="(11) 99999-9999" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* CPF e Email lado a lado */}
                        <FormField
                          control={form.control}
                          name="cpf"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPF</FormLabel>
                              <FormControl>
                                <Input placeholder="000.000.000-00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="email@exemplo.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* RG e Data de Nascimento lado a lado */}
                        <FormField
                          control={form.control}
                          name="rg"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>RG</FormLabel>
                              <FormControl>
                                <Input placeholder="00.000.000-0" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="birthDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de Nascimento</FormLabel>
                              <FormControl>
                                <DatePickerBR
                                  value={field.value || undefined}
                                  onChange={(date) => field.onChange(date)}
                                  placeholder="Selecione a data de nascimento"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Orçamento - Ocupa 1 coluna */}
                        <FormField
                          control={form.control}
                          name="budget"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Orçamento</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Documentos - Ocupa 2 colunas */}
                        <div className="md:col-span-2">
                          <FormLabel>Documentos do Cliente</FormLabel>
                          <div className="border-2 border-dashed border-muted rounded-lg p-6 mt-2">
                            <div className="flex flex-col items-center space-y-4">
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground">
                                  Faça upload de documentos do cliente (PNG, JPEG, PDF)
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Máximo: {MAX_FILES_BY_PLAN} arquivos • Até 10MB por arquivo
                                </p>
                              </div>

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => document.getElementById('client-file-upload')?.click()}
                                disabled={clientFiles.length >= MAX_FILES_BY_PLAN}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Adicionar Arquivos
                              </Button>

                              <input
                                id="client-file-upload"
                                type="file"
                                multiple
                                accept=".png,.jpg,.jpeg,.pdf"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                            </div>

                            {fileError && (
                              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <p className="text-sm text-destructive">{fileError}</p>
                              </div>
                            )}

                            {clientFiles.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <h4 className="text-sm font-medium">Arquivos Selecionados:</h4>
                                {clientFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                                        {file.type.includes('pdf') ? '📄' : '🖼️'}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeFile(index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {isEditing && (
                              <div className="mt-4 space-y-2">
                                <h4 className="text-sm font-medium">Documentos Existentes:</h4>
                                {loadingExistingAttachments && (
                                  <div className="text-xs text-muted-foreground">Carregando documentos...</div>
                                )}
                                {!loadingExistingAttachments && existingAttachments.length === 0 && (
                                  <div className="text-xs text-muted-foreground">Nenhum documento existente</div>
                                )}
                                {!loadingExistingAttachments && existingAttachments.map((att) => (
                                  <div key={att.name} className="flex items-center justify-between p-2 bg-muted rounded">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">📄</div>
                                      <div>
                                        <p className="text-sm font-medium">{att.name}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {att.url && (
                                        <Button asChild variant="ghost" size="sm">
                                          <a href={att.url} target="_blank" rel="noreferrer">Abrir</a>
                                        </Button>
                                      )}
                                      <Button
                                        type="button"
                                        variant={attachmentsToRemove.includes(att.name) ? 'destructive' : 'outline'}
                                        size="sm"
                                        onClick={() => {
                                          setAttachmentsToRemove(prev => prev.includes(att.name) ? prev.filter(n => n !== att.name) : [...prev, att.name]);
                                        }}
                                      >
                                        {attachmentsToRemove.includes(att.name) ? 'Desmarcar' : 'Remover'}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* SEÇÃO 2: Endereço */}
                <Collapsible open={isEnderecoOpen} onOpenChange={setIsEnderecoOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background hover:bg-muted/30 transition-all duration-150",
                        "hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">Endereço</h3>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          isEnderecoOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                        {/* CEP primeiro */}
                        <FormField
                          control={form.control}
                          name="zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    placeholder="00000-000"
                                    {...field}
                                    onChange={(e) => {
                                      const formatted = handleCEPChange(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                    onBlur={(e) => {
                                      field.onBlur();
                                      handleCEPBlur(e.target.value);
                                    }}
                                    maxLength={9}
                                  />
                                  {loadingCEP && (
                                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Estado e Cidade lado a lado */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estado</FormLabel>
                                <FormControl>
                                  <Input placeholder="Estado" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cidade</FormLabel>
                                <FormControl>
                                  <Input placeholder="Cidade" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Endereço completo */}
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endereço</FormLabel>
                              <FormControl>
                                <Input placeholder="Rua, número, bairro" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                  </CollapsibleContent>
                </Collapsible>

                {/* SEÇÃO 3: Informações Jurídicas */}
                <Collapsible open={isInformacoesJuridicasOpen} onOpenChange={setIsInformacoesJuridicasOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background hover:bg-muted/30 transition-all duration-150",
                        "hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">Informações Jurídicas</h3>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          isInformacoesJuridicasOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="pis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PIS</FormLabel>
                            <FormControl>
                              <Input placeholder="000.00000.00-0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cei"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEI</FormLabel>
                            <FormControl>
                              <Input placeholder="00.000.00000/00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="professionalTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título Profissional</FormLabel>
                            <FormControl>
                              <Input placeholder="Advogado, Aposentado, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maritalStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado Civil</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o estado civil" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {maritalStatuses.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="inssStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status INSS</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o status INSS" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {inssStatuses.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* SEÇÃO 4: Informações Adicionais */}
                <Collapsible open={isInformacoesAdicionaisOpen} onOpenChange={setIsInformacoesAdicionaisOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between py-2 px-3 rounded-md border border-border/50 bg-background hover:bg-muted/30 transition-all duration-150",
                        "hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">Informações Adicionais</h3>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          isInformacoesAdicionaisOpen && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    {/* Descrição */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Informações adicionais sobre o cliente" {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Valor Pago */}
                  <FormField
                    control={form.control}
                    name="amountPaid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Pago</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tags */}
                  <div className="space-y-3">
                    <FormLabel>Tags</FormLabel>
                    {/* Dropdown com tags já existentes no sistema */}
                    {existingTags.length > 0 && (
                      <div>
                        <label className="text-sm text-muted-foreground">Selecionar de tags existentes:</label>
                        <Select value={selectedExistingTag} onValueChange={addExistingTag}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolher tag existente" />
                          </SelectTrigger>
                          <SelectContent>
                            {existingTags
                              .filter(tag => !tags.includes(tag))
                              .map((tag) => (
                                <SelectItem key={tag} value={tag}>
                                  {tag}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Input para criar nova tag */}
                    <div>
                      <label className="text-sm text-muted-foreground">Ou criar nova tag:</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Digite nova tag"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        />
                        <Button type="button" onClick={addTag}>
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    {/* Tags selecionadas */}
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Colaborador e Indicado Por lado a lado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="registeredBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Colaborador que Cadastrou</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do colaborador" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="referredBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Indicado Por</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do indicador" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Moeda */}
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moeda</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || 'BRL'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a moeda" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BRL">Real (R$)</SelectItem>
                            <SelectItem value="USD">Dólar (US$)</SelectItem>
                            <SelectItem value="EUR">Euro (€)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </CollapsibleContent>
                </Collapsible>

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-4 border-t">
                  <Button type="button" variant="outline" disabled={saving} onClick={() => {
                    try {
                      setTimeout(() => {
                        onOpenChange(false);
                      }, 0);
                    } catch (error) {
                      console.error('Erro ao cancelar:', error);
                      onOpenChange(false);
                    }
                  }}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {saving ? (isEditing ? 'Salvando...' : 'Adicionando...') : (isEditing ? 'Atualizar Cliente' : 'Salvar Cliente')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
