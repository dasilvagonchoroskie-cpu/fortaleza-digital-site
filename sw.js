// Service worker da Fortaleza Digital Security.
// Estratégia: rede primeiro (o site sempre mostra a versão mais nova) e, sem internet, usa a cópia guardada.
// Não guarda o painel administrativo, os APKs nem outros domínios (Firebase/Google).
var VERSAO = "fd-v2";
var BASICO = ["./", "index.html", "style.css", "tema-move.css", "logo.png", "script.js", "firebase-config.js", "icon-192.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(BASICO); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (n) { return n !== VERSAO; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                       // Firebase e CDN passam direto
  if (/\/admin(\.html|\.js|\.webmanifest)?$/.test(url.pathname)) return; // painel nunca é guardado
  if (/\/apks\//.test(url.pathname)) return;                             // APKs são grandes: sempre da rede
  e.respondWith(
    caches.match(req).then(function (guardado) {
      var rede = (req.mode === "navigate" ? fetch(req) : fetch(req, { cache: "no-cache" })).then(function (res) {
        if (res && res.ok) { var copia = res.clone(); caches.open(VERSAO).then(function (c) { c.put(req, copia); }); }
        return res;
      });
      var limite = guardado ? new Promise(function (ok) { setTimeout(function () { ok(guardado); }, 4000); }) : null;
      return (limite ? Promise.race([rede, limite]) : rede).catch(function () {
        return guardado || (req.mode === "navigate" ? caches.match("index.html") : Response.error());
      });
    })
  );
});
