// === URL del stream via rewrite Netlify (HTTPS en tu dominio)
const STREAM_URL = `${location.origin}/americabletv/index.m3u8`;

// === ELEMENTOS PLAYER ===
const video = document.getElementById('videoPlayer');
const statusEl = document.getElementById('status');
const overlay = document.getElementById('overlay');
const refreshBtn = document.getElementById('refreshBtn');

// === PWA UI ===
let deferredPrompt = null;
const banner = document.getElementById('pwa-banner');
const installBtn = document.getElementById('installBtn');
const bannerClose = document.getElementById('bannerClose');
const iosModal = document.getElementById('ios-modal');
const iosClose = document.getElementById('iosClose');

// === AUTH UI ===
const authSection = document.getElementById('auth');
const appSection  = document.getElementById('appSection');
const loginForm   = document.getElementById('loginForm');
const loginBtn    = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const resetBtn    = document.getElementById('resetBtn');
const authMsg     = document.getElementById('authMsg');
const logoutBtn   = document.getElementById('logoutBtn');

let hls = null;
let retryTimer = null;

// --- helpers UI
function status(text) { if (statusEl) statusEl.textContent = text; }
function showOverlay() { overlay?.classList?.remove('hidden'); }
function hideOverlay() { overlay?.classList?.add('hidden'); }
function showApp()      { appSection.classList.remove('hidden'); authSection.classList.add('hidden'); }
function showAuth()     { appSection.classList.add('hidden'); authSection.classList.remove('hidden'); }

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

  const src = STREAM_URL;
  console.log('HLS URL =>', src);

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

// Inicializa PWA al cargar
document.addEventListener('DOMContentLoaded', () => {
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
    if (!localStorage.getItem('vida_pwa_dismissed')) {
      banner?.classList?.remove('hidden');
      banner?.setAttribute('aria-hidden', 'false');
    }
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('vida_pwa_installed', 'true');
    banner?.classList?.add('hidden');
    banner?.setAttribute('aria-hidden', 'true');
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem('vida_pwa_installed', 'true');
    else localStorage.setItem('vida_pwa_dismissed', 'true');
    deferredPrompt = null;
    banner?.classList?.add('hidden');
  });

  bannerClose?.addEventListener('click', () => {
    banner?.classList?.add('hidden');
    localStorage.setItem('vida_pwa_dismissed', 'true');
  });
}

// ======================
//  FIREBASE (Auth básico)
// ======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Tu config (la que me pasaste)
const firebaseConfig = {
  apiKey: "AIzaSyD7DbtBkPCycFUdnLVLJME4048ZCj2NkQQ",
  authDomain: "americabletv.firebaseapp.com",
  projectId: "americabletv",
  storageBucket: "americabletv.firebasestorage.app",
  messagingSenderId: "718273332164",
  appId: "1:718273332164:web:ae8f1a3efbb66d4fce5a91",
  measurementId: "G-1Q1KE2VCRG"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Estado de auth → muestra login o player
onAuthStateChanged(auth, (user) => {
  if (user) {
    authMsg.textContent = "";
    showApp();
    initPlayer();
  } else {
    destroyPlayer();
    showAuth();
  }
});

// Login
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  authMsg.textContent = "Iniciando...";
  loginBtn.disabled = true;
  try {
    const email = document.getElementById('email').value.trim();
    const pass  = document.getElementById('password').value;
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    authMsg.textContent = normalizaError(err);
  } finally {
    loginBtn.disabled = false;
  }
});

// Crear cuenta
registerBtn?.addEventListener('click', async () => {
  authMsg.textContent = "Creando cuenta...";
  loginBtn.disabled = true;
  try {
    const email = document.getElementById('email').value.trim();
    const pass  = document.getElementById('password').value;
    await createUserWithEmailAndPassword(auth, email, pass);
    authMsg.textContent = "Cuenta creada. ¡Bienvenido!";
  } catch (err) {
    authMsg.textContent = normalizaError(err);
  } finally {
    loginBtn.disabled = false;
  }
});

// Reset password
resetBtn?.addEventListener('click', async () => {
  try {
    const email = document.getElementById('email').value.trim();
    if (!email) { authMsg.textContent = "Escribe tu correo para enviar el enlace."; return; }
    await sendPasswordResetEmail(auth, email);
    authMsg.textContent = "Te enviamos un enlace para restablecer tu contraseña.";
  } catch (err) {
    authMsg.textContent = normalizaError(err);
  }
});

// Logout
logoutBtn?.addEventListener('click', async () => {
  try { await signOut(auth); } catch {}
});

// Mensajes de error amigables
function normalizaError(e){
  const code = (e?.code || "").toString();
  if (code.includes("auth/invalid-email")) return "Correo inválido.";
  if (code.includes("auth/invalid-login-credentials")) return "Correo o contraseña incorrectos.";
  if (code.includes("auth/user-not-found")) return "Usuario no encontrado.";
  if (code.includes("auth/weak-password")) return "La contraseña es muy débil (mínimo 6 caracteres).";
  if (code.includes("auth/email-already-in-use")) return "Ese correo ya está en uso.";
  return "Ocurrió un error. Intenta de nuevo.";
}
