import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Calendar, Loader2 } from "lucide-react";
import { apiService } from "@/services/apiService";

type Mode = "cpf" | "cnj";

const TEST_RECAPTCHA_SITE_KEY = '6Ld_Z1osAAAAADMCJmhbl30r6KKUhAvEtXyhs0IW';

export function ClientPortal() {
  const [ mode, setMode ] = useState<Mode>("cnj");
  const [ cpf, setCpf ] = useState("");
  const [ cnj, setCnj ] = useState("");
  const [ loading, setLoading ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const [ requestId, setRequestId ] = useState<string | null>(null);
  const [ requestStatus, setRequestStatus ] = useState<string>("idle");
  const [ timeline, setTimeline ] = useState<Array<{ date?: string; title?: string; description?: string }>>([]);
  const [ lastUpdate, setLastUpdate ] = useState<{ date?: string; detail?: string; next?: string } | null>(null);
  const [ overallStatus, setOverallStatus ] = useState<string | null>(null);
  const [ processTitle, setProcessTitle ] = useState<string>("Processo");
  const [ processNumber, setProcessNumber ] = useState<string>("");
  const COOLDOWN_MS = 30000;
  const [ tick, setTick ] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const captchaRef = useRef<HTMLDivElement | null>(null);
  const [ captchaToken, setCaptchaToken ] = useState<string | null>(null);
  const [ captchaReady, setCaptchaReady ] = useState(false);

  useEffect(() => {
    const existing = document.querySelector('script[data-recaptcha="v2"]') as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-recaptcha", "v2");
      script.onload = () => {
        if ((window as any).grecaptcha && captchaRef.current) {
          const sitekey = TEST_RECAPTCHA_SITE_KEY;
          (window as any).grecaptcha.ready(() => {
            (window as any).grecaptcha.render(captchaRef.current!, {
              sitekey,
              callback: (token: string) => {
                setCaptchaToken(token);
              },
              "error-callback": () => setCaptchaToken(null),
              "expired-callback": () => setCaptchaToken(null),
            });
            setCaptchaReady(true);
          });
        }
      };
      document.body.appendChild(script);
    } else {
      if ((window as any).grecaptcha && captchaRef.current) {
        const sitekey = TEST_RECAPTCHA_SITE_KEY;
        (window as any).grecaptcha.ready(() => {
          (window as any).grecaptcha.render(captchaRef.current!, {
            sitekey,
            callback: (token: string) => setCaptchaToken(token),
            "error-callback": () => setCaptchaToken(null),
            "expired-callback": () => setCaptchaToken(null),
          });
          setCaptchaReady(true);
        });
      }
    }
  }, []);

  const canSubmit = useMemo(() => {
    const hasKey = mode === "cnj" ? !!cnj.trim() : !!cpf.trim();
    return hasKey && !!captchaToken && !loading;
  }, [ mode, cnj, cpf, captchaToken, loading ]);

  const parseResponses = (raw: any) => {
    const responses = Array.isArray(raw?.responses) ? raw.responses
      : Array.isArray(raw?.result) ? raw.result
        : Array.isArray(raw?.response_data) ? raw.response_data
          : Array.isArray(raw?.data) ? raw.data
            : [];
    const items = responses.map((it: any) => {
      const d = it?.response_data || it;
      const date = d?.date || d?.event_date || d?.created_at || d?.updated_at;
      const title = d?.title || d?.description || d?.summary || d?.event_title;
      const desc = d?.description || d?.summary || d?.details || d?.event_description;
      return { date, title, description: desc };
    });
    const sorted = items.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return tb - ta;
    });
    setTimeline(sorted);
    if (sorted.length > 0) {
      setLastUpdate({
        date: sorted[ 0 ].date,
        detail: sorted[ 0 ].description || sorted[ 0 ].title || "",
        next: sorted[ 1 ]?.title || "",
      });
    }
    try {
      const d0 = (responses?.[ 0 ]?.response_data || responses?.[ 0 ]) || {};
      const numero = d0?.lawsuit_cnj || d0?.code || cnj || "";
      setProcessNumber(String(numero || cnj || cpf || ""));
      const titulo = d0?.subject || d0?.title || "Processo";
      setProcessTitle(String(titulo));
    } catch { }
  };

  const fetchRequestStatus = async (id: string) => {
    try {
      const data = await apiService.getJuditRequest(id);
      const req = data?.request || {};
      setRequestStatus(String(req?.status || "pending"));
      setOverallStatus(req?.result?.request_status || req?.status || null);
      if (req?.result) {
        parseResponses(req.result);
      }
    } catch { }
  };

  const fetchHistory = async (type: string, key: string) => {
    try {
      const data = await apiService.lookupJuditHistoryPublic({ search_type: type, search_key: key });
      const tl = Array.isArray(data?.timeline) ? data.timeline : [];
      setTimeline(tl);
      setLastUpdate(data?.lastUpdate || null);
      setOverallStatus(data?.status || null);
      setProcessNumber(data?.processNumber || '');
      setProcessTitle(data?.processTitle || 'Processo');
    } catch { }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setTimeline([]);
    setLastUpdate(null);
    setOverallStatus(null);
    setRequestStatus("pending");
    try {
      const payload = mode === "cnj"
        ? { search: { search_type: "lawsuit_cnj", search_key: cnj.trim(), search_params: {} } }
        : { search: { search_type: "cpf", search_key: cpf.replace(/\D+/g, '').trim(), search_params: {} } };
      await Promise.all([
        apiService.createPublicJuditRequest(payload, true).catch(() => { }),
        fetchHistory(payload.search.search_type, payload.search.search_key)
      ]);
      setRequestId("started");
    } catch (e: any) {
      setError("Não foi possível criar a consulta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };
  const handleRefresh = async () => {
    const type = mode === "cnj" ? "lawsuit_cnj" : "cpf";
    const key = mode === "cnj" ? cnj.trim() : cpf.replace(/\D+/g, '').trim();
    const cooldownKey = `juditCooldownPortal:${type}:${key}`;
    const ts = Number(localStorage.getItem(cooldownKey) || 0);
    const left = Math.max(0, 30000 - (Date.now() - ts));
    if (left > 0) return;
    setLoading(true);
    try {
      localStorage.setItem(cooldownKey, String(Date.now()));
      await fetchHistory(type, key);
    } finally {
      setLoading(false);
    }
  };
  const handleBack = () => {
    setRequestId(null);
    setTimeline([]);
    setLastUpdate(null);
    setOverallStatus(null);
    setRequestStatus("idle");
    setError(null);
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#07090E", color: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="px-[40px] py-[24px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          {requestId && (
            <Button
              onClick={handleBack}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 12,
                background: "#1C2130",
                border: "1px solid #262B3A",
                color: "#FFFFFF"
              }}
            >
              Voltar
            </Button>
          )}
          <div className="text-[20px] font-semibold" style={{ color: "#FFFFFF" }}>
            HABEAS DESK • Acesso do Cliente
          </div>
        </div>
        <div
          className="text-[12px] font-semibold"
          style={{ padding: "6px 14px", borderRadius: 999, background: "rgba(46, 204, 113, 0.15)", color: "#2ECC71" }}
        >
          Acesso seguro
        </div>
      </header>

      <main className="px-[40px] py-[32px] space-y-[24px]">
        {!requestId && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px]">
            <div className="lg:col-span-5">
              <div
                className="rounded-[20px]"
                style={{ background: "#111522", border: "1px solid #262B3A", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
              >
                <div className="p-[24px]">
                  <div className="text-[32px] font-bold" style={{ color: "#FFFFFF", lineHeight: 1.2 }}>
                    Acompanhe seu processo
                  </div>
                  <div className="mb-[16px]" style={{ width: 56, height: 3, background: "#F5A100", borderRadius: 999 }} />
                  <div className="text-[14px] mb-[16px]" style={{ color: "#A0A5B1", lineHeight: 1.5 }}>
                    Entre com CPF ou número do processo para ver as atualizações de forma simples.
                  </div>
                  <div className="space-y-[16px]">
                    <div className="flex items-center gap-3">
                      <span className="inline-block rounded-full" style={{ width: 12, height: 12, border: "2px solid #F5A100" }} />
                      <div className="text-[14px]" style={{ color: "#FFFFFF" }}>Atualização clara</div>
                      <div className="text-[12px]" style={{ color: "#A0A5B1" }}>Sem termos difíceis.</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-block rounded-full" style={{ width: 12, height: 12, border: "2px solid #F5A100" }} />
                      <div className="text-[14px]" style={{ color: "#FFFFFF" }}>Último andamento</div>
                      <div className="text-[12px]" style={{ color: "#A0A5B1" }}>O que aconteceu e o que vem agora.</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-block rounded-full" style={{ width: 12, height: 12, border: "2px solid #F5A100" }} />
                      <div className="text-[14px]" style={{ color: "#FFFFFF" }}>Privacidade</div>
                      <div className="text-[12px]" style={{ color: "#A0A5B1" }}>Dados usados só para consulta.</div>
                    </div>
                  </div>
                  <div
                    className="mt-[16px]"
                    style={{
                      height: 16,
                      borderRadius: 12,
                      background: "linear-gradient(90deg, #F5A100 0%, #FFB733 50%, rgba(245,161,0,0.2) 100%)"
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="lg:col-span-7">
              <div
                className="rounded-[20px]"
                style={{ background: "#111522", border: "1px solid #262B3A", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
              >
                <div className="p-[24px] space-y-[16px]">
                  <div className="text-[20px] font-semibold" style={{ color: "#FFFFFF" }}>Entrar</div>
                  <div style={{ width: 48, height: 3, background: "#F5A100", borderRadius: 999 }} />
                  <div className="text-[14px]" style={{ color: "#A0A5B1" }}>Escolha como deseja acessar.</div>
                  <div style={{ width: 40, height: 2, background: "#F5A100", borderRadius: 999 }} />
                  <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                    <TabsList
                      className="w-full"
                      style={{
                        background: "#141A2A",
                        border: "1px solid #262B3A",
                        borderRadius: 12,
                        padding: 6
                      }}
                    >
                      <TabsTrigger
                        value="cpf"
                        className="w-1/2 data-[state=active]:bg-[#202941] data-[state=active]:!text-white "
                        style={{
                          color: "#A0A5B1"
                        }}
                      >
                        CPF
                      </TabsTrigger>
                      <div className="mx-2 h-6" style={{ width: 2, background: "#F5A100", borderRadius: 999 }} />
                      <TabsTrigger
                        value="cnj"
                        className="w-1/2 data-[state=active]:bg-[#202941] data-[state=active]:!text-white "
                        style={{
                          color: "#A0A5B1"
                        }}
                      >
                        Nº do Processo
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="cpf" className="space-y-[16px]">
                      <div className="space-y-2">
                        <Label style={{ color: "#A0A5B1" }}>CPF</Label>
                        <Input
                          placeholder="000.000.000-00"
                          value={cpf}
                          onChange={(e) => setCpf(e.target.value.replace(/\D+/g, ''))}
                          className="h-11"
                          style={{ background: "#141A2A", borderColor: "#262B3A", color: "#FFFFFF" }}
                        />
                        <div className="text-[12px]" style={{ color: "#7C8191" }}>
                          Digite apenas números (sem pontos ou traços)
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="cnj" className="space-y-[16px]">
                      <div className="space-y-2">
                        <Label style={{ color: "#A0A5B1" }}>Número do processo (formato padrão)</Label>
                        <Input
                          placeholder="0000000-00.0000.0.00.0000"
                          value={cnj}
                          onChange={(e) => setCnj(e.target.value)}
                          className="h-11"
                          style={{ background: "#141A2A", borderColor: "#262B3A", color: "#FFFFFF" }}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-2">
                    <Label style={{ color: "#A0A5B1" }}>Verificação</Label>
                    <div ref={captchaRef} className="w-full"></div>
                    {!captchaToken && (
                      <div className="text-[12px] flex items-center gap-2" style={{ color: "#7C8191" }}>
                        <AlertCircle className="h-3 w-3" /> Confirme o reCAPTCHA para continuar.
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="text-[14px] flex items-center gap-2" style={{ color: "#FF6B6B" }}>
                      <AlertCircle className="h-4 w-4" /> {error}
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="w-full h-11"
                    style={{
                      background: "#1C2130",
                      borderColor: "#262B3A",
                      color: "#FFFFFF",
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderRadius: 12
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Acessando...
                      </>
                    ) : (
                      <>Acessar</>
                    )}
                  </Button>
                  {!canSubmit && (
                    <style>{`
                      button[disabled] {
                        opacity: 0.4 !important;
                        cursor: default !important;
                      }
                    `}</style>
                  )}

                  <div className="text-[12px]" style={{ color: "#7C8191" }}>
                    Seus dados são usados apenas para consulta.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {requestId && (
          <div className="space-y-[24px]">
            <div
              className="rounded-[20px] p-[24px] flex items-start justify-between"
              style={{ background: "#111522", border: "1px solid #262B3A", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
            >
              <div className="space-y-[8px]">
                <div className="text-[32px] font-bold" style={{ color: "#FFFFFF", lineHeight: 1.2 }}>
                  {processTitle}
                </div>
                <div className="text-[14px]" style={{ color: "#A0A5B1" }}>
                  Nº {processNumber || cnj}
                </div>
              </div>
              <div
                className="text-[12px] font-semibold mt-[6px]"
                style={{ padding: "6px 14px", borderRadius: 999, background: "rgba(46, 204, 113, 0.15)", color: "#2ECC71" }}
              >
                {overallStatus || "Em andamento"}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px]">
              <div className="lg:col-span-5">
                <div
                  className="rounded-[20px] p-[24px]"
                  style={{ background: "#111522", border: "1px solid #262B3A", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
                >
                  <div className="text-[20px] font-semibold mb-[16px]" style={{ color: "#FFFFFF" }}>
                    Linha do tempo
                  </div>
                  <div className="relative pl-6" style={{ borderLeft: "2px solid #262B3A" }}>
                    {timeline.length === 0 && (
                      <div className="text-[12px]" style={{ color: "#7C8191" }}>Sem eventos ainda.</div>
                    )}
                    <div className="space-y-[20px]">
                      {timeline.map((ev, idx) => (
                        <div key={idx} className="relative">
                          <span
                            className="absolute -left-[7px] rounded-full"
                            style={{
                              width: idx === 0 ? 8 : 6,
                              height: idx === 0 ? 8 : 6,
                              background: idx === 0 ? "#F5A100" : "#7C8191",
                              top: 2
                            }}
                          />
                          <div className="text-[12px] flex items-center gap-2" style={{ color: "#A0A5B1" }}>
                            <Calendar className="h-3 w-3" />
                            {ev.date ? new Date(ev.date).toLocaleDateString("pt-BR") : "Sem data"}
                          </div>
                          <div className="text-[14px] mt-1" style={{ color: "#FFFFFF" }}>
                            {ev.title || "Atualização"}
                          </div>
                          {ev.description && (
                            <div className="text-[14px]" style={{ color: "#A0A5B1" }}>
                              {ev.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div
                  className="rounded-[20px] p-[24px] space-y-[16px]"
                  style={{ background: "#111522", border: "1px solid #262B3A", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[20px] font-semibold" style={{ color: "#FFFFFF" }}>
                      Última atualização (detalhes)
                    </div>
                    <Button
                      onClick={handleRefresh}
                      disabled={(() => {
                        const type = mode === "cnj" ? "lawsuit_cnj" : "cpf";
                        const key = mode === "cnj" ? cnj.trim() : cpf.replace(/\D+/g, '').trim();
                        const cooldownKey = `juditCooldownPortal:${type}:${key}`;
                        const ts = Number(localStorage.getItem(cooldownKey) || 0);
                        const left = Math.max(0, COOLDOWN_MS - (Date.now() - ts));
                        return left > 0;
                      })()}
                      style={{
                        height: 36,
                        padding: "0 16px",
                        borderRadius: 12,
                        background: "#1C2130",
                        border: "1px solid #262B3A",
                        color: "#FFFFFF"
                      }}
                    >
                      {(() => {
                        const type = mode === "cnj" ? "lawsuit_cnj" : "cpf";
                        const key = mode === "cnj" ? cnj.trim() : cpf.replace(/\D+/g, '').trim();
                        const cooldownKey = `juditCooldownPortal:${type}:${key}`;
                        const ts = Number(localStorage.getItem(cooldownKey) || 0);
                        const left = Math.max(0, COOLDOWN_MS - (Date.now() - ts));
                        return left > 0 ? `Aguardar ${Math.ceil(left / 1000)}s` : 'Atualizar';
                      })()}
                    </Button>
                  </div>
                  <div
                    className="space-y-3"
                    style={{ borderRadius: 14, background: "#141A2A", border: "1px solid #262B3A", padding: 16 }}
                  >
                    <div className="text-[12px]" style={{ color: "#A0A5B1" }}>
                      {lastUpdate?.date ? new Date(lastUpdate.date).toLocaleDateString("pt-BR") : "Sem data"}
                    </div>
                    <div className="text-[14px]" style={{ color: "#FFFFFF" }}>
                      {lastUpdate?.detail || "Nenhum detalhe disponível."}
                    </div>
                  </div>
                  <div
                    style={{ borderRadius: 14, background: "#141A2A", border: "1px solid #262B3A", padding: 16 }}
                  >
                    <div className="text-[14px]" style={{ color: "#FFFFFF" }}>
                      Próximo passo
                    </div>
                    <div className="text-[14px]" style={{ color: "#A0A5B1" }}>
                      {(lastUpdate as any)?.aiSummary || lastUpdate?.next || "Aguardando nova atualização"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="px-[40px] pb-[32px]">
        <div className="text-[12px]" style={{ color: "#7C8191", paddingTop: 24 }}>
          Habeas Desk • Portal do Cliente
        </div>
      </footer>
    </div>
  );
}
