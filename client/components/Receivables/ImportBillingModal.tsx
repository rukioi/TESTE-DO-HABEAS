import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Receipt,
  Calculator,
  User,
  Phone,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Import,
} from "lucide-react";
import { Invoice, Estimate, CompanyDetails } from "@/types/billing";
import { useEstimates } from "@/hooks/useEstimates";
import { useInvoices } from "@/hooks/useInvoices";

interface ImportBillingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (importedInvoices: any[]) => void;
}

const emptyCompany: CompanyDetails = {
  name: "",
  document: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "Brasil",
};

interface ImportData {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  parcelas: number;
  valorParcela: number;
  dataInicio: string;
  observacoes: string;
}

export function ImportBillingModal({ open, onOpenChange, onImport }: ImportBillingModalProps) {
  const { estimates: estimatesRaw } = useEstimates();
  const { invoices: invoicesRaw } = useInvoices();

  const mapInvoiceToUIDoc = (i: any): Invoice => {
    const subtotal = Array.isArray(i.items)
      ? i.items.reduce((sum: number, it: any) => sum + (parseFloat(it.amount || (it.rate || 0) * (it.quantity || 0)) || 0), 0)
      : 0;
    const total = typeof i.total === "number" ? i.total : subtotal + (parseFloat(i.tax || 0) || 0);
    return {
      id: i.id,
      type: "invoice",
      number: i.number,
      date: i.created_at || i.date || new Date().toISOString(),
      dueDate: i.due_date || new Date().toISOString(),
      senderId: "1",
      senderName: i.sender_name || "HabeasDesk",
      senderDetails: emptyCompany,
      receiverId: i.client_id || "",
      receiverName: i.client_name || "",
      receiverDetails: {
        ...emptyCompany,
        name: i.client_name || "",
        document: i.client_document || "",
        email: i.client_email || "",
        phone: i.client_phone || "",
      },
      title: i.title || i.description || "",
      description: i.description || "",
      items: Array.isArray(i.items) ? i.items.map((it: any) => ({
        id: it.id || String(Math.random()),
        description: it.description || "",
        quantity: Number(it.quantity ?? 1),
        rate: Number(it.rate ?? it.amount ?? 0),
        amount: Number(it.amount ?? (Number(it.rate ?? 0) * Number(it.quantity ?? 1))),
        tax: Number(it.tax ?? 0),
        taxType: it.taxType || "percentage",
      })) : [],
      subtotal,
      discount: Number(i.discount ?? 0),
      discountType: (i.discountType || "fixed") as any,
      fee: Number(i.fee ?? 0),
      feeType: (i.feeType || "fixed") as any,
      tax: Number(i.tax ?? 0),
      taxType: (i.taxType || "fixed") as any,
      total,
      currency: (i.currency || "BRL"),
      status: (i.status || "PENDING") as any,
      templateId: i.template_id,
      notes: i.notes || "",
      tags: i.tags || [],
      attachments: i.attachments || [],
      createdAt: i.created_at || new Date().toISOString(),
      updatedAt: i.updated_at || new Date().toISOString(),
      createdBy: i.created_by || "",
      lastModifiedBy: i.last_modified_by || "",
      paymentStatus: (i.paymentStatus || "PENDING") as any,
      paymentMethod: i.paymentMethod,
      paymentDate: i.payment_date,
      emailSent: Boolean(i.emailSent),
      emailSentAt: i.email_sent_at,
      remindersSent: Number(i.remindersSent ?? 0),
      lastReminderAt: i.lastReminderAt,
      estimateId: i.estimate_id,
    };
  };

  const mapEstimateToUIDoc = (e: any): Estimate => {
    const subtotal = Array.isArray(e.items)
      ? e.items.reduce((sum: number, it: any) => sum + (parseFloat(it.amount || (it.rate || 0) * (it.quantity || 0)) || 0), 0)
      : 0;
    const total = typeof e.total === "number" ? e.total : subtotal + (parseFloat(e.tax || 0) || 0);
    return {
      id: e.id,
      type: "estimate",
      number: e.number,
      date: e.date || new Date().toISOString(),
      dueDate: e.valid_until || e.date || new Date().toISOString(),
      validUntil: e.valid_until || e.date || new Date().toISOString(),
      senderId: "1",
      senderName: e.sender_name || "HabeasDesk",
      senderDetails: emptyCompany,
      receiverId: e.client_id || "",
      receiverName: e.client_name || "",
      receiverDetails: {
        ...emptyCompany,
        name: e.client_name || "",
        document: e.client_document || "",
        email: e.client_email || "",
        phone: e.client_phone || "",
      },
      title: e.title || e.description || "",
      description: e.description || "",
      items: Array.isArray(e.items) ? e.items.map((it: any) => ({
        id: it.id || String(Math.random()),
        description: it.description || "",
        quantity: Number(it.quantity ?? 1),
        rate: Number(it.rate ?? it.amount ?? 0),
        amount: Number(it.amount ?? (Number(it.rate ?? 0) * Number(it.quantity ?? 1))),
        tax: Number(it.tax ?? 0),
        taxType: it.taxType || "percentage",
      })) : [],
      subtotal,
      discount: Number(e.discount ?? 0),
      discountType: (e.discountType || "fixed") as any,
      fee: Number(e.fee ?? 0),
      feeType: (e.feeType || "fixed") as any,
      tax: Number(e.tax ?? 0),
      taxType: (e.taxType || "fixed") as any,
      total,
      currency: (e.currency || "BRL"),
      status: (e.status || "PENDING") as any,
      templateId: e.template_id,
      notes: e.notes || "",
      tags: e.tags || [],
      attachments: e.attachments || [],
      createdAt: e.created_at || new Date().toISOString(),
      updatedAt: e.updated_at || new Date().toISOString(),
      createdBy: e.created_by || "",
      lastModifiedBy: e.last_modified_by || "",
      convertedToInvoice: Boolean(e.convertedToInvoice),
      invoiceId: e.invoice_id,
    };
  };

  const estimates = useMemo<Estimate[]>(() => (Array.isArray(estimatesRaw) ? estimatesRaw.map(mapEstimateToUIDoc) : []), [ estimatesRaw ]);
  const invoices = useMemo<Invoice[]>(() => (Array.isArray(invoicesRaw) ? invoicesRaw.map(mapInvoiceToUIDoc) : []), [ invoicesRaw ]);
  const billingDocuments: (Invoice | Estimate)[] = useMemo(() => [ ...estimates, ...invoices ], [ estimates, invoices ]);

  const [ selectedDocuments, setSelectedDocuments ] = useState<string[]>([]);
  const [ importData, setImportData ] = useState<Record<string, ImportData>>({});
  const [ step, setStep ] = useState<'selection' | 'configuration'>('selection');

  const handleSelectDocument = (docId: string) => {
    setSelectedDocuments(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [ ...prev, docId ]
    );
  };

  const handleSelectAll = () => {
    const ids = invoices
      .filter(doc => doc.status !== 'PAID')
      .map(doc => doc.id);
    setSelectedDocuments(ids);
  };

  const handleClearAll = () => {
    setSelectedDocuments([]);
  };

  const handleNextStep = () => {
    if (selectedDocuments.length === 0) {
      alert('Selecione pelo menos um documento para importar.');
      return;
    }

    // Inicializar dados de importação para documentos selecionados
    const initialData: Record<string, ImportData> = {};
    selectedDocuments.forEach(docId => {
      const doc = billingDocuments.find(d => d.id === docId);
      if (doc) {
        initialData[ docId ] = {
          clientName: doc.receiverName,
          clientPhone: doc.receiverDetails.phone || '',
          clientEmail: doc.receiverDetails.email,
          parcelas: 1,
          valorParcela: doc.total,
          dataInicio: new Date().toISOString().split('T')[ 0 ],
          observacoes: `Importado de ${doc.number} - ${doc.title}`,
        };
      }
    });

    setImportData(initialData);
    setStep('configuration');
  };

  const handleBackStep = () => {
    setStep('selection');
  };

  const handleImportDataChange = (docId: string, field: keyof ImportData, value: string | number) => {
    setImportData(prev => ({
      ...prev,
      [ docId ]: {
        ...prev[ docId ],
        [ field ]: value,
        // Recalcular valor da parcela quando número de parcelas muda
        ...(field === 'parcelas' && typeof value === 'number' ? {
          valorParcela: Math.round((billingDocuments.find(d => d.id === docId)?.total || 0) / value * 100) / 100
        } : {})
      }
    }));
  };

  const handleConfirmImport = () => {
    const importedInvoices = selectedDocuments.map(docId => {
      const originalDoc = billingDocuments.find(d => d.id === docId);
      const configData = importData[ docId ];

      if (!originalDoc || !configData) return null;

      // Criar faturas para o sistema de recebíveis
      const baseInvoice = {
        id: `imported_${docId}_${Date.now()}`,
        clienteId: originalDoc.receiverId,
        numeroFatura: `REC-${originalDoc.number}`,
        valor: configData.valorParcela,
        descricao: originalDoc.title,
        servicoPrestado: originalDoc.items[ 0 ]?.description || 'Serviços Jurídicos',
        dataEmissao: new Date(),
        dataVencimento: new Date(configData.dataInicio),
        status: 'nova' as const,
        tentativasCobranca: 0,
        recorrente: configData.parcelas > 1,
        intervaloDias: 30,
        criadoPor: originalDoc.createdBy,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
        observacoes: configData.observacoes,
        // Dados do cliente
        clienteNome: configData.clientName,
        clienteEmail: configData.clientEmail,
        clienteTelefone: configData.clientPhone,
        // Dados originais para referência
        documentoOriginal: {
          id: originalDoc.id,
          numero: originalDoc.number,
          tipo: originalDoc.type,
        }
      };

      // Se tem múltiplas parcelas, criar array de faturas
      if (configData.parcelas > 1) {
        const faturas = [];
        for (let i = 0; i < configData.parcelas; i++) {
          const dataVencimento = new Date(configData.dataInicio);
          dataVencimento.setMonth(dataVencimento.getMonth() + i);

          faturas.push({
            ...baseInvoice,
            id: `${baseInvoice.id}_parcela_${i + 1}`,
            numeroFatura: `${baseInvoice.numeroFatura}-${i + 1}/${configData.parcelas}`,
            dataVencimento,
            descricao: `${originalDoc.title} - Parcela ${i + 1}/${configData.parcelas}`,
            parcela: {
              numero: i + 1,
              total: configData.parcelas,
            }
          });
        }
        return faturas;
      }

      return baseInvoice;
    }).filter(Boolean).flat();

    onImport(importedInvoices);
    onOpenChange(false);

    // Reset state
    setSelectedDocuments([]);
    setImportData({});
    setStep('selection');
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      DRAFT: { label: "Rascunho", className: "bg-gray-100 text-gray-800" },
      SENT: { label: "Enviado", className: "bg-blue-100 text-blue-800" },
      PENDING: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
      PAID: { label: "Pago", className: "bg-green-100 text-green-800" },
      OVERDUE: { label: "Vencido", className: "bg-red-100 text-red-800" },
    };
    return configs[ status as keyof typeof configs ] || configs.PENDING;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const availableDocuments = invoices.filter(doc => doc.status !== 'PAID');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Import className="h-5 w-5 text-primary" />
            <span>
              {step === 'selection' ? 'Importar Documentos de Cobrança' : 'Configurar Importação'}
            </span>
          </DialogTitle>
        </DialogHeader>

        {step === 'selection' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Selecione os documentos de cobrança que deseja importar para o sistema de recebíveis.
              </p>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Selecionar Todos
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  Limpar Seleção
                </Button>
              </div>
            </div>

            <ScrollArea className="h-96 w-full border rounded-lg">
              <div className="p-4 space-y-3">
                {availableDocuments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhum documento encontrado para importação.
                  </div>
                ) : availableDocuments.map((doc) => {
                  const isSelected = selectedDocuments.includes(doc.id);
                  const statusConfig = getStatusBadge(doc.status);

                  return (
                    <div
                      key={doc.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                      onClick={() => handleSelectDocument(doc.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => { }} // Controlled by parent click
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {doc.type === 'invoice' ? (
                                <Receipt className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Calculator className="h-4 w-4 text-green-600" />
                              )}
                              <span className="font-semibold">{doc.number}</span>
                              <Badge className={statusConfig.className}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <span className="font-bold text-green-600">
                              {formatCurrency(doc.total)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <p className="font-medium">{doc.title}</p>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <User className="h-3 w-3" />
                                <span>{doc.receiverName}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>Vence: {new Date(doc.dueDate).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedDocuments.length} documento(s) selecionado(s)
              </p>
              <Button
                onClick={handleNextStep}
                disabled={selectedDocuments.length === 0}
              >
                Próximo: Configurar
              </Button>
            </div>
          </div>
        )}

        {step === 'configuration' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Configure os dados para importação no sistema de recebíveis.
              </p>
              <Button variant="outline" size="sm" onClick={handleBackStep}>
                Voltar
              </Button>
            </div>

            <ScrollArea className="h-96 w-full">
              <div className="space-y-6">
                {selectedDocuments.map((docId) => {
                  const doc = billingDocuments.find(d => d.id === docId);
                  const data = importData[ docId ];

                  if (!doc || !data) return null;

                  return (
                    <div key={docId} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Receipt className="h-4 w-4 text-blue-600" />
                        <span className="font-semibold">{doc.number}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="text-sm">{doc.title}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`cliente-${docId}`}>
                            <User className="h-4 w-4 inline mr-1" />
                            Nome do Cliente *
                          </Label>
                          <Input
                            id={`cliente-${docId}`}
                            value={data.clientName}
                            onChange={(e) => handleImportDataChange(docId, 'clientName', e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`telefone-${docId}`}>
                            <Phone className="h-4 w-4 inline mr-1" />
                            Telefone/WhatsApp *
                          </Label>
                          <Input
                            id={`telefone-${docId}`}
                            value={data.clientPhone}
                            onChange={(e) => handleImportDataChange(docId, 'clientPhone', e.target.value)}
                            placeholder="(11) 99999-9999"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`parcelas-${docId}`}>
                            <DollarSign className="h-4 w-4 inline mr-1" />
                            Quantidade de Parcelas
                          </Label>
                          <Select
                            value={data.parcelas.toString()}
                            onValueChange={(value) => handleImportDataChange(docId, 'parcelas', parseInt(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ].map(num => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num}x de {formatCurrency(doc.total / num)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`inicio-${docId}`}>
                            <Calendar className="h-4 w-4 inline mr-1" />
                            Data de Início
                          </Label>
                          <Input
                            id={`inicio-${docId}`}
                            type="date"
                            value={data.dataInicio}
                            onChange={(e) => handleImportDataChange(docId, 'dataInicio', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                        <h5 className="font-semibold text-sm text-primary">Configuração de Dados de Cobrança</h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Valor Total:</span>
                            <div className="font-bold text-green-600">{formatCurrency(doc.total)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valor por Parcela:</span>
                            <div className="font-bold text-blue-600">{formatCurrency(data.valorParcela)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Intervalo de Cobrança:</span>
                            <div className="font-semibold text-orange-600">30 Dias</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Data Final do Pagamento:</span>
                            <div className="font-semibold text-purple-600">
                              {(() => {
                                const dataFinal = new Date(data.dataInicio);
                                dataFinal.setMonth(dataFinal.getMonth() + (data.parcelas - 1));
                                return dataFinal.toLocaleDateString('pt-BR');
                              })()}
                            </div>
                          </div>
                        </div>
                        {data.parcelas > 1 ? (
                          <div className="pt-3 border-t bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-blue-600 font-medium">📋 Cronograma de Cobrança</span>
                            </div>
                            <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                              <p>• <strong>Intervalo:</strong> Cobrança automática a cada 30 dias</p>
                              <p>• <strong>Período total:</strong> {data.parcelas} parcelas de {formatCurrency(data.valorParcela)}</p>
                              <p>• <strong>Término:</strong> {(() => {
                                const dataFinal = new Date(data.dataInicio);
                                dataFinal.setMonth(dataFinal.getMonth() + (data.parcelas - 1));
                                return dataFinal.toLocaleDateString('pt-BR');
                              })()}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-3 border-t bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                            <div className="text-xs text-green-800 dark:text-green-200">
                              <p><strong>Pagamento à vista:</strong> Vencimento único em {new Date(data.dataInicio).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <Separator />

            <div className="flex justify-between">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>Verifique todos os dados antes de confirmar a importação</span>
              </div>
              <Button onClick={handleConfirmImport} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Importação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
