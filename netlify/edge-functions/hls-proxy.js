// Proxy HLS desde tu dominio HTTPS hacia el origen HTTP (IP:2086)
const ORIGIN_HOST = "191.103.121.135";  // IP que te dieron
const ORIGIN_PORT = 2086;
const PUBLIC_PREFIX = "/americabletv";  // ruta pública bajo tu dominio
const UPSTREAM_BASE = "/americabletv";  // ruta real en el origen

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "Range, Origin, Accept, Content-Type, Referer, User-Agent",
    "Vary": "Origin",
  };
}

function ensureHlsCT(u, resp) {
  const h = new Headers(resp.headers);
  const ct = (h.get("content-type") || "").toLowerCase();

  if (u.pathname.endsWith(".m3u8") && !ct.includes("application"))
    h.set("content-type", "application/vnd.apple.mpegurl");
  if ((u.pathname.endsWith(".ts") || u.pathname.endsWith(".mp2t")) && !ct.includes("video"))
    h.set("content-type", "video/mp2t");

  h.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

export default async (req) => {
  const url = new URL(req.url);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req.headers.get("Origin")) });
  }

  // Solo proxiar /americabletv/*
  if (!url.pathname.startsWith(PUBLIC_PREFIX + "/")) {
    return new Response("Not found", { status: 404 });
  }

  // Construir URL hacia el origen HTTP
  const upstreamPath = url.pathname.replace(PUBLIC_PREFIX, UPSTREAM_BASE) + url.search;
  const upstreamUrl = new URL(`http://${ORIGIN_HOST}:${ORIGIN_PORT}${upstreamPath}`);

  // Copiar y “normalizar” cabeceras que el origen espera
  const fwd = new Headers(req.headers);
  fwd.set("Host", `${ORIGIN_HOST}:${ORIGIN_PORT}`);
  fwd.set("Referer", `http://${ORIGIN_HOST}:${ORIGIN_PORT}/`);
  fwd.set("Origin",  `http://${ORIGIN_HOST}:${ORIGIN_PORT}`);
  if (!fwd.get("User-Agent")) {
    fwd.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36");
  }
  // Preserva Range (importante para HLS)
  const range = req.headers.get("Range");
  if (range) fwd.set("Range", range);

  // Hacer el fetch desde Netlify (server-side → sin mixed content)
  const upstreamResp = await fetch(upstreamUrl.toString(), {
    method: req.method,
    headers: fwd,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    redirect: "follow",
  });

  // Tipos + CORS
  const fixed = ensureHlsCT(upstreamUrl, upstreamResp);
  const h = new Headers(fixed.headers);
  const ch = cors(req.headers.get("Origin"));
  Object.entries(ch).forEach(([k, v]) => h.set(k, v));
  if (upstreamResp.headers.get("Accept-Ranges")) h.set("Accept-Ranges", "bytes");

  return new Response(fixed.body, { status: fixed.status, statusText: fixed.statusText, headers: h });
};
