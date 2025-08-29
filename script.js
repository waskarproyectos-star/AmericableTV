// === CONFIG ===
// URL ABSOLUTA al subdominio del stream (nunca IP:2086 en el cliente)
const STREAM_URL = "https://stream.americabletv.com/americabletv/index.m3u8";

// === ELEMENTOS ===
const video = document.getElementById('videoPlayer');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const refreshBtn = document.getElementById('refreshBtn');

// PWA
let deferredPrompt = null;
const banner = document.getElementById('pwa-banner');
const installBtn = document.getElementById('installBtn');
const bannerClose = document.getElementById('bannerClose');
const iosModal = document.getElementById('ios-modal');
const iosClose = document.getElementById('iosClose');

// === HLS STATE ===
let hls = null;
let retryTimer = null;

// Utilidad estado
function status(text) { if (statusEl) statusEl.textContent = text; }
function showOverlay() { overlay?.classList?.remove('hidden'); }
function hideOverlay() { overlay?.classList?.add('hidden'); }

// Limpia instancias previas
function destroyPlayer() {
  try {
    if (hls) { hls.destroy(); hls = null; }
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  } catch (_) {}
}

// Inicializar reproducción HLS
function initPlayer(autoPlay = true) {
  status('Inicializando player...');
  destroyPlayer();

  const src = STREAM_URL; // absoluta

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({
      autoStartLoad: true,
      manifestLoadingTimeOut: 15000,
      xhrSetup: (xhr) => { xhr.withCredentials = false; },
    });
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      status('Transmisión lista ✅');
      hideOverlay();
      if (autoPlay) video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.warn('HLS error', data);
      if (data?.type === Hls.ErrorTypes.NETWORK_ERROR || data?.fatal) {
        status('⚠️ No hay transmisión activa o manifiesto inválido');
        showOverlay();
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => initPlayer(false), 10000);
      }
    });
  } else if (video?.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari (nativo)
    video.src = src;
    video.addEventListener('loadedmetadata', () => {
      status('Transmisión lista ✅');
      hideOverlay();
      if (autoPlay) video.play().catch(() => {});
    }, { once: true });
    video.addEventListener('error', () => {
      status('⚠️ No hay transmisión activa');
      showOverlay();
    }, { once: true });
  } else {
    status('❌ Tu navegador no soporta HLS');
    showOverlay();
  }
}

// Botón refrescar
refreshBtn?.addEventListener('click', () => {
  status('Refrescando...');
  clearTimeout(retryTimer);
  initPlayer();
});

// Inicializa al cargar
document.addEventListener('DOMContentLoaded', () => {
  initPlayer();
  setupPWAInstallFlow();
});

// --- PWA install flow & iOS instructions ---
function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isInStandaloneMode() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
}

function setupPWAInstallFlow() {
  if (localStorage.getItem('vida_pwa_installed') === 'true' || isInStandaloneMode()) return;

  if (isIos()) {
    setTimeout(() => iosModal?.classList?.remove('hidden'), 1200);
    iosClose?.addEventListener('click', () => {
      iosModal?.classList?.add('hidden');
      localStorage.setItem('vida_pwa_dismissed', 'true');
    });
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem('vida_pwa_dismissed')) showBanner();
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('vida_pwa_installed', 'true');
    hideBanner();
  });
}

function showBanner() { banner?.classList?.remove('hidden'); banner?.setAttribute('aria-hidden', 'false'); }
function hideBanner() { banner?.classList?.add('hidden'); banner?.setAttribute('aria-hidden', 'true'); }

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) { if (isIos()) iosModal?.classList?.remove('hidden'); return; }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') localStorage.setItem('vida_pwa_installed', 'true');
  else localStorage.setItem('vida_pwa_dismissed', 'true');
  deferredPrompt = null;
  hideBanner();
});

bannerClose?.addEventListener('click', () => {
  hideBanner();
  localStorage.setItem('vida_pwa_dismissed', 'true');
});
