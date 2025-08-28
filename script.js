// URL del stream HLS (m3u8)
const STREAM_URL = "http://191.103.121.135:2086/americabletv/index.m3u8";


// Elementos
const video = document.getElementById('videoPlayer');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const refreshBtn = document.getElementById('refreshBtn');

// Instalación PWA
let deferredPrompt = null;
const banner = document.getElementById('pwa-banner');
const installBtn = document.getElementById('installBtn');
const bannerClose = document.getElementById('bannerClose');
const iosModal = document.getElementById('ios-modal');
const iosClose = document.getElementById('iosClose');

// Inicializar reproducción HLS
function initPlayer() {
  status('Inicializando player...');
  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ autoStartLoad: true });
    hls.loadSource(STREAM_URL);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      status('Transmisión lista ✅');
      hideOverlay();
      // intentamos reproducir (autoplay puede requerir interacción en algunos móviles)
      video.play().catch(()=>{ /* silencio si bloqueo autoplay */ });
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.warn('HLS error', data);
      if (data && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        status('⚠️ No hay transmisión activa');
        showOverlay();
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = STREAM_URL;
    video.addEventListener('loadedmetadata', () => {
      status('Transmisión lista ✅');
      hideOverlay();
    });
    video.addEventListener('error', () => {
      status('⚠️ No hay transmisión activa');
      showOverlay();
    });
  } else {
    status('❌ Tu navegador no soporta HLS');
    showOverlay();
  }
}

function status(text) {
  statusEl.textContent = text;
}

function showOverlay() {
  overlay.classList.remove('hidden');
}
function hideOverlay() {
  overlay.classList.add('hidden');
}

// Botón refrescar
refreshBtn.addEventListener('click', () => {
  status('Refrescando...');
  // reload del stream: reconstruimos el player simple
  try {
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  } catch(e){ /* ignore */ }
  initPlayer();
});

// Inicializa al cargar
document.addEventListener('DOMContentLoaded', () => {
  initPlayer();
  setupPWAInstallFlow();
});

// --- PWA install flow & iOS instructions ---
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
}

function setupPWAInstallFlow() {
  // Si ya instalada guardada en localStorage, no mostrar nada
  if (localStorage.getItem('vida_pwa_installed') === 'true' || isInStandaloneMode()) {
    // no mostramos banner
    return;
  }

  // iOS: mostrar instrucciones manuales (no dispara beforeinstallprompt)
  if (isIos()) {
    // Mostramos modal con pasos si no está instalada
    // Esperamos un pequeño delay para no molestar en la carga
    setTimeout(() => {
      document.getElementById('ios-modal').classList.remove('hidden');
    }, 1200);

    document.getElementById('iosClose').addEventListener('click', () => {
      document.getElementById('ios-modal').classList.add('hidden');
      localStorage.setItem('vida_pwa_dismissed', 'true');
    });

    return; // iOS no usa beforeinstallprompt estándar
  }

  // Escuchar beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Si el usuario no lo descartó anteriormente, mostrar banner
    if (!localStorage.getItem('vida_pwa_dismissed')) {
      showBanner();
    }
  });

  // Si la app se instala por cualquier otro evento
  window.addEventListener('appinstalled', () => {
    console.log('PWA instalada');
    localStorage.setItem('vida_pwa_installed', 'true');
    hideBanner();
  });
}

function showBanner() {
  banner.classList.remove('hidden');
  banner.setAttribute('aria-hidden', 'false');
}

function hideBanner() {
  banner.classList.add('hidden');
  banner.setAttribute('aria-hidden', 'true');
}

// Instalación cuando el usuario pulsa instalar
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) {
    // fallback: abrir instrucciones iOS si detectamos Safari
    if (isIos()) {
      document.getElementById('ios-modal').classList.remove('hidden');
    }
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    console.log('Usuario aceptó instalar');
    localStorage.setItem('vida_pwa_installed', 'true');
  } else {
    localStorage.setItem('vida_pwa_dismissed', 'true');
  }
  deferredPrompt = null;
  hideBanner();
});

// Cerrar banner manual
bannerClose?.addEventListener('click', () => {
  hideBanner();
  localStorage.setItem('vida_pwa_dismissed', 'true');
});
