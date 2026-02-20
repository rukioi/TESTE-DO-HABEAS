import React, { useEffect, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAdminApi } from '../hooks/useAdminApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PlugZap, Link2, Phone, QrCode, Trash2, Send, RefreshCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function AdminEvolution() {
  const api = useAdminApi();
  const [ tenantId, setTenantId ] = useState('');
  const [ tenants, setTenants ] = useState<Array<{ id: string; name: string }>>([]);
  const [ instanceNameToCreate, setInstanceNameToCreate ] = useState('');
  const [ createToken, setCreateToken ] = useState('');
  const [ instances, setInstances ] = useState<Array<{ name: string }>>([]);
  const [ selectedInstance, setSelectedInstance ] = useState<string>('');
  const [ deleteToken, setDeleteToken ] = useState('');
  const [ status, setStatus ] = useState<any>(null);
  const [ qr, setQr ] = useState<string>('');
  const [ text, setText ] = useState('');
  const [ connectedNumber, setConnectedNumber ] = useState<string>('');
  const [ showQrDialog, setShowQrDialog ] = useState(false);
  const [ qrInstance, setQrInstance ] = useState<string>('');
  const [ qrCount, setQrCount ] = useState<number | null>(null);
  const [ currentInfo, setCurrentInfo ] = useState<{ selectedInstance: string | null; info: any } | null>(null);

  const handleCreate = async () => {
    const res = await api.evolutionCreateInstance({ instanceName: instanceNameToCreate, token: createToken });
    setStatus(res?.result || res);
    await handleFetchAll();
  };
  const extractQrAndNumber = (res: any) => {
    const body = res?.result ?? res ?? {};
    const qrRaw = body?.base64 ?? body?.qrcode ?? body?.qrCode ?? body?.qr_code ?? body?.qr ?? '';
    const qr = typeof qrRaw === 'string' ? qrRaw : '';
    const num = body?.number ?? body?.phone ?? body?.instance?.number ?? body?.connection?.number ?? '';
    const codeOnly = body?.code;
    const count = typeof body?.count === 'number' ? body?.count : null;
    const img = qr
      ? (qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`)
      : (typeof codeOnly === 'string' && codeOnly ? `data:image/png;base64,${codeOnly}` : '');
    return { qr, number: typeof num === 'string' ? num : '' };
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
  const handleRowConnectQR = async (name: string) => {
    const res = await api.evolutionConnectInstance(name);
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
      setQrInstance(name);
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
    if (!selectedInstance && uniq.length > 0) setSelectedInstance(uniq[ 0 ].name);
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
        // @ts-expect-error expected er
        const arr = Array.isArray(list) ? list : (list?.tenants || []);
        const mapped = arr.map((t: any) => ({ id: t.id, name: t.name }));
        setTenants(mapped);
        if (!tenantId && mapped.length > 0) setTenantId(mapped[ 0 ].id);
      } catch { }
      handleFetchAll().catch(() => void 0);
    })();
  }, []);
  useEffect(() => {
    handleLoadCurrent().catch(() => void 0);
  }, [ tenantId ]);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Evolution API</h1>
        <p className="text-muted-foreground">Conecte um número WhatsApp na Evolution e gerencie a instância.</p>
        <Card className="border">
          <CardHeader>
            <CardTitle>Instâncias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.length === 0 ? (
                      <SelectItem value="null" disabled>Nenhum tenant</SelectItem>
                    ) : tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Criar nova instância</Label>
                <Input value={instanceNameToCreate} onChange={(e) => setInstanceNameToCreate(e.target.value)} placeholder="ex: tenant-001" />
              </div>
              <div>
                <Label>Token</Label>
                <Input value={createToken} onChange={(e) => setCreateToken(e.target.value)} placeholder="token da instância" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreate} className="w-full"><PlugZap className="h-4 w-4 mr-2" /> Criar instância</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label className='mb-2 block'>Instância selecionada</Label>
                <Label>Instância selecionada</Label>
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.length === 0 ? (
                      <SelectItem value="null" disabled>Nenhuma instância</SelectItem>
                    ) : instances.map((i) => (
                      <SelectItem key={i.name} value={i.name}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Token (excluir)</Label>
                <Input value={deleteToken} onChange={(e) => setDeleteToken(e.target.value)} placeholder="forneça para excluir" />
              </div>
              <div className="flex flex-wrap gap-2">

                {/* <Button variant="outline" onClick={handleWebhook}><Phone className="h-4 w-4 mr-2" /> Conectar Webhook</Button> */}
                <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" /> Excluir</Button>
                <Button variant="outline" onClick={handleFetchAll}>Atualizar lista</Button>
                <Button variant="outline" onClick={handleSetCurrent}>Definir como atual</Button>
                {/* <Button variant="outline" onClick={handleLoadCurrent}>Carregar atual</Button> */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle>Instâncias cadastradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {instances.length === 0 ? (
              <Badge variant="outline">Nenhuma instância cadastrada</Badge>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((i) => (
                      <tr key={i.name} className="border-t">
                        <td className="p-2">{i.name}</td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleRowConnectQR(i.name)}>
                              <QrCode className="h-3 w-3 mr-2" />
                              Conectar QR Code
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { setSelectedInstance(i.name); handleWebhook(); }}>
                              <Phone className="h-3 w-3 mr-2" />
                              Webhook
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card> */}

        <Card className="border">
          <CardHeader>
            <CardTitle>QR Code e Mensagens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentInfo && (
              <div className="rounded-md border p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Instância atual</div>
                    <div className="text-lg font-semibold">{currentInfo.selectedInstance || '—'}</div>
                  </div>
                  {currentInfo.info?.profilePicUrl ? (
                    <img src={currentInfo.info.profilePicUrl} alt="Perfil" className="h-12 w-12 rounded-full border" />
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                  <div><strong>Número:</strong> {currentInfo.info?.number || '—'}</div>
                  <div><strong>Nome:</strong> {currentInfo.info?.profileName || '—'}</div>
                  <div><strong>Status:</strong> {currentInfo.info?.connectionStatus || '—'}</div>
                </div>
              </div>
            )}
            <div className="flex items-center  gap-4">
              <span className="text-sm text-muted-foreground">Se necessário, escaneie o QR pelo app do WhatsApp</span>
              <QrCode className="h-5 w-5" />
            </div>
            {qrSrc ? (
              <div className="space-y-2">
                <img src={qrSrc} alt="QR code" className="border rounded-md max-w-xs" />
                <div className="text-xs text-muted-foreground">
                  Abra o WhatsApp no seu celular, vá em Dispositivos conectados e escaneie o QR.
                </div>
                <div className="text-sm">
                  {connectedNumber ? `Número conectado: ${connectedNumber}` : ''}
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateQR}>
                  <RefreshCcw className="h-3 w-3 mr-2" />
                  Atualizar QR
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleGenerateQR}><QrCode className="h-4 w-4 mr-2" /> Gerar QR Code</Button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Número do destinatário</Label>
                <Input value={connectedNumber} onChange={(e) => setConnectedNumber(e.target.value)} placeholder="5521999999999" />
              </div>
              <div className="md:col-span-2">
                <Label>Mensagem</Label>
                <div className="flex gap-2">
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Olá, esta é uma mensagem de teste." />
                  <Button onClick={handleSend}><Send className="h-4 w-4 mr-2" /> Enviar</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle>Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-64">{JSON.stringify(status ?? {}, null, 2)}</pre>
          </CardContent>
        </Card> */}

        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
              <DialogDescription>Instância: {qrInstance} {qrCount != null ? `• expira em ~${qrCount}s` : ''}</DialogDescription>
            </DialogHeader>
            {qr ? (
              <div className="space-y-3">
                <img src={qr} alt="QR Code" className="border rounded-md w-full" />
                <div className="text-xs text-muted-foreground">
                  Abra o WhatsApp no seu celular, vá em Dispositivos conectados e escaneie o QR.
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">QR não disponível</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
