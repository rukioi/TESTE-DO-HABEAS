const args = process.argv.slice(2);
function getArg(name, def) {
  const m = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!m) return def;
  const eq = m.indexOf("=");
  if (eq !== -1) return m.slice(eq + 1);
  const i = args.indexOf(m);
  return args[i + 1] || def;
}

async function main() {
  const tenantId = getArg("tenantId", process.env.TENANT_ID || "");
  if (!tenantId) {
    console.error("Missing --tenantId");
    process.exit(1);
  }
  const trackingId = getArg("trackingId", `tracking_${Date.now()}`);
  const cnj = getArg("cnj", "0000000-00.0000.0.00.0000");
  const userId = getArg("userId", process.env.USER_ID || "");
  const baseUrl = getArg("url", `http://localhost:${process.env.PORT || 5000}`);
  const endpoint = `${baseUrl}/api/judit/webhook?tenantId=${encodeURIComponent(tenantId)}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`;

  const body = {
    id: trackingId,
    tracking_id: trackingId,
    search: {
      search_type: "lawsuit_cnj",
      search_key: cnj,
    },
    response_data: {
      lawsuit_cnj: cnj,
      last_step: {
        summary: "Publicação registrada",
        date: new Date().toISOString().slice(0, 10),
      },
      court_name: "1ª Vara Cível",
      parties: [
        { name: "Autor Exemplo", document: "000.000.000-00" },
        { name: "Réu Exemplo", document: "111.111.111-11" },
      ],
      status: "em_andamento",
    },
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error("Error:", e && e.message ? e.message : String(e));
  process.exit(1);
});
