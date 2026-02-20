import React, { useEffect, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminApi } from '../hooks/useAdminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlugZap, Trash2, Send, RefreshCcw, QrCode } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function AdminEvolution() {
  const api = useAdminApi();
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [instanceNameToCreate, setInstanceNameToCreate] = useState('');
  const [createToken, setCreateToken] = useState('');
  const [instances, setInstances] = useState<Array<{ name: string }>>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [deleteToken, setDeleteToken] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [qr, setQr] = useState<string>('');
  const [text, setText] = useState('');
  const [connectedNumber, setConnectedNumber] = useState<string>('');
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrInstance, setQrInstance] = useState<string>('');
  const [qrCount, setQrCount] = useState<number | null>(null);
  const [currentInfo, setCurrentInfo] = useState<{ selectedInstance: string | null; info: any } | null>(null);

  const handleCreate = async () => {
    const res = await api.evolutionCreateInstance({ instanceName: instanceNameToCreate, token: createToken });
    setStatus(res?.result || res);
    await handleFetchAll();
  };

  const handleConnect = async () => {
    const res = await api.evolutionConnectInstance(selectedInstance);
    setStatus(res?.result || res);
    const body = res?.result ?? res ?? {};
    const qrRaw = body?.base64 ?? body?.qrcode ?? body?.qrCode ?? body?.qr_code ?? body?.qr ?? '';
    const codeOnly = body?.code;
    const count = typeof body?.count === 'number' ? body?.count : null;
    const img = (typeof qrRaw === 'string' && qrRaw) ? (qrRaw.startsWith('data:') ? qrRaw : `data:image/png;base64,${qrRaw}`) :
      (typeof codeOnly === 'string' && codeOnly ? `data:image/png;base64,${codeOnly}` : '');
    const number = body?.number ?? body?.phone ?? body?.instance?.number ?? body?.connection?.number ?? '';
    if (img) {
      setQr(img);
      setQrInstance(selectedInstance);
      setQrCount(count);
      setShowQrDialog(true);
    }
    if (number) setConnectedNumber(number);
  };

  const handleGenerateQR = async () => {
    const res = await api.evolutionConnectInstance(selectedInstance);
    setStatus(res?.result || res);
    const body = res?.result ?? res ?? {};
    const qrRaw = body?.base64 ?? body?.qrcode ?? body?.qrCode ?? body?.qr_code ?? body?.qr ?? '';
    const codeOnly = body?.code;
    const count = typeof body?.count === 'number' ? body?.count : null;
    const img = (typeof qrRaw === 'string' && qrRaw) ? (qrRaw.startsWith('data:') ? qrRaw : `data:image/png;base64,${qrRaw}`) :
      (typeof codeOnly === 'string' && codeOnly ? `data:image/png;base64,${codeOnly}` : '');
    const number = body?.number ?? body?.phone ?? body?.instance?.number ?? body?.connection?.number ?? '';
    if (img) {
      setQr(img);
      setQrInstance(selectedInstance);
      setQrCount(count);
      setShowQrDialog(true);
    }
    if (number) setConnectedNumber(number);
  };

  const handleWebhook = async () => {
    const res = await api.evolutionConnectWebhook(selectedInstance);
    setStatus(res?.result || res);
  };

  const handleDelete = async () => {
    const res = await api.evolutionDeleteInstance({ instanceName: selectedInstance, token: deleteToken });
    setStatus(res?.result || res);
    await handleFetchAll();
  };

  const handleSetCurrent = async () => {
    try {
      if (!tenantId || !selectedInstance) {
        alert('Selecione o Tenant e a Instância para definir como atual');
        return;
      }
      const res = await api.evolutionSetSelectedInstance(tenantId, selectedInstance);
      setStatus(res);
      await handleLoadCurrent();
      alert(`Instância "${selectedInstance}" definida como atual para o tenant.`);
    } catch {
      alert('Falha ao definir instância como atual. Verifique os dados e tente novamente.');
    }
  };

  const handleLoadCurrent = async () => {
    if (!tenantId) return;
    const data = await api.evolutionGetSelectedInstance(tenantId);
    setCurrentInfo(data);
  };

  const handleFetchAll = async () => {
    const res = await api.evolutionFetchInstances('');
    setStatus(res?.result || res);
    const listRaw = res?.result ?? res;
    const items: Array<{ name: string }> = Array.isArray(listRaw)
      ? listRaw.map((it: any) => ({ name: it?.instanceName || it?.name || it?.instance?.name || String(it) }))
      : Array.isArray(listRaw?.instances) ? listRaw.instances.map((it: any) => ({ name: it?.instanceName || it?.name }))
        : [];
    const uniq = Array.from(new Set(items.map(i => i.name))).filter(Boolean).map(n => ({ name: n }));
    setInstances(uniq);
    if (!selectedInstance && uniq.length > 0) setSelectedInstance(uniq[0].name);
  };

  const handleSend = async () => {
    const res = await api.evolutionSendMessage({ instanceName: selectedInstance, number: connectedNumber || '', text });
    setStatus(res?.result || res);
  };

  const qrSrc = qr ? (qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`) : '';

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getTenants();
        const arr = Array.isArray(list) ? list : (list as any)?.tenants || [];
        const mapped = arr.map((t: any) => ({ id: t.id, name: t.name }));
        setTenants(mapped);
        if (!tenantId && mapped.length > 0) setTenantId(mapped[0].id);
      } catch { }
      handleFetchAll().catch(() => void 0);
    })();
  }, []);

  useEffect(() => {
    handleLoadCurrent().catch(() => void 0);
  }, [tenantId]);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 bg-[#1B223C] min-h-screen">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Evolution API</h1>
          <p className="text-sm text-gray-400 mt-1">Conecte um número WhatsApp na Evolution e gerencie a instância.</p>
        </div>

        <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-white">Instâncias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger className="bg-[#1B223C] border-gray-700 text-white">
                    <SelectValue placeholder="Selecione o tenant" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2F45] border-gray-700">
                    {tenants.length === 0 ? (
                      <SelectItem value="null" disabled className="text-gray-400">Nenhum tenant</SelectItem>
                    ) : tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-white focus:bg-[#1B223C]">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Criar nova instância</Label>
                <Input
                  value={instanceNameToCreate}
                  onChange={(e) => setInstanceNameToCreate(e.target.value)}
                  placeholder="ex: tenant-001"
                  className="bg-[#1B223C] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Token</Label>
                <Input
                  value={createToken}
                  onChange={(e) => setCreateToken(e.target.value)}
                  placeholder="token da instância"
                  className="bg-[#1B223C] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} className="w-full bg-[#e19a00] hover:bg-[#c78b00] text-white">
                  <PlugZap className="h-4 w-4 mr-2" /> Criar instância
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-gray-300">Instância selecionada</Label>
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger className="bg-[#1B223C] border-gray-700 text-white">
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#2A2F45] border-gray-700">
                    {instances.length === 0 ? (
                      <SelectItem value="null" disabled className="text-gray-400">Nenhuma instância</SelectItem>
                    ) : instances.map((i) => (
                      <SelectItem key={i.name} value={i.name} className="text-white focus:bg-[#1B223C]">{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Token (excluir)</Label>
                <Input
                  value={deleteToken}
                  onChange={(e) => setDeleteToken(e.target.value)}
                  placeholder="forneça para excluir"
                  className="bg-[#1B223C] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button variant="destructive" onClick={handleDelete} className="flex-1 sm:flex-none">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
                <Button variant="outline" onClick={handleFetchAll} className="border-gray-600 text-gray-300 hover:bg-[#1B223C]">
                  Atualizar lista
                </Button>
                <Button variant="outline" onClick={handleSetCurrent} className="border-gray-600 text-gray-300 hover:bg-[#1B223C]">
                  Definir como atual
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2A2F45] border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-white">QR Code e Mensagens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentInfo && (
              <div className="rounded-lg border border-gray-700 p-4 bg-[#1B223C]/50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-400">Instância atual</div>
                    <div className="text-lg font-semibold text-white">{currentInfo.selectedInstance || '—'}</div>
                  </div>
                  {currentInfo.info?.profilePicUrl ? (
                    <img src={currentInfo.info.profilePicUrl} alt="Perfil" className="h-12 w-12 rounded-full border border-gray-700" />
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm text-gray-300">
                  <div><strong className="text-gray-400">Número:</strong> {currentInfo.info?.number || '—'}</div>
                  <div><strong className="text-gray-400">Nome:</strong> {currentInfo.info?.profileName || '—'}</div>
                  <div><strong className="text-gray-400">Status:</strong> {currentInfo.info?.connectionStatus || '—'}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>Se necessário, escaneie o QR pelo app do WhatsApp</span>
              <QrCode className="h-5 w-5 text-[#e19a00]" />
            </div>
            {qrSrc ? (
              <div className="space-y-2">
                <img src={qrSrc} alt="QR code" className="border border-gray-700 rounded-md max-w-xs" />
                <div className="text-xs text-gray-500">
                  Abra o WhatsApp no seu celular, vá em Dispositivos conectados e escaneie o QR.
                </div>
                {connectedNumber && <div className="text-sm text-gray-400">Número conectado: {connectedNumber}</div>}
                <Button variant="outline" size="sm" onClick={handleGenerateQR} className="border-gray-600 text-gray-300 hover:bg-[#1B223C]">
                  <RefreshCcw className="h-3 w-3 mr-2" /> Atualizar QR
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleGenerateQR} className="border-gray-600 text-gray-300 hover:bg-[#1B223C]">
                <QrCode className="h-4 w-4 mr-2" /> Gerar QR Code
              </Button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Número do destinatário</Label>
                <Input
                  value={connectedNumber}
                  onChange={(e) => setConnectedNumber(e.target.value)}
                  placeholder="5521999999999"
                  className="bg-[#1B223C] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-gray-300">Mensagem</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Olá, esta é uma mensagem de teste."
                    className="bg-[#1B223C] border-gray-700 text-white placeholder:text-gray-500 flex-1"
                  />
                  <Button onClick={handleSend} className="bg-[#e19a00] hover:bg-[#c78b00] text-white shrink-0">
                    <Send className="h-4 w-4 mr-2" /> Enviar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="max-w-md bg-[#2A2F45] border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Conectar WhatsApp</DialogTitle>
              <DialogDescription className="text-gray-400">
                Instância: {qrInstance} {qrCount != null ? `• expira em ~${qrCount}s` : ''}
              </DialogDescription>
            </DialogHeader>
            {qr ? (
              <div className="space-y-3">
                <img src={qr} alt="QR Code" className="border border-gray-700 rounded-md w-full" />
                <div className="text-xs text-gray-500">
                  Abra o WhatsApp no seu celular, vá em Dispositivos conectados e escaneie o QR.
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">QR não disponível</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
