export class EvolutionService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly appUrl: string;
  constructor() {
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.apiUrl = process.env.EVOLUTION_API_URL || '';
    this.appUrl = process.env.APP_URL || '';
  }
  private formatPhoneToWhatsApp(number: string) {
    const digits = String(number || '').replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  }
  async createInstance(params: { instanceName: string; integration?: string; number?: string | null; token: string }) {
    const body: any = {
      instanceName: params.instanceName,
      integration: params.integration || 'WHATSAPP-BAILEYS',
      token: params.token,
    };
    if (params.number) body.number = params.number;
    const res = await fetch(`${this.apiUrl}/instance/create`, {
      method: 'POST',
      headers: { apiKey: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok, status: res.status, body: text }; }
  }
  async sendMessage(params: { instanceName: string; number: string; text: string }) {
    console.log("🚀 ~ EvolutionService ~ createInstance ~ this.apiUrl:", this.apiUrl)

    const res = await fetch(`${this.apiUrl}/message/sendText/${encodeURIComponent(params.instanceName)}`, {
      method: 'POST',
      headers: { apiKey: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: this.formatPhoneToWhatsApp(params.number), text: params.text }),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok, status: res.status, body: text }; }
  }

  async deleteInstance(params: { instanceName: string; token: string }) {
    const res = await fetch(`${this.apiUrl}/instance/delete/${encodeURIComponent(params.instanceName)}`, {
      method: 'DELETE',
      headers: { apiKey: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token }),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok, status: res.status, body: text }; }
  }

  async fetchInstances(params: { instanceName: string }) {
    const res = await fetch(`${this.apiUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(params.instanceName)}`, {
      method: 'GET',
      headers: { apiKey: this.apiKey },
    });
    if (!res.ok) throw new Error(`Evolution fetchInstances failed: ${res.status}`);
    return await res.json();
  }

  async connectInstance(params: { instanceName: string }) {
    const res = await fetch(`${this.apiUrl}/instance/connect/${encodeURIComponent(params.instanceName)}`, {
      method: 'GET',
      headers: { apiKey: this.apiKey },
    });
    if (!res.ok) throw new Error(`Evolution connect failed: ${res.status}`);
    return await res.json();
  }

  async connectWebhook(params: { instanceName: string }) {
    const res = await fetch(`${this.apiUrl}/webhook/set/${encodeURIComponent(params.instanceName)}`, {
      method: 'POST',
      headers: { apiKey: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: `${this.appUrl}/api/v1/messaging/webhook`,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'QRCODE_UPDATED',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'SEND_MESSAGE',
            'CONNECTION_UPDATE',
            'TYPEBOT_START',
            'TYPEBOT_CHANGE_STATUS',
          ],
        },
      }),
    });
    if (!res.ok) throw new Error(`Evolution connectWebhook failed: ${res.status}`);
    return await res.json();
  }
}
export const evolutionService = new EvolutionService();

