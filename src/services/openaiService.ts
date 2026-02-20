import { prisma } from '../config/database';

export class OpenAIService {
  private apiKey = process.env.OPENAI_API_KEY || '';
  private baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  private model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  async summarizeStepForLayman(step: any, context: { processTitle?: string; processNumber?: string }): Promise<string> {
    if (!this.isEnabled()) {
      return '';
    }
    const content = String(step?.content || '').trim();
    const when = String(step?.step_date || step?.updated_at || step?.created_at || '').trim();
    const cnj = String(step?.lawsuit_cnj || '').trim();
    const title = String(context?.processTitle || '').trim();
    const number = String(context?.processNumber || '').trim();
    const prompt = [
      'Você é um assistente jurídico que explica atualizações de processos de forma simples para pessoas leigas.',
      'Objetivo: Transformar o evento do processo em um texto curto (1–2 frases), claro e sem jargões.',
      'Requisitos:',
      '- Linguagem: Português do Brasil.',
      '- Tom: Calmo, informativo, direto.',
      '- Evite termos técnicos ou explique-os de forma simples.',
      '- Foque no impacto ou no que acontece em seguida (se aplicável).',
      'Dados do processo:',
      `- Título: ${title || 'N/A'}`,
      `- Número: ${number || cnj || 'N/A'}`,
      `- Data do passo: ${when || 'N/A'}`,
      `- Evento: ${content || 'N/A'}`,
      'Responda apenas com o texto simplificado (sem cabeçalhos ou aspas).'
    ].join('\n');
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'Você simplifica atualizações de processos jurídicos para leigos, de forma clara e curta.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 150
        })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OpenAI error: ${res.status} ${text}`);
      }
      const data: any = await res.json().catch(() => ({}));
      const answer = String(data?.choices?.[0]?.message?.content || '').trim();
      return answer;
    } catch (e) {
      return '';
    }
  }
}

export const openAIService = new OpenAIService();

