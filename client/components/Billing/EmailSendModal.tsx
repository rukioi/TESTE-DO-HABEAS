import React, { useState } from "react";
import {
  createSafeOnOpenChange,
  createSafeDialogHandler,
} from "@/lib/dialog-fix";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Send,
  Eye,
  X,
  Globe,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { apiService } from "@/services/apiService";

interface EmailSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: any[];
  onSendEmail: (data: any) => Promise<void>;
}

export function EmailSendModal({
  open,
  onOpenChange,
  documents,
  onSendEmail,
}: EmailSendModalProps) {
  console.log("🚀 ~ EmailSendModal ~ documents:", documents)
  // Create safe onOpenChange handler
  const safeOnOpenChange = createSafeOnOpenChange(onOpenChange);
  const [ emailData, setEmailData ] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    fromName: "HabeasDesk",
    fromEmail: "habeasdesk@optgrupo.com",
    replyTo: "habeasdesk@optgrupo.com",
    attachPdf: true,
    customMessage: "",
    attachedFiles: [],
  });

  const [ sending, setSending ] = useState(false);
  const [ showPreview, setShowPreview ] = useState(false);
  const [ activeDoc, setActiveDoc ] = useState<string | null>(null);
  const [ perDocData, setPerDocData ] = useState<Record<string, { to: string; subject: string; customMessage: string }>>({});
  const [ paymentLinks, setPaymentLinks ] = useState<Record<string, string>>({});
  const [ generatingLink, setGeneratingLink ] = useState(false);

  // Get template content based on document type
  const getTemplateContent = (document: any, customMessageOverride?: string) => {
    if (!document || !document.type) {
      return "<p>No document available for preview</p>";
    }

    const isInvoice = document.type === "invoice";
    const company = document.senderDetails || {};
    const companyEmail = company.email || emailData.fromEmail;
    const companyPhone = company.phone || "";
    const companyName = company.name || emailData.fromName;
    const companyAddress = [ company.address, company.city, company.state, company.zipCode ].filter(Boolean).join(" • ");
    const pixKey = companyEmail;
    const customMsg = typeof customMessageOverride === "string" ? customMessageOverride : emailData.customMessage;

    const payLink = paymentLinks[ document.id ] || document.linkPagamento;
    const payCta = payLink
      ? `<div style="text-align:center;margin:20px 0;">
            <a href="${payLink}" target="_blank" style="display:inline-block;padding:12px 16px;background:#0f766e;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700">Pagar agora</a>
         </div>
         <div style="text-align:center;font-size:12px;"><a href="${payLink}" target="_blank">${payLink}</a></div>`
      : "";
    const baseTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isInvoice ? "Fatura" : "Orçamento"} - ${document.number}</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 640px; margin: 0 auto; padding: 0; background: #ffffff; }
      .header { background: ${isInvoice ? "#0f766e" : "#1f2937"}; color: #ffffff; padding: 24px; text-align: left; border-radius: 10px 10px 0 0; }
      .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
      .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
      .content { background: #f9fafb; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
      .footer { background: #374151; color: #ffffff; padding: 16px 24px; border-radius: 0 0 10px 10px; font-size: 12px; }
      .footer-row { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; }
      .footer-col { display: flex; gap: 8px; align-items: center; }
      .footer strong { font-weight: 600; }
      .amount { font-size: 22px; font-weight: 700; color: ${isInvoice ? "#dc2626" : "#059669"}; }
      .table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      .table th, .table td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; font-size: 12px; }
      .table th { background: #f3f4f6; }
      .alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin: 16px 0; font-size: 12px; }
      .meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #4b5563; margin-bottom: 12px; }
    </style>
</head>
<body>
    <div class="header">
      <h1>${isInvoice ? "Fatura" : "Orçamento"} • ${document.number}</h1>
      <p>${companyName}${companyAddress ? " • " + companyAddress : ""}</p>
    </div>
    
    <div class="content">
        <div class="meta">
          <div>Documento: ${document.date ? new Date(document.date).toLocaleDateString("pt-BR") : "N/A"}</div>
          ${isInvoice && document.dueDate ? `<div>Vencimento: ${new Date(document.dueDate).toLocaleDateString("pt-BR")}</div>` : ""}
          ${!isInvoice && (document.validUntil || document.dueDate) ? `<div>Validade: ${new Date(document.validUntil || document.dueDate).toLocaleDateString("pt-BR")}</div>` : ""}
        </div>
        <p>Prezado(a) <strong>${document.receiverName || document.clientName || "Cliente"}</strong>,</p>

        <p>${isInvoice ? "Segue fatura referente aos serviços prestados:" : "Segue em anexo o orçamento solicitado para os serviços jurídicos:"}</p>

        <table class="table">
            <tr>
                <th>Empresa:</th>
                <td>${document.senderName || emailData.fromName || "HabeasDesk"}</td>
            </tr>
            <tr>
                <th>${isInvoice ? "Data de Emissão:" : "Data:"}</th>
                <td>${document.date ? new Date(document.date).toLocaleDateString("pt-BR") : "N/A"}</td>
            </tr>
            ${isInvoice
        ? `
            <tr>
                <th>Vencimento:</th>
                <td><strong>${document.dueDate ? new Date(document.dueDate).toLocaleDateString("pt-BR") : "N/A"}</strong></td>
            </tr>
            `
        : `
            <tr>
                <th>Validade:</th>
                <td>${document.validUntil || document.dueDate ? new Date(document.validUntil || document.dueDate).toLocaleDateString("pt-BR") : "N/A"}</td>
            </tr>
            `
      }
            <tr>
                <th>Cliente:</th>
                <td>${document.receiverName || document.clientName || "Cliente"}</td>
            </tr>
        </table>
        
        <h3>Descrição dos Serviços:</h3>
        <div>${document.description || "Serviços jurídicos especializados"}</div>
        
        <div style="text-align: center; margin: 30px 0;">
            <div class="amount">Valor Total: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(document.total)}</div>
        </div>
        ${payCta}
        
        ${customMsg
        ? `
        <div class="alert">
            <strong>📝 Mensagem:</strong><br>
            ${customMsg.replace(/\n/g, "<br>")}
        </div>
        `
        : ""
      }
        
        <p>${isInvoice
        ? (payLink ? "Para efetuar o pagamento, utilize o botão acima ou o link. Caso prefira, entre em contato conosco." : "Para efetuar o pagamento, utilize os dados bancários em anexo ou entre em contato conosco.")
        : "Para aceitar este orçamento, entre em contato conosco através dos canais abaixo."}</p>
        
        <p>Atenciosamente,<br>
        <strong>${emailData.fromName}</strong></p>
    </div>
    
    <div class="footer">
      <div class="footer-row">
        <div class="footer-col"><span>📧</span><span>${companyEmail}</span></div>
        ${companyPhone ? `<div class="footer-col"><span>📞</span><span>${companyPhone}</span></div>` : ""}
        ${pixKey ? `<div class="footer-col"><strong>PIX:</strong><span>${pixKey}</span></div>` : ""}
      </div>
    </div>
</body>
</html>`;

    return baseTemplate;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // remove prefix "data:<mime>;base64,"
        const base64 = result.split(',')[ 1 ] || result;
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const generateSubjectForDoc = (doc: any) => {
    if (!doc || !doc.type) {
      const prefix = `[${emailData.fromName || "HabeasDesk"}]`;
      return `${prefix} Documento`;
    }
    const isInvoice = doc.type === "invoice";
    const prefix = `[${doc.senderName || emailData.fromName || "HabeasDesk"}]`;
    return `${prefix} ${isInvoice ? "Fatura" : "Orçamento"} ${doc.number || ""} - ${doc.title || ""}`;
  };

  const getDefaultRecipientForDoc = (doc: any) => {
    return doc?.receiverDetails?.email || doc?.clientEmail || doc?.email || "";
  };

  React.useEffect(() => {
    if (open) {
      const map: Record<string, { to: string; subject: string; customMessage: string }> = {};
      (documents || []).forEach((doc) => {
        const id = doc?.id || Math.random().toString(36).slice(2);
        map[ id ] = {
          to: getDefaultRecipientForDoc(doc),
          subject: generateSubjectForDoc(doc),
          customMessage: "",
        };
      });
      setPerDocData(map);
      setActiveDoc((documents && documents[ 0 ] && documents[ 0 ].id) || null);
      setEmailData((prev) => ({
        ...prev,
        fromName: (documents && documents[ 0 ] && documents[ 0 ].senderName) || prev.fromName,
        subject: (documents && documents.length === 1 && documents[ 0 ]) ? generateSubjectForDoc(documents[ 0 ]) : prev.subject,
        to: (documents && documents.length === 1 && documents[ 0 ]) ? getDefaultRecipientForDoc(documents[ 0 ]) : prev.to,
      }));
    }
  }, [ open, documents ]);

  const handleSend = async () => {
    setSending(true);
    try {
      const attachments =
        emailData.attachedFiles && emailData.attachedFiles.length > 0
          ? await Promise.all(
            emailData.attachedFiles.map(async (file: File) => ({
              filename: file.name,
              content: await fileToBase64(file),
              contentType: file.type,
            })),
          )
          : undefined;
      const payloads = (documents || []).map((doc) => {
        const cfg = perDocData[ doc.id ] || { to: getDefaultRecipientForDoc(doc), subject: generateSubjectForDoc(doc), customMessage: "" };
        const toList = (cfg.to || "").split(",").map((e) => e.trim()).filter(Boolean);
        return {
          from: `${emailData.fromName} <${emailData.fromEmail}>`,
          to: toList.length > 0 ? toList : [ getDefaultRecipientForDoc(doc) ].filter(Boolean),
          cc: emailData.cc ? emailData.cc.split(',').map((email) => email.trim()) : undefined,
          bcc: emailData.bcc ? emailData.bcc.split(',').map((email) => email.trim()) : undefined,
          subject: cfg.subject,
          html: getTemplateContent({ ...doc, linkPagamento: paymentLinks[ doc.id ] || doc.linkPagamento }, cfg.customMessage || emailData.customMessage),
          reply_to: emailData.replyTo,
          attachments,
        };
      });

      const result = await onSendEmail(payloads) as any;
      if (result && (result as any).ok) {
        alert(
          `✅ ${payloads.length} email${payloads.length > 1 ? 's' : ''} enviado${payloads.length > 1 ? 's' : ''} com sucesso!`,
        );
      }

      safeOnOpenChange(false);
    } catch (error) {
      alert('❌ Erro ao enviar email. Verifique as configurações e tente novamente.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={safeOnOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Enviar Email - {documents.length} Documento
            {documents.length > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Configure e envie os documentos selecionados por email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Summary */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">📄 Documentos Selecionados:</h4>
            {documents && documents.length > 0 ? (
              <Tabs value={activeDoc || undefined} onValueChange={(v) => setActiveDoc(v)}>
                <TabsList className="flex gap-2 overflow-x-auto p-1">
                  {documents.map((doc) => (
                    <TabsTrigger
                      key={doc.id}
                      value={doc.id}
                      className="whitespace-nowrap data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                    >
                      {doc.type === "invoice" ? "📄" : "📋"} {doc.number || "N/A"} •{" "}
                      {doc.total
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(doc.total)
                        : "R$ 0,00"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : (
              <Badge variant="outline">Nenhum documento selecionado</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email Configuration */}
            <div className="space-y-4">
              <h3 className="font-medium">📧 Configuração do Email</h3>

              <div>
                <Label>Para (destinatários) *</Label>
                <Input
                  value={activeDoc ? (perDocData[ activeDoc ]?.to || "") : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!activeDoc) return;
                    setPerDocData((prev) => ({ ...prev, [ activeDoc ]: { ...(prev[ activeDoc ] || { to: "", subject: "", customMessage: "" }), to: v } }));
                  }}
                  placeholder="cliente@email.com, outro@email.com"
                />
              </div>
              <div>
                <Label>Assunto</Label>
                <Input
                  value={activeDoc ? (perDocData[ activeDoc ]?.subject || "") : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!activeDoc) return;
                    setPerDocData((prev) => ({ ...prev, [ activeDoc ]: { ...(prev[ activeDoc ] || { to: "", subject: "", customMessage: "" }), subject: v } }));
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from-name">Nome do Remetente</Label>
                  <Input
                    id="from-name"
                    value={emailData.fromName}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        fromName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="from-email">Email do Remetente</Label>
                  <Input
                    id="from-email"
                    disabled
                    type="email"
                    value={emailData.fromEmail}
                    onChange={(e) =>
                      setEmailData((prev) => ({
                        ...prev,
                        fromEmail: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cc">CC (opcional)</Label>
                  <Input
                    id="cc"
                    type="email"
                    placeholder="cc@email.com"
                    value={emailData.cc}
                    onChange={(e) =>
                      setEmailData((prev) => ({ ...prev, cc: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="bcc">CCO (opcional)</Label>
                  <Input
                    id="bcc"
                    type="email"
                    placeholder="bcc@email.com"
                    value={emailData.bcc}
                    onChange={(e) =>
                      setEmailData((prev) => ({ ...prev, bcc: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="custom-message">
                  Mensagem Personalizada (opcional)
                </Label>
                <Textarea
                  id="custom-message"
                  placeholder="Adicione uma mensagem personalizada que será incluída no email..."
                  value={emailData.customMessage}
                  onChange={(e) =>
                    setEmailData((prev) => ({
                      ...prev,
                      customMessage: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>

              {/* File upload area */}
              <div className="space-y-3">
                <Label htmlFor="file-upload">Adicionar Arquivos</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".pdf,.doc,.docx,.png,.jpeg,.jpg"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setEmailData((prev) => ({
                        ...prev,
                        attachedFiles: files,
                      }));
                    }}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <div className="text-gray-500">
                        <svg
                          className="mx-auto h-12 w-12"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-blue-600 hover:text-blue-500">
                          Clique para fazer upload
                        </span>
                        <span> ou arraste e solte</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        PDF, DOC, DOCX, PNG, JPEG até 10MB cada
                      </p>
                    </div>
                  </label>
                </div>
                {emailData.attachedFiles &&
                  emailData.attachedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Arquivos Selecionados:
                      </Label>
                      <div className="space-y-1">
                        {emailData.attachedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                          >
                            <span className="truncate">{file.name}</span>
                            <span className="text-gray-500 ml-2">
                              {(file.size / 1024 / 1024).toFixed(1)}MB
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">👁️ Preview do Email</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const active = (documents || []).find((d) => d.id === activeDoc) || (documents && documents[ 0 ]);
                      if (!active) return;
                      if (active.type !== "invoice") {
                        alert("Geração de checkout disponível apenas para faturas.");
                        return;
                      }
                      try {
                        setGeneratingLink(true);
                        const res = await apiService.createReceivableCheckoutSession(active.id, { successUrl: window.location.origin + "/cobranca?checkout=success", cancelUrl: window.location.origin + "/cobranca?checkout=cancel" });
                        const url = res?.url as string | undefined;
                        if (url) {
                          setPaymentLinks((prev) => ({ ...prev, [ active.id ]: url }));
                        } else {
                          alert("Não foi possível gerar o link de pagamento.");
                        }
                      } catch {
                        alert("Erro ao gerar checkout. Verifique a configuração da Stripe Connect.");
                      } finally {
                        setGeneratingLink(false);
                      }
                    }}
                    disabled={generatingLink || !documents || documents.length === 0}
                  >
                    {generatingLink ? "Gerando..." : "Gerar link de pagamento"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const previewWindow = window.open(
                        "",
                        "_blank",
                        "width=800,height=600",
                      );
                      if (previewWindow) {
                        const active = (documents || []).find((d) => d.id === activeDoc) || (documents && documents[ 0 ]);
                        const customMsg = active ? (perDocData[ active.id ]?.customMessage || emailData.customMessage) : emailData.customMessage;
                        const content =
                          active
                            ? getTemplateContent({ ...active, linkPagamento: paymentLinks[ active.id ] || active.linkPagamento }, customMsg)
                            : "<p>Nenhum documento disponível</p>";
                        previewWindow.document.write(content);
                        previewWindow.document.close();
                      }
                    }}
                    disabled={!documents || documents.length === 0}
                  >
                    <Globe className="h-4 w-4 mr-1" />
                    Abrir Preview
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden h-[400px]">
                <iframe
                  srcDoc={
                    (() => {
                      const active = (documents || []).find((d) => d.id === activeDoc) || (documents && documents[ 0 ]);
                      const customMsg = active ? (perDocData[ active.id ]?.customMessage || emailData.customMessage) : emailData.customMessage;
                      return active
                        ? getTemplateContent(active, customMsg)
                        : '<div style="padding: 20px; text-align: center; color: #666;">Nenhum documento selecionado para preview</div>';
                    })()
                  }
                  className="w-full h-full"
                  title="Preview do Email"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div></div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={createSafeDialogHandler(() => safeOnOpenChange(false))}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                sending ||
                !documents ||
                documents.length === 0 ||
                !((documents || []).every((doc) => {
                  const cfg = perDocData[ doc.id ];
                  const candidate = (cfg?.to || getDefaultRecipientForDoc(doc) || "").trim();
                  return candidate.length > 0;
                }))
              }
            >
              {sending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Email{documents.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
