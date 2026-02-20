import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiService } from "@/services/apiService";
import { FileSearch, Scale, Building2, Calendar, User, RefreshCw, ArrowLeft, Maximize2 } from "lucide-react";

export function JuditRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ request, setRequest ] = React.useState<any | null>(null);
  const [ loading, setLoading ] = React.useState(true);
  const [ refreshing, setRefreshing ] = React.useState(false);
  const [ summaryDialogOpen, setSummaryDialogOpen ] = React.useState(false);
  const [ stepsDialogOpen, setStepsDialogOpen ] = React.useState(false);
  const [ stepsDialogData, setStepsDialogData ] = React.useState<{ code?: string; tribunal?: string; steps: any[] } | null>(null);

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiService.getJuditRequest(id);
      setRequest(data?.request || null);
    } finally {
      setLoading(false);
    }
  }, [ id ]);

  const COOLDOWN_MS = 30000;
  const cooldownKey = `juditCooldownReq:${id || ''}`;
  const [ tick, setTick ] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const remainingMs = (() => {
    const ts = Number(localStorage.getItem(cooldownKey) || 0);
    const diff = Date.now() - ts;
    const left = COOLDOWN_MS - diff;
    return Math.max(0, left);
  })();
  const locked = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  React.useEffect(() => {
    load();
  }, [ load ]);

  const handleRefresh = async () => {
    if (!id) return;
    if (locked) return;
    setRefreshing(true);
    try {
      localStorage.setItem(cooldownKey, String(Date.now()));
      await apiService.refreshJuditRequest(id);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const fmtDate = (v?: string) => {
    if (!v) return "";
    const d = new Date(v);
    return d.toLocaleString("pt-BR");
  };

  const result = request?.result || {};
  const search = request?.search || {};
  const pageData: any[] = Array.isArray(result?.page_data) ? result.page_data : [];
  const status = result?.request_status || request?.status || "pending";
  const sanitizeHtml = (html?: string): string => {
    if (!html || typeof html !== "string") return "";
    const allowed = new Set([
      "p", "br", "strong", "b", "em", "i", "u", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "code", "pre", "span", "a"
    ]);
    const parserAvailable = typeof DOMParser !== "undefined";
    try {
      if (parserAvailable) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const body = doc?.body;
        if (!body) return html.replace(/<[^>]+>/g, " ").trim();
        const walk = (node: Node) => {
          if (node.nodeType === 1) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();
            if (!allowed.has(tag)) {
              const parent = el.parentNode;
              while (el.firstChild) parent?.insertBefore(el.firstChild, el);
              parent?.removeChild(el);
              return;
            }
            Array.from(el.attributes).forEach(attr => {
              const name = attr.name.toLowerCase();
              const value = attr.value;
              if (tag === "a" && name === "href") {
                const v = value.trim();
                const isJs = /^javascript:/i.test(v);
                if (isJs) el.removeAttribute(name);
              } else {
                el.removeAttribute(name);
              }
            });
          }
          Array.from(node.childNodes).forEach(walk);
        };
        walk(body);
        return body.innerHTML || "";
      }
    } catch { }
    try {
      const div = typeof document !== "undefined" ? document.createElement("div") : null;
      if (!div) return "";
      div.innerHTML = html;
      const walk = (node: Node) => {
        if (node.nodeType === 1) {
          const el = node as Element;
          const tag = el.tagName.toLowerCase();
          if (!allowed.has(tag)) {
            const parent = el.parentNode;
            while (el.firstChild) parent?.insertBefore(el.firstChild, el);
            parent?.removeChild(el);
            return;
          }
          Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            if (!(tag === "a" && name === "href")) {
              el.removeAttribute(name);
            } else {
              const v = el.getAttribute("href") || "";
              if (/^javascript:/i.test(v)) el.removeAttribute("href");
            }
          });
        }
        Array.from(node.childNodes).forEach(walk);
      };
      walk(div);
      return div.innerHTML || "";
    } catch { }
    return html.replace(/<[^>]+>/g, " ").trim();
  };
  const toMarkdownFromHtml = (html?: string): string => {
    if (!html || typeof html !== "string") return "";
    let s = html;
    s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
    s = s.replace(/<\s*strong[^>]*>(.*?)<\s*\/\s*strong\s*>/gi, "**$1**");
    s = s.replace(/<\s*em[^>]*>(.*?)<\s*\/\s*em\s*>/gi, "*$1*");
    s = s.replace(/<\s*b[^>]*>(.*?)<\s*\/\s*b\s*>/gi, "**$1**");
    s = s.replace(/<\s*i[^>]*>(.*?)<\s*\/\s*i\s*>/gi, "*$1*");
    s = s.replace(/<\s*h1[^>]*>(.*?)<\s*\/\s*h1\s*>/gi, "# $1\n");
    s = s.replace(/<\s*h2[^>]*>(.*?)<\s*\/\s*h2\s*>/gi, "## $1\n");
    s = s.replace(/<\s*h3[^>]*>(.*?)<\s*\/\s*h3\s*>/gi, "### $1\n");
    s = s.replace(/<\s*h4[^>]*>(.*?)<\s*\/\s*h4\s*>/gi, "#### $1\n");
    s = s.replace(/<\s*h5[^>]*>(.*?)<\s*\/\s*h5\s*>/gi, "##### $1\n");
    s = s.replace(/<\s*h6[^>]*>(.*?)<\s*\/\s*h6\s*>/gi, "###### $1\n");
    s = s.replace(/<\s*blockquote[^>]*>(.*?)<\s*\/\s*blockquote\s*>/gis, "> $1\n");
    s = s.replace(/<\s*code[^>]*>(.*?)<\s*\/\s*code\s*>/gis, "`$1`");
    s = s.replace(/<\s*pre[^>]*>(.*?)<\s*\/\s*pre\s*>/gis, "```\n$1\n```");
    s = s.replace(/<\s*li[^>]*>(.*?)<\s*\/\s*li\s*>/gi, "- $1\n");
    s = s.replace(/<\s*ul[^>]*>(.*?)<\s*\/\s*ul\s*>/gis, "$1\n");
    s = s.replace(/<\s*ol[^>]*>(.*?)<\s*\/\s*ol\s*>/gis, "$1\n");
    s = s.replace(/<\s*a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\s*\/\s*a\s*>/gi, "[$2]($1)");
    s = s.replace(/<[^>]+>/g, " ");
    return s;
  };
  const markdownToHtml = (md?: string): string => {
    if (!md || typeof md !== "string") return "";
    const escape = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let text = md.replace(/\r\n/g, "\n").replace(/\t/g, "    ");
    text = text.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre><code>${escape(code)}</code></pre>`);
    text = text.replace(/^######\s+(.*)$/gm, "<h6>$1</h6>");
    text = text.replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>");
    text = text.replace(/^####\s+(.*)$/gm, "<h4>$1</h4>");
    text = text.replace(/^###\s+(.*)$/gm, "<h3>$1</h3>");
    text = text.replace(/^##\s+(.*)$/gm, "<h2>$1</h2>");
    text = text.replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/(?:^|\n)-\s+(.*?)(?=\n(?!- )|$)/gs, (_m, items) => {
      const lines = items.split("\n").map(l => l.trim()).filter(l => l.length > 0).map(l => `<li>${l.replace(/^-+\s*/, "")}</li>`).join("");
      return `<ul>${lines}</ul>`;
    });
    text = text.replace(/(?:^|\n)\d+\.\s+(.*?)(?=\n(?!\d+\. )|$)/gs, (_m, items) => {
      const lines = items.split("\n").map(l => l.trim()).filter(l => l.length > 0).map(l => `<li>${l.replace(/^\d+\.\s*/, "")}</li>`).join("");
      return `<ol>${lines}</ol>`;
    });
    text = text.replace(/^>\s+(.*)$/gm, "<blockquote>$1</blockquote>");
    const paragraphs = text.split(/\n{2,}/).map(p => {
      if (/^\s*<(h\d|ul|ol|pre|blockquote)/i.test(p)) return p;
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    }).join("");
    const safe = sanitizeHtml(paragraphs);
    return safe && safe.trim().length > 0 ? safe : paragraphs;
  };
  const summaryHtml = (() => {
    const pd = Array.isArray(result?.page_data) ? result.page_data : [];
    const sumItem = pd.find((x: any) => String(x?.response_type) === "summary");
    const raw =
      Array.isArray(sumItem?.response_data?.data)
        ? (sumItem?.response_data?.data as any[]).join("\n")
        : (sumItem?.response_data?.data || "");
    const md = toMarkdownFromHtml(typeof raw === "string" ? raw : "");
    return markdownToHtml(md);
  })();

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSearch className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Detalhes da Consulta</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleRefresh} disabled={refreshing || loading || locked}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {refreshing ? "Atualizando..." : locked ? `Aguardar ${remainingSec}s` : "Atualizar"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-mono text-sm">{request?.request_id}</span>
                <Badge className="px-2 py-1 text-xs">{status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Criada em {fmtDate(request?.created_at)}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-center py-12">Carregando...</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Tipo</div>
                    <div className="font-medium">{search?.search_type}</div>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-sm text-muted-foreground">Valor</div>
                    <div className="font-mono text-sm">{search?.search_key}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Retorno</div>
                    <div className="font-medium">{search?.response_type || ""}</div>
                  </div>
                </div>

                <Separator />

                {summaryHtml && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Resumo (IA)</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSummaryDialogOpen(true)}
                      >
                        Tela cheia
                      </Button>
                    </div>
                    <ScrollArea className="h-32 rounded-md border p-3 bg-muted/20">
                      <div className="text-sm" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                    </ScrollArea>
                  </div>
                )}

                {summaryHtml && (
                  <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
                    <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                      <DialogHeader className="flex-shrink-0">
                        <DialogTitle>Resumo (IA)</DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                        <div
                          className="text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: summaryHtml }}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Página</div>
                    <div className="font-medium">{result?.page ?? 0}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Páginas</div>
                    <div className="font-medium">{result?.page_count ?? 0}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Total páginas</div>
                    <div className="font-medium">{result?.all_pages_count ?? 0}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Total registros</div>
                    <div className="font-medium">{result?.all_count ?? 0}</div>
                  </div>
                </div>

                <Separator />

                {stepsDialogOpen && stepsDialogData ? (
                  <Dialog open={stepsDialogOpen} onOpenChange={setStepsDialogOpen}>
                    <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
                      <DialogHeader className="flex-shrink-0">
                        <DialogTitle>
                          Andamentos {stepsDialogData.code ? `• ${stepsDialogData.code}` : ""} {stepsDialogData.tribunal ? `(${stepsDialogData.tribunal})` : ""}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                        <div className="space-y-3">
                          {stepsDialogData.steps.map((s: any, i: number) => (
                            <div key={i} className="p-3 rounded-md bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{fmtDate(s?.step_date || s?.created_at)}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">Instância {s?.lawsuit_instance ?? ""}</Badge>
                              </div>
                              <div className="mt-2 text-sm whitespace-pre-wrap">{s?.content || ""}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : null}

                {pageData.length === 0 ? (
                  <div className="text-muted-foreground">Nenhum resultado encontrado.</div>
                ) : (
                  <div className="space-y-4">
                    {pageData.map((item: any) => {

                      if (item.response_type === "summary") return (<></>);

                      const d = item?.response_data || {};
                      const code = d?.lawsuit_cnj || d?.code || "";
                      const tribunal = d?.tribunal_acronym || d?.tribunal || "";
                      const instance = d?.instance ?? d?.lawsuit_instance ?? "";
                      const distribution = d?.distribution_date || d?.created_at || "";
                      const subjects: any[] = Array.isArray(d?.subjects) ? d.subjects : [];
                      const classifications: any[] = Array.isArray(d?.classifications) ? d.classifications : [];
                      const courts: any[] = Array.isArray(d?.courts) ? d.courts : [];
                      const parties: any[] = Array.isArray(d?.parties) ? d.parties : [];
                      const steps: any[] = Array.isArray(d?.steps) ? d.steps : [];
                      return (
                        <Card key={item?.response_id || code}>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <Scale className="h-5 w-5 text-primary" />
                                <span className="font-mono">{code}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge className="px-2 py-1 text-xs">{item?.response_type || ""}</Badge>
                                <Badge variant="outline" className="px-2 py-1 text-xs">{tribunal}</Badge>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="space-y-1">
                                <div className="text-sm text-muted-foreground">Instância</div>
                                <div className="font-medium">{instance}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-sm text-muted-foreground">Distribuição</div>
                                <div className="font-medium">{fmtDate(distribution)}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-sm text-muted-foreground">Juiz</div>
                                <div className="font-medium">{d?.judge || ""}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-sm text-muted-foreground">Sigilo</div>
                                <div className="font-medium">{d?.secrecy_level ?? ""}</div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium">Assuntos</div>
                              <div className="flex flex-wrap gap-2">
                                {subjects.map((s: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">{s?.name || s}</Badge>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium">Classificações</div>
                              <div className="flex flex-wrap gap-2">
                                {classifications.map((c: any, i: number) => (
                                  <Badge key={i} className="text-xs">{c?.name || c}</Badge>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium">Varas/Tribunais</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {courts.map((c: any, i: number) => (
                                  <div key={i} className="flex items-center space-x-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{c?.name || c}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium">Partes</div>
                              <div className="rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Nome</TableHead>
                                      <TableHead>Lado</TableHead>
                                      <TableHead>Documento</TableHead>
                                      <TableHead>Tipo</TableHead>
                                      <TableHead>Advogados</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {parties.map((p: any, i: number) => (
                                      <TableRow key={i}>
                                        <TableCell>
                                          <div className="flex items-center space-x-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{p?.name || ""}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>{p?.side || ""}</TableCell>
                                        <TableCell className="font-mono text-xs">{p?.main_document || ""}</TableCell>
                                        <TableCell>{p?.person_type || ""}</TableCell>
                                        <TableCell>
                                          <div className="flex flex-wrap gap-2">
                                            {(Array.isArray(p?.lawyers) ? p.lawyers : []).map((l: any, j: number) => (
                                              <Badge key={j} variant="outline" className="text-xs">{l?.name || ""}</Badge>
                                            ))}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">Andamentos</div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setStepsDialogData({ code, tribunal, steps });
                                    setStepsDialogOpen(true);
                                  }}
                                >
                                  <Maximize2 className="h-4 w-4 mr-2" />
                                  Tela cheia
                                </Button>
                              </div>
                              <ScrollArea className="h-64 rounded-md border p-2">
                                <div className="space-y-3">
                                  {steps.map((s: any, i: number) => (
                                    <div key={i} className="p-3 rounded-md bg-muted/30">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <Calendar className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm">{fmtDate(s?.step_date || s?.created_at)}</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">Instância {s?.lawsuit_instance ?? ""}</Badge>
                                      </div>
                                      <div className="mt-2 text-sm whitespace-pre-wrap">{s?.content || ""}</div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
