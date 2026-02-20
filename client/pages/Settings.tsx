/**
 * SISTEMA DE GESTÃO JURÍDICA - MÓDULO CONFIGURAÇÕES
 * =================================================
 *
 * Módulo completo de configurações do sistema para escritórios de advocacia.
 * Organizado em abas especializadas para diferentes aspectos da configuração:
 *
 * ABAS DISPONÍVEIS:
 *
 * 1. EMPRESA
 *    - Dados da empresa (nome, CNPJ, contatos)
 *    - Upload de logo e favicon
 *    - Informações de contato
 *    - Exportação e Importação de Clientes
 *
 * 2. USUÁRIOS
 *    - Gestão de usuários do sistema
 *    - Perfis e permissões
 *    - Grupos de acesso
 *
 * 3. NOTIFICAÇÕES
 *    - Preferências de notificação
 *    - Lembretes de prazos
 *    - Alertas de faturas
 *
 * 4. JURÍDICO
 *    - Status INSS personalizados
 *    - Categorias de casos
 *    - Templates de contratos
 *    - Prazos processuais
 *
 * FUNCIONALIDADES ESPECIAIS:
 * - Upload de arquivos com validação
 * - Editor de templates avançado
 * - Gestão de contas bancárias
 * - Controle de sessões
 *
 * Autor: Sistema de Gestão Jurídica
 * Data: 2024
 * Versão: 2.0
 */

import React, { useEffect, useState } from "react";
import {
  createSafeOnOpenChange,
  createSafeDialogHandler,
} from "@/lib/dialog-fix";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Settings as SettingsIcon,
  Building,
  Users,
  Mail,
  Palette,
  Bell,
  Shield,
  Globe,
  Scale,
  DollarSign,
  CheckCircle,
  Eye,
  Save,
  Upload,
  Download,
  Edit,
  Plus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserManagement } from "@/components/Settings/UserManagement";
import { apiService } from "@/services/apiService";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { cn } from "../lib/utils";

export function Settings() {
  const [ activeTab, setActiveTab ] = useState("company");
  const { user } = useAuth();
  const { clients, loadClients } = useClients();

  // Create safe dialog handlers
  const safeSetShowTemplateModal = createSafeOnOpenChange((open: boolean) =>
    setShowTemplateModal(open),
  );
  const [ error, setError ] = useState<string | null>(null);
  const [ logoFile, setLogoFile ] = useState<File | null>(null);
  const [ faviconFile, setFaviconFile ] = useState<File | null>(null);
  const [ logoPreview, setLogoPreview ] = useState<string | null>(null);
  const [ faviconPreview, setFaviconPreview ] = useState<string | null>(null);

  // FUNCIONALIDADE FUTURA: Nome dinâmico da empresa
  // Estado para gerenciar o nome da empresa que aparece no DashboardLayout
  const [ companyName, setCompanyName ] = useState<string>("");
  const [ savedCompanyName, setSavedCompanyName ] = useState<string>("");
  const [ showTemplateModal, setShowTemplateModal ] = useState(false);
  const [ currentTemplate, setCurrentTemplate ] = useState<
    "budget" | "invoice" | null
  >(null);
  const [ templateContent, setTemplateContent ] = useState("");

  const [ companyEmail, setCompanyEmail ] = useState<string>("");
  const [ companyPhone, setCompanyPhone ] = useState<string>("");
  const [ companyCnpj, setCompanyCnpj ] = useState<string>("");
  const [ companyAddress, setCompanyAddress ] = useState<string>("");
  const [ companyCity, setCompanyCity ] = useState<string>("");
  const [ companyState, setCompanyState ] = useState<string>("");
  const [ companyZip, setCompanyZip ] = useState<string>("");
  const [ companyCountry, setCompanyCountry ] = useState<string>("");
  const [ companyWebsite, setCompanyWebsite ] = useState<string>("");
  const [ companyDescription, setCompanyDescription ] = useState<string>("");

  const [ pushEnabled, setPushEnabled ] = useState<boolean>(true);
  const [ deadline3, setDeadline3 ] = useState<boolean>(true);
  const [ deadline7, setDeadline7 ] = useState<boolean>(true);
  const [ deadline15, setDeadline15 ] = useState<boolean>(false);
  const [ inv3Before, setInv3Before ] = useState<boolean>(true);
  const [ inv1After, setInv1After ] = useState<boolean>(true);
  const [ invWeekly, setInvWeekly ] = useState<boolean>(false);

  const [ plansLoading, setPlansLoading ] = useState<boolean>(false);
  const [ plansError, setPlansError ] = useState<string | null>(null);
  const [ plans, setPlans ] = useState<any[]>([]);
  const [ stripeLoading, setStripeLoading ] = useState<boolean>(false);
  const [ stripePublishableKey, setStripePublishableKey ] = useState<string>("");
  const [ stripeSecretKey, setStripeSecretKey ] = useState<string>("");
  const [ stripeWebhookSecret, setStripeWebhookSecret ] = useState<string>("");
  const [ stripeSecretMasked, setStripeSecretMasked ] = useState<string>("");
  const [ stripeWebhookMasked, setStripeWebhookMasked ] = useState<string>("");
  const [ stripeConnectAccountId, setStripeConnectAccountId ] = useState<string>("");
  const [ stripeConnectDetailsSubmitted, setStripeConnectDetailsSubmitted ] = useState<boolean>(false);
  const [ stripeConnectChargesEnabled, setStripeConnectChargesEnabled ] = useState<boolean>(false);
  const [ stripeConnectPayoutsEnabled, setStripeConnectPayoutsEnabled ] = useState<boolean>(false);
  const [ auditLoading, setAuditLoading ] = useState(false);
  const [ auditLogs, setAuditLogs ] = useState<any[]>([]);
  const [ auditTotal, setAuditTotal ] = useState(0);
  const [ auditPage, setAuditPage ] = useState(1);
  const [ auditLimit, setAuditLimit ] = useState(20);
  const [ auditOperation, setAuditOperation ] = useState<string>("");
  const [ auditDateFrom, setAuditDateFrom ] = useState<string>("");
  const [ auditDateTo, setAuditDateTo ] = useState<string>("");
  const [ subscriptionActive, setSubscriptionActive ] = useState<boolean>(false);
  const [ currentPlanId, setCurrentPlanId ] = useState<string | null>(null);
  const [ showChangePlanModal, setShowChangePlanModal ] = useState(false);
  const [ selectedPlan, setSelectedPlan ] = useState<any | null>(null);
  const [ changeBusy, setChangeBusy ] = useState(false);
  const [ showAuditDetail, setShowAuditDetail ] = useState(false);
  const [ auditDetail, setAuditDetail ] = useState<any | null>(null);
  const normalizeJson = (v: any) => {
    if (!v) return null;
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  };
  const flattenObject = (obj: any, prefix = ""): Record<string, any> => {
    const out: Record<string, any> = {};
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      Object.keys(obj).forEach((k) => {
        const val = obj[ k ];
        const key = prefix ? `${prefix}.${k}` : k;
        if (val && typeof val === "object" && !Array.isArray(val)) {
          const nested = flattenObject(val, key);
          Object.assign(out, nested);
        } else {
          out[ key ] = val;
        }
      });
    } else {
      out[ prefix || "" ] = obj;
    }
    return out;
  };
  const computeDiff = (oldData: any, newData: any) => {
    const oldN = normalizeJson(oldData);
    const newN = normalizeJson(newData);
    const oldF = flattenObject(oldN || {});
    const newF = flattenObject(newN || {});
    const keys = Array.from(new Set([ ...Object.keys(oldF), ...Object.keys(newF) ])).filter(k => k);
    const rows = keys.map((k) => {
      const o = oldF[ k ];
      const n = newF[ k ];
      const same = JSON.stringify(o) === JSON.stringify(n);
      return { key: k, oldValue: o, newValue: n, changed: !same };
    }).filter(r => r.changed);
    return rows;
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const aviso = params.get('aviso');
      if (aviso === 'plano-requerido') {
        toast({
          title: 'Plano requerido',
          description: 'O tenant deve possuir um plano ativo. Contate um administrador para habilitar um plano.',
          variant: 'destructive'
        });
        const url = new URL(window.location.href);
        url.searchParams.delete('aviso');
        window.history.replaceState({}, document.title, url.toString());
      }
    } catch { }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const companyRes = await apiService.get('/settings/company');
        const c = companyRes?.company || {};
        setCompanyName(c.name || 'LegalSaaS');
        setSavedCompanyName(c.name || 'LegalSaaS');
        setCompanyEmail(c.email || '');
        setCompanyPhone(c.phone || '');
        setCompanyCnpj(c.document || '');
        setCompanyAddress(c.address || '');
        setCompanyCity(c.city || '');
        setCompanyState(c.state || '');
        setCompanyZip(c.zipCode || '');
        setCompanyCountry(c.country || '');
        setCompanyWebsite(c.website || '');
        setCompanyDescription(c.description || '');
        if (typeof c.logo === 'string') setLogoPreview(c.logo);
        if (typeof c.favicon === 'string') setFaviconPreview(c.favicon);
      } catch { }
      try {
        const me = await apiService.get('/auth/me');
        setSubscriptionActive(!!me?.subscriptionActive);
        const cp = me?.subscription?.plan?.id as string | undefined;
        setCurrentPlanId(cp || null);
      } catch { }
      try {
        const notifRes = await apiService.get('/settings/notifications');
        const n = notifRes?.notifications || {};
        setPushEnabled(!!n.pushNotifications);
        const pd = n.projectDeadlines || {};
        const days = Array.isArray(pd.daysBefore) ? pd.daysBefore : [];
        setDeadline3(days.includes(3));
        setDeadline7(days.includes(7));
        setDeadline15(days.includes(15));
        const ir = n.invoiceReminders || {};
        const idays = Array.isArray(ir.daysBefore) ? ir.daysBefore : [];
        setInv3Before(idays.includes(3));
        setInv1After(!!ir.afterDue);
        setInvWeekly(ir.frequency === 'weekly');
      } catch { }
      // Removido: carregamento de configurações jurídicas
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setPlansLoading(true);
        const res = await apiService.get('/stripe/plans');
        setPlans(Array.isArray(res?.plans) ? res.plans : []);
        setPlansError(null);
      } catch (e) {
        setPlans([]);
        setPlansError('Erro ao carregar planos');
      } finally {
        setPlansLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeTab !== 'stripe') return;
    (async () => {
      try {
        setStripeLoading(true);
        const res = await apiService.get('/settings/integrations/stripe');
        const s = res?.stripe || {};
        setStripePublishableKey(s.publishableKey || '');
        setStripeSecretMasked(s.secretKeyMasked || '');
        setStripeWebhookMasked(s.webhookSecretMasked || '');
        setStripeConnectAccountId(s.connectAccountId || '');
        setStripeConnectDetailsSubmitted(!!s.connectDetailsSubmitted);
        setStripeConnectChargesEnabled(!!s.connectChargesEnabled);
        setStripeConnectPayoutsEnabled(!!s.connectPayoutsEnabled);
      } catch {
        setStripePublishableKey('');
        setStripeSecretMasked('');
        setStripeWebhookMasked('');
        setStripeConnectAccountId('');
        setStripeConnectDetailsSubmitted(false);
        setStripeConnectChargesEnabled(false);
        setStripeConnectPayoutsEnabled(false);
      } finally {
        setStripeLoading(false);
      }
    })();
  }, [ activeTab ]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    (async () => {
      try {
        setAuditLoading(true);
        const params: any = { page: auditPage, limit: auditLimit };
        if (auditOperation) params.operation = auditOperation;
        if (auditDateFrom) params.dateFrom = auditDateFrom;
        if (auditDateTo) params.dateTo = auditDateTo;
        const res = await apiService.get('/settings/audit', params);
        setAuditLogs(Array.isArray(res?.logs) ? res.logs : []);
        setAuditTotal(res?.pagination?.total || 0);
      } catch {
        setAuditLogs([]);
      } finally {
        setAuditLoading(false);
      }
    })();
  }, [ activeTab, auditPage, auditLimit, auditOperation, auditDateFrom, auditDateTo ]);

  // Tratamento de erro
  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-red-600 mb-2">
                  Erro nas Configurações
                </h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => setError(null)}>Tentar Novamente</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Handlers para funcionalidades
  const handleSaveCompany = () => {
    try {
      const payload = {
        name: companyName,
        document: companyCnpj,
        email: companyEmail,
        phone: companyPhone,
        address: companyAddress,
        city: companyCity,
        state: companyState,
        zipCode: companyZip,
        country: companyCountry,
        website: companyWebsite,
        description: companyDescription,
        logo: logoPreview,
        favicon: faviconPreview,
      };
      apiService.put('/settings/company', payload).then((res) => {
        const c = res?.company || {};
        setSavedCompanyName(c.name || companyName);
        setLogoFile(null);
        setFaviconFile(null);
        toast({ title: 'Configurações salvas', description: 'Dados da empresa atualizados com sucesso.' });
      }).catch(() => {
        setError('Erro ao salvar configurações da empresa');
        toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as configurações da empresa.', variant: 'destructive' });
      });
    } catch (error) {
      setError("Erro ao salvar configurações da empresa");
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as configurações da empresa.', variant: 'destructive' });
    }
  };

  const handleSaveNotifications = () => {
    try {
      const payload = {
        pushNotifications: pushEnabled,
        projectDeadlines: {
          enabled: deadline3 || deadline7 || deadline15, daysBefore: [
            ...(deadline3 ? [ 3 ] : []),
            ...(deadline7 ? [ 7 ] : []),
            ...(deadline15 ? [ 15 ] : []),
          ]
        },
        invoiceReminders: {
          enabled: inv3Before || inv1After || invWeekly, daysBefore: [
            ...(inv3Before ? [ 3 ] : []),
          ], afterDue: inv1After, frequency: invWeekly ? 'weekly' : 'daily'
        },
      };
      apiService.put('/settings/notifications', payload).then(() => {
        toast({ title: 'Preferências salvas', description: 'Notificações atualizadas com sucesso.' });
      }).catch(() => {
        setError('Erro ao salvar preferências de notificações');
        toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as preferências de notificações.', variant: 'destructive' });
      });
    } catch (error) {
      setError("Erro ao salvar preferências de notificações");
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar as preferências de notificações.', variant: 'destructive' });
    }
  };

  const formatCurrency = (value?: number) => {
    if (typeof value !== 'number') return '—';
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    } catch {
      return value.toFixed(2);
    }
  };

  const handleSubscribePlan = async (planId: string) => {
    try {
      const successUrl = `${window.location.origin}/configuracoes?checkout=success`;
      const cancelUrl = `${window.location.origin}/configuracoes?checkout=cancel`;
      const res = await apiService.post('/stripe/subscriptions', { planId, successUrl, cancelUrl });
      const url = res?.url as string | undefined;
      if (url) {
        window.location.href = url;
      } else {
        toast({ title: 'Falha ao iniciar checkout', description: 'URL de checkout não retornada', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro ao iniciar assinatura', description: 'Verifique as configurações da Stripe do tenant.', variant: 'destructive' });
    }
  };

  const handleOpenPortal = async () => {
    try {
      const returnUrl = `${window.location.origin}/configuracoes`;
      const res = await apiService.post('/stripe/portal/session', { returnUrl });
      const url = res?.url as string | undefined;
      if (url) {
        window.location.href = url;
      } else {
        toast({ title: 'Falha ao abrir portal', description: 'URL do portal não retornada', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao abrir portal', description: 'Verifique as configurações da Stripe do tenant.', variant: 'destructive' });
    }
  };

  const openChangePlanModal = (plan: any) => {
    setSelectedPlan(plan);
    setShowChangePlanModal(true);
  };

  const handleChangePlan = async (planId: string) => {
    try {
      setChangeBusy(true);
      const res = await apiService.post('/stripe/subscriptions/change-plan', { planId, prorationBehavior: 'create_prorations' });
      if (res && res.scheduled) {
        const when = res.effectiveAt ? new Date(res.effectiveAt).toLocaleString('pt-BR') : '';
        toast({ title: 'Downgrade agendado', description: `A mudança de plano foi programada para ${when}.`, });
      } else {
        toast({ title: 'Plano atualizado', description: 'Sua assinatura foi alterada com sucesso.' });
        setCurrentPlanId(planId);
        setSubscriptionActive(true);
      }
      setShowChangePlanModal(false);
      setSelectedPlan(null);
    } catch (error: any) {
      const msg = error?.message || 'Não foi possível mudar o plano.';
      toast({ title: 'Erro ao alterar plano', description: msg, variant: 'destructive' });
    } finally {
      setChangeBusy(false);
    }
  };

  const formatFeatureKey = (k: string) => {
    const s = k.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleExportClientsCSV = async () => {
    try {
      const token = localStorage.getItem("access_token") || "";
      const res = await fetch("/api/settings/company/export-clients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Erro ao exportar clientes para CSV");
        return;
      }
      const csvText = await res.text();
      const blob = new Blob([ csvText ], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const fallback = `clientes_export_${new Date().toISOString().split("T")[ 0 ]}.csv`;
      link.setAttribute("download", match?.[ 1 ] || fallback);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      const lines = csvText.split("\n").filter((l) => l.trim()).length - 1;
      alert(
        `✅ Exportação concluída!\n\n📊 ${Math.max(0, lines)} clientes exportados\n📁 Arquivo: ${match?.[ 1 ] || fallback}\n\n🔽 Download iniciado automaticamente`
      );
    } catch (error) {
      setError("Erro ao exportar clientes para CSV");
    }
  };

  const handleImportClientsCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[ 0 ];
    if (!file) return;

    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        alert("❌ Erro: Por favor, selecione um arquivo CSV (.csv)");
        return;
      }

      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {
        alert("❌ Erro: Arquivo CSV vazio ou sem dados");
        return;
      }

      const splitCSV = (line: string) =>
        line
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((v) => v.replace(/^"(.*)"$/, "$1").trim());
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "");
      const headersRaw = splitCSV(lines[ 0 ]);
      const headers = headersRaw.map((h) => normalize(h));
      const idx = (key: string) => headers.findIndex((h) => h.includes(key));

      const requiredFields = [ "nome", "cpf" ];
      const missingFields = requiredFields.filter((f) => idx(f) === -1);

      if (missingFields.length > 0) {
        alert(
          `❌ Erro: Campos obrigatórios ausentes no CSV:\n\n• ${missingFields.join(
            "\n• ",
          )}\n\nCampos obrigatórios: Nome, Email, CPF`,
        );
        return;
      }

      const importedClients = [];
      const errors = [];
      const successes = [];
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");
      const isValidCPF = (cpfIn: string) => {
        const cpf = onlyDigits(cpfIn);
        if (cpf.length !== 11) return false;
        if (/^(\d)\1+$/.test(cpf)) return false;
        const calc = (base: string, factor: number) => {
          let sum = 0;
          for (let i = 0; i < base.length; i++) sum += parseInt(base[ i ]) * (factor - i);
          const rest = (sum * 10) % 11;
          return rest === 10 ? 0 : rest;
        };
        const d1 = calc(cpf.slice(0, 9), 10);
        const d2 = calc(cpf.slice(0, 10), 11);
        return d1 === parseInt(cpf[ 9 ]) && d2 === parseInt(cpf[ 10 ]);
      };

      for (let i = 1; i < lines.length; i++) {
        const values = splitCSV(lines[ i ]);

        if (!values || values.length === 0) {
          continue;
        }
        if (values.length < headers.length) {
          errors.push(`Linha ${i + 1}: Número de colunas insuficiente`);
          continue;
        }

        const client: any = {};
        const get = (key: string) => {
          const j = idx(key);
          return j >= 0 ? values[ j ] : "";
        };
        client.nome = get("nome");
        client.email = get("email");
        client.telefone = get("telefone") || get("celular");
        client.pais = get("pais");
        client.estado = get("estado");
        client.endereco = get("endereco");
        client.cidade = get("cidade");
        client.cep = get("cep");
        client.cpf = get("cpf");
        client.rg = get("rg");

        if (!client.nome || !client.cpf) {
          errors.push(`Linha ${i + 1}: Nome ou CPF em branco`);
          continue;
        }
        if (client.email && !emailRegex.test(client.email)) {
          errors.push(`Linha ${i + 1}: Email inválido (será ignorado)`);
          client.email = "";
        }
        if (!isValidCPF(client.cpf)) {
          errors.push(`Linha ${i + 1}: CPF inválido (importado mesmo assim)`);
        }
        if (client.telefone && onlyDigits(client.telefone).length < 8) {
          errors.push(`Linha ${i + 1}: Telefone inválido (será ignorado)`);
          client.telefone = "";
        }
        if (client.cep && onlyDigits(client.cep).length < 8) {
          errors.push(`Linha ${i + 1}: CEP inválido (será ignorado)`);
          client.cep = "";
        }

        const payload = {
          name: client.nome,
          email: client.email || undefined,
          phone: client.telefone ? onlyDigits(client.telefone) : undefined,
          country: client.pais || undefined,
          state: client.estado || undefined,
          address: client.endereco || undefined,
          city: client.cidade || undefined,
          zipCode: client.cep ? onlyDigits(client.cep) : undefined,
          cpf: onlyDigits(client.cpf),
          rg: client.rg || undefined,
          status: "active",
        };

        try {
          const res = await apiService.createClient(payload);
          importedClients.push(res?.client || payload);
          successes.push(i + 1);
        } catch (e: any) {
          errors.push(`Linha ${i + 1}: ${e?.message || "Falha ao criar cliente"}`);
        }
      }

      if (importedClients.length > 0) {
        try { await loadClients(); } catch { }
        const msg =
          `✅ Importação concluída!\n\n📊 ${importedClients.length} cliente(s) importado(s) com sucesso` +
          (errors.length > 0 ? `\n⚠️ ${errors.length} erro(s) encontrado(s)` : "");
        alert(msg);

        console.log("📝 Clientes importados:", importedClients);
        if (errors.length > 0) {
          console.warn("⚠️ Erros de importação:", errors);
        }
      } else {
        alert(
          `❌ Importação falhou!\n\nNenhum cliente válido encontrado.\n\nErros:\n• ${errors.join("\n• ")}`,
        );
      }
    } catch (error) {
      setError("Erro ao processar arquivo CSV");
      alert(
        "❌ Erro ao processar arquivo CSV. Verifique se o formato está correto.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[ 0 ];
    if (file) {
      // Verificar tipo de arquivo
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/svg+xml",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Tipo de arquivo não suportado. Use PNG, JPEG ou SVG.");
        return;
      }

      // Verificar tamanho (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Arquivo muito grande. Tamanho máximo: 5MB.");
        return;
      }

      setLogoFile(file);

      // Criar preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);

        // FUNCIONALIDADE FUTURA: Upload automático e seleção da logo
        // Quando implementar backend, aqui será o local para:
        // 1. Fazer upload automático do arquivo para o servidor
        // 2. Salvar a URL da imagem no localStorage ou estado global
        // 3. Atualizar automaticamente o logo no DashboardLayout
        // 4. Enviar notificação de sucesso
        // Exemplo de implementação futura:
        // localStorage.setItem('companyLogo', e.target?.result as string);
        // window.dispatchEvent(new Event('logoUpdated')); // Evento para atualizar layout
      };
      reader.readAsDataURL(file);

      setError(null);
    }
  };

  const handleFaviconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[ 0 ];
    if (file) {
      // Verificar tipo de arquivo
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/svg+xml",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Tipo de arquivo não suportado. Use PNG, JPEG ou SVG.");
        return;
      }

      // Verificar tamanho (máximo 1MB para favicon)
      if (file.size > 1024 * 1024) {
        setError("Arquivo muito grande para favicon. Tamanho máximo: 1MB.");
        return;
      }

      setFaviconFile(file);

      // Criar preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFaviconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      setError(null);
    }
  };

  const handleUploadLogo = () => {
    document.getElementById("logo-upload")?.click();
  };

  const handleUploadFavicon = () => {
    document.getElementById("favicon-upload")?.click();
  };

  // Removido: handlers do módulo Jurídico (INSS/Categorias)

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Configurações</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Personalização do sistema, perfis e integrações
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="company" className="flex items-center">
              <Building className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Empresa</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center">
              <Users className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center">
              <Bell className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="stripe" className="flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Stripe</span>
            </TabsTrigger>
            {user?.accountType === 'GERENCIAL' && (
              <TabsTrigger value="audit" className="flex items-center">
                <Shield className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Auditoria</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Company Settings */}
          <TabsContent value="company">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building className="h-5 w-5 mr-2" />
                    Perfil da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="company-name">Nome da Empresa</Label>
                        <Input
                          id="company-name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Digite o nome da empresa"
                        />
                      </div>
                      <div>
                        <Label htmlFor="company-cnpj">CNPJ</Label>
                        <Input
                          id="company-cnpj"
                          value={companyCnpj}
                          onChange={(e) => setCompanyCnpj(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="company-email">Email</Label>
                        <Input
                          id="company-email"
                          type="email"
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="company-phone">Telefone</Label>
                        <Input
                          id="company-phone"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="company-address">Endereço</Label>
                        <Input
                          id="company-address"
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="company-city">Cidade</Label>
                          <Input id="company-city" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="company-state">Estado</Label>
                          <Input id="company-state" value={companyState} onChange={(e) => setCompanyState(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="company-zipcode">CEP</Label>
                          <Input
                            id="company-zipcode"
                            value={companyZip}
                            onChange={(e) => setCompanyZip(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="company-country">País</Label>
                          <Input id="company-country" value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="company-website">Website</Label>
                      <Input
                        id="company-website"
                        placeholder="https://www.silva.adv.br"
                        value={companyWebsite}
                        onChange={(e) => setCompanyWebsite(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-description">Descrição</Label>
                      <Textarea
                        id="company-description"
                        placeholder="Descrição do escritório..."
                        value={companyDescription}
                        onChange={(e) => setCompanyDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* <div className="space-y-4">
                    <h3 className="text-lg font-medium">Logo e Marca</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Logo da Empresa</Label>
                        <div className="mt-2 flex items-center space-x-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {logoPreview ? (
                              <img
                                src={logoPreview}
                                alt="Logo preview"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Building className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col space-y-2">
                            <Button
                              variant="outline"
                              onClick={handleUploadLogo}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {logoFile ? "Trocar Logo" : "Upload Logo"}
                            </Button>
                            {logoFile && (
                              <div className="text-xs text-muted-foreground">
                                {logoFile.name} (
                                {(logoFile.size / 1024).toFixed(1)}KB)
                              </div>
                            )}
                          </div>
                          <input
                            id="logo-upload"
                            type="file"
                            accept=".png,.jpg,.jpeg,.svg"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Formatos aceitos: PNG, JPEG, SVG. Tamanho máximo: 5MB
                        </p>
                      </div>
                      <div>
                        <Label>Favicon</Label>
                        <div className="mt-2 flex items-center space-x-4">
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center overflow-hidden">
                            {faviconPreview ? (
                              <img
                                src={faviconPreview}
                                alt="Favicon preview"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col space-y-2">
                            <Button
                              variant="outline"
                              onClick={handleUploadFavicon}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {faviconFile
                                ? "Trocar Favicon"
                                : "Upload Favicon"}
                            </Button>
                            {faviconFile && (
                              <div className="text-xs text-muted-foreground">
                                {faviconFile.name} (
                                {(faviconFile.size / 1024).toFixed(1)}KB)
                              </div>
                            )}
                          </div>
                          <input
                            id="favicon-upload"
                            type="file"
                            accept=".png,.jpg,.jpeg,.svg"
                            onChange={handleFaviconUpload}
                            className="hidden"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Formatos aceitos: PNG, JPEG, SVG. Tamanho máximo: 1MB
                        </p>
                      </div>
                    </div>
                  </div> */}

                  <div className="flex justify-end">
                    <Button onClick={handleSaveCompany}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Assinatura e Planos
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Escolha um plano e conclua a assinatura via Stripe
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {plansLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando planos…</div>
                  ) : plansError ? (
                    <div className="text-sm text-red-600">{plansError}</div>
                  ) : plans.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum plano disponível</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {plans.map((p) => {
                        const features = typeof p.features === 'object' && p.features !== null ? p.features : {};
                        return (
                          <div key={p.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-base font-semibold">{p.name}</div>
                              <div className="text-sm">{formatCurrency(Number(p.price))}</div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-4">
                              Até {p.maxUsers} usuário(s){p.maxStorageGB ? ` · ${p.maxStorageGB}GB` : ''}
                            </div>
                            <div className="space-y-1 mb-4">
                              {Object.entries(features).filter(([ , v ]) => !!v).slice(0, 4).map(([ k ]) => (
                                <div key={k} className="text-xs flex items-center text-muted-foreground">
                                  <CheckCircle className="h-3 w-3 text-green-600 mr-1" />
                                  <span>{formatFeatureKey(k)}</span>
                                </div>
                              ))}
                              {(!features || Object.keys(features).length === 0) && (
                                <div className="text-xs text-muted-foreground">Recursos definidos pelo plano</div>
                              )}
                            </div>
                            <Button
                              onClick={currentPlanId && subscriptionActive && p.id === currentPlanId ? handleOpenPortal : (subscriptionActive ? () => openChangePlanModal(p) : () => handleSubscribePlan(p.id))}
                              className={cn(
                                "w-full",
                                {
                                  "text-white bg-black/90 hover:bg-black/60": currentPlanId && subscriptionActive && p.id === currentPlanId,
                                }
                              )}

                            >
                              {currentPlanId && subscriptionActive && p.id === currentPlanId ? 'Gerenciar' : 'Assinar'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Client Export/Import Section - Moved from Security */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Download className="h-5 w-5 mr-2" />
                    Exportação e Importação de Clientes
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Gerencie dados de clientes através de arquivos CSV
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Exportação */}
                  <div className="space-y-4">
                    <h4 className="font-medium">📤 Exportar Clientes</h4>
                    <p className="text-sm text-muted-foreground">
                      Baixe todos os dados dos clientes em formato CSV para
                      backup ou transferência.
                    </p>
                    <div className="flex items-center space-x-4">
                      <Button onClick={handleExportClientsCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        📊 {clients.length} clientes disponíveis
                      </div>
                    </div>
                  </div>

                  {/* Importação */}
                  <div className="space-y-4">
                    <h4 className="font-medium">📥 Importar Clientes</h4>
                    <p className="text-sm text-muted-foreground">
                      Carregue dados de clientes a partir de um arquivo CSV.
                      Campos obrigatórios: Nome, CPF.
                    </p>
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="outline"
                        onClick={() =>
                          document.getElementById("import-csv")?.click()
                        }
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Arquivo CSV
                      </Button>
                      <input
                        id="import-csv"
                        type="file"
                        accept=".csv"
                        onChange={handleImportClientsCSV}
                        className="hidden"
                      />
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-yellow-800">
                        <strong>⚠️ Formato esperado:</strong> Nome, Email,
                        Telefone, País, Estado, Endereço, Cidade, CEP, CPF, RG
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  Configurações de Notificações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notificações Push</Label>
                      <p className="text-sm text-muted-foreground">
                        Notificações no navegador
                      </p>
                    </div>
                    <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
                  </div>

                  <div className="space-y-3">
                    <Label>Prazos de Projetos</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Avisar 3 dias antes</span>
                        <Switch checked={deadline3} onCheckedChange={setDeadline3} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Avisar 7 dias antes</span>
                        <Switch checked={deadline7} onCheckedChange={setDeadline7} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Avisar 15 dias antes</span>
                        <Switch checked={deadline15} onCheckedChange={setDeadline15} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Lembretes de Faturas</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          3 dias antes do vencimento
                        </span>
                        <Switch checked={inv3Before} onCheckedChange={setInv3Before} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          1 dia depois do vencimento
                        </span>
                        <Switch checked={inv1After} onCheckedChange={setInv1After} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Frequência semanal</span>
                        <Switch checked={invWeekly} onCheckedChange={setInvWeekly} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveNotifications}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Preferências
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stripe">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Stripe Connect
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-md border p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">
                          Conecte sua conta Stripe
                        </div>
                        <div className="text-sm mt-1 text-muted-foreground">
                          {!stripeConnectAccountId
                            ? "Integração segura para recebimentos e repasses através do Stripe Connect."
                            : stripeConnectDetailsSubmitted
                              ? "Sua conta está conectada. Acesse para gerenciar dados de pagamento."
                              : "Conexão iniciada. Finalize o cadastro para habilitar o gerenciamento."}
                        </div>
                      </div>
                      <div className="text-xs font-semibold px-3 py-1 rounded-full border"
                        style={{
                          backgroundColor: !stripeConnectAccountId ? "rgba(245, 161, 0, 0.12)" : (stripeConnectDetailsSubmitted ? "rgba(46, 204, 113, 0.12)" : "rgba(255, 107, 107, 0.12)"),
                          color: !stripeConnectAccountId ? "#A56B00" : (stripeConnectDetailsSubmitted ? "#1E7E34" : "#B23B3B")
                        }}
                      >
                        {!stripeConnectAccountId ? "Não conectado" : (stripeConnectDetailsSubmitted ? "Conectado" : "Conexão incompleta")}
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {stripeConnectAccountId
                        ? `Conta: ${stripeConnectAccountId} • Pagamentos ${stripeConnectChargesEnabled ? "habilitados" : "desabilitados"} • Repasses ${stripeConnectPayoutsEnabled ? "habilitados" : "desabilitados"}`
                        : "Conecte para criar sua conta Stripe."}
                    </div>
                    <div className="mt-6 flex">
                      {!stripeConnectAccountId ? (
                        <Button
                          onClick={async () => {
                            try {
                              const returnUrl = `${window.location.origin}/configuracoes?tab=stripe`;
                              const res = await apiService.stripeConnectCreateAccount(returnUrl);
                              const url = res?.url as string | undefined;
                              if (url) {
                                window.location.href = url;
                              } else {
                                toast({ title: "Falha ao iniciar onboarding", description: "URL não retornada", variant: "destructive" });
                              }
                            } catch {
                              toast({ title: "Erro ao conectar Stripe", description: "Verifique as configurações e tente novamente.", variant: "destructive" });
                            }
                          }}
                        >
                          Cadastrar conta
                        </Button>
                      ) : !stripeConnectDetailsSubmitted ? (
                        <Button
                          onClick={async () => {
                            try {
                              const returnUrl = `${window.location.origin}/configuracoes?tab=stripe`;
                              const res = await apiService.stripeConnectCreateAccount(returnUrl);
                              const url = res?.url as string | undefined;
                              if (url) {
                                window.location.href = url;
                              } else {
                                toast({ title: "Falha ao continuar cadastro", description: "URL não retornada", variant: "destructive" });
                              }
                            } catch {
                              toast({ title: "Erro ao continuar cadastro", description: "Tente novamente mais tarde.", variant: "destructive" });
                            }
                          }}
                        >
                          Continuar cadastro
                        </Button>
                      ) : (
                        <Button
                          onClick={async () => {
                            try {
                              const res = await apiService.stripeConnectLoginLink();
                              const url = res?.url as string | undefined;
                              if (url) {
                                window.location.href = url;
                              } else {
                                toast({ title: "Falha ao abrir gerenciamento", description: "URL não retornada", variant: "destructive" });
                              }
                            } catch {
                              toast({ title: "Erro ao abrir gerenciamento", description: "Tente novamente mais tarde.", variant: "destructive" });
                            }
                          }}
                        >
                          Gerenciar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Auditoria do Tenant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Operação</Label>
                    <Select value={auditOperation} onValueChange={setAuditOperation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">Todas</SelectItem>
                        <SelectItem value="CREATE">CREATE</SelectItem>
                        <SelectItem value="UPDATE">UPDATE</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data (de)</Label>
                    <Input type="date" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data (até)</Label>
                    <Input type="date" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} />
                  </div>
                  <div>
                    <Label>Página</Label>
                    <Input type="number" min={1} value={auditPage} onChange={(e) => setAuditPage(parseInt(e.target.value || '1', 10))} />
                  </div>
                  <div>
                    <Label>Limite</Label>
                    <Select value={String(auditLimit)} onValueChange={(v) => setAuditLimit(parseInt(v, 10))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Data/Hora</th>
                        <th className="text-left p-2">Usuário</th>
                        <th className="text-left p-2">Operação</th>
                        <th className="text-left p-2">Registro</th>
                        <th className="text-left p-2">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLoading ? (
                        <tr><td className="p-3" colSpan={5}>Carregando...</td></tr>
                      ) : auditLogs.length === 0 ? (
                        <tr><td className="p-3" colSpan={5}>Nenhum log encontrado</td></tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="border-t">
                            <td className="p-2">{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                            <td className="p-2">{log.user?.name || log.user?.email || log.userId}</td>
                            <td className="p-2">{log.operation}</td>
                            <td className="p-2">{log.recordId || '-'}</td>
                            <td className="p-2">
                              <Button variant="outline" size="sm" onClick={() => { setAuditDetail(log); setShowAuditDetail(true); }}>
                                <Eye className="h-3 w-3 mr-2" />
                                Ver detalhes
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total: {auditTotal}</div>
                  <div className="space-x-2">
                    <Button variant="outline" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                    <Button variant="outline" disabled={(auditPage * auditLimit) >= auditTotal} onClick={() => setAuditPage((p) => p + 1)}>Próximo</Button>
                    <Button variant="destructive" onClick={async () => {
                      const ok = confirm('Tem certeza que deseja apagar todas as auditorias? Esta ação não pode ser desfeita.');
                      if (!ok) return;
                      try {
                        await apiService.delete('/settings/audit');
                        setAuditPage(1);
                        const res = await apiService.get('/settings/audit', { page: 1, limit: auditLimit });
                        setAuditLogs(Array.isArray(res?.logs) ? res.logs : []);
                        setAuditTotal(res?.pagination?.total || 0);
                        toast({ title: 'Auditoria limpa', description: 'Todos os logs foram apagados com sucesso.' });
                      } catch {
                        toast({ title: 'Erro ao limpar auditoria', description: 'Tente novamente mais tarde.', variant: 'destructive' });
                      }
                    }}>Apagar Todas as Auditorias</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <Dialog open={showAuditDetail} onOpenChange={setShowAuditDetail}>
            <DialogContent className="max-w-3xl max-h-[90%] overflow-auto">
              <DialogHeader>
                <DialogTitle>Detalhes da Operação</DialogTitle>
                <DialogDescription>Comparação entre dados antigos e novos</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-sm">
                    <div className="font-medium">Tabela</div>
                    <div className="text-muted-foreground">{auditDetail?.tableName || "-"}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Registro</div>
                    <div className="text-muted-foreground">{auditDetail?.recordId || "-"}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Operação</div>
                    <div className="text-muted-foreground">{auditDetail?.operation || "-"}</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Usuário</div>
                    <div className="text-muted-foreground">{auditDetail?.user?.name || auditDetail?.user?.email || auditDetail?.userId || "-"}</div>
                  </div>
                </div>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Campo</th>
                        <th className="text-left p-2">Antigo</th>
                        <th className="text-left p-2">Novo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computeDiff(auditDetail?.oldData, auditDetail?.newData).length === 0 ? (
                        <tr><td className="p-3 text-muted-foreground" colSpan={3}>Sem diferenças</td></tr>
                      ) : (
                        computeDiff(auditDetail?.oldData, auditDetail?.newData).map((d) => (
                          <tr key={d.key} className="border-t">
                            <td className="p-2 font-mono text-xs">{d.key}</td>
                            <td className="p-2 text-red-600">{typeof d.oldValue === "object" ? JSON.stringify(d.oldValue) : String(d.oldValue ?? "")}</td>
                            <td className="p-2 text-green-600">{typeof d.newValue === "object" ? JSON.stringify(d.newValue) : String(d.newValue ?? "")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-md border p-2">
                    <div className="text-sm font-medium mb-2">JSON Antigo</div>
                    <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(normalizeJson(auditDetail?.oldData) ?? {}, null, 2)}</pre>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-sm font-medium mb-2">JSON Novo</div>
                    <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(normalizeJson(auditDetail?.newData) ?? {}, null, 2)}</pre>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowAuditDetail(false); setAuditDetail(null); }}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showChangePlanModal} onOpenChange={setShowChangePlanModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Antes de mudar de plano</DialogTitle>
                <DialogDescription>
                  Entenda como funciona a cobrança e a aplicação da mudança:
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  • Upgrades são imediatos e podem gerar pró‑rata no ciclo atual.
                </div>
                <div>
                  • Downgrades próximos da renovação são agendados para o próximo ciclo.
                </div>
                <div>
                  • Downgrades fora da janela são aplicados sem pró‑rata e não geram crédito no ciclo atual.
                </div>
                <div>
                  • Mudanças muito frequentes podem ser bloqueadas por um intervalo mínimo.
                </div>
                <div>
                  • Você pode gerenciar detalhes de cobrança no Portal de Billing.
                </div>
              </div>
              {selectedPlan && (
                <div className="mt-4 rounded-md border p-3 text-sm">
                  <div className="font-medium">Novo plano</div>
                  <div className="flex items-center justify-between mt-1">
                    <span>{selectedPlan.name}</span>
                    <span>{formatCurrency(Number(selectedPlan.price))}</span>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowChangePlanModal(false); setSelectedPlan(null); }} disabled={changeBusy}>
                  Cancelar
                </Button>
                <Button onClick={() => selectedPlan && handleChangePlan(selectedPlan.id)} disabled={changeBusy}>
                  Confirmar mudança
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
