// auth.js (ESM) — Firebase Auth + límite 3 sesiones con Realtime Database
// Carga por CDN oficial (no necesitas bundler)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, runTransaction, onDisconnect, update, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ====== TU CONFIG (añade databaseURL) ====== */
const firebaseConfig = {
  apiKey: "AIzaSyD7DbtBkPCycFUdnLVLJME4048ZCj2NkQQ",
  authDomain: "americabletv.firebaseapp.com",
  projectId: "americabletv",
  storageBucket: "americabletv.firebasestorage.app",
  messagingSenderId: "718273332164",
  appId: "1:718273332164:web:ae8f1a3efbb66d4fce5a91",
  measurementId: "G-1Q1KE2VCRG",

  // ⚠️ IMPORTANTE: agrega la URL exacta de tu Realtime Database:
  // databaseURL: "https://americabletv-default-rtdb.firebaseio.com"
};
/* =========================================== */

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ---- Límite de 3 espectadores concurrentes (asientos)
const STREAM_KEY = "americabletv"; // cámbialo si usas más canales
const MAX_SEATS  = 3;
let seatPath     = null;
let heartbeatId  = null;

async function claimSeat(uid) {
  const seatsRef  = ref(db, `streams/${STREAM_KEY}/seats`);
  const sessionId = `${uid}_${crypto.randomUUID()}`;
  seatPath = `streams/${STREAM_KEY}/seats/${sessionId}`;

  const result = await runTransaction(seatsRef, (seats) => {
    seats = seats || {};
    const now = Date.now();

    // Limpieza de entradas viejas (> 5 min sin heartbeat)
    for (const k in seats) {
      const ts = seats[k]?.ts || 0;
      if (now - ts > 5 * 60 * 1000) delete seats[k];
    }

    const count = Object.keys(seats).length;
    if (count >= MAX_SEATS) return; // aborta transacción

    seats[sessionId] = { uid, ts: now };
    return seats;
  });

  if (!result.committed) {
    seatPath = null;
    throw new Error("capacidad_llena");
  }

  // Presencia: si se desconecta, se borra asiento
  const mySeatRef = ref(db, seatPath);
  onDisconnect(mySeatRef).remove();

  // Heartbeat cada 25s
  heartbeatId = setInterval(() => {
    update(mySeatRef, { ts: Date.now() }).catch(() => {});
  }, 25000);
}

async function releaseSeat() {
  if (!seatPath) return;
  try { await remove(ref(db, seatPath)); } catch {}
  seatPath = null;
  if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
}

// ===== API que usa tu script.js =====
export function subscribeAuth(onChange) {
  return onAuthStateChanged(auth, onChange);
}

export async function loginEmailPassword(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await claimSeat(user.uid).catch(async (e) => {
    if (e.message === "capacidad_llena") {
      await signOut(auth);
      throw new Error("Capacidad completa (3 usuarios máximo). Inténtalo más tarde.");
    }
    throw e;
  });
  return user;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const { user } = await signInWithPopup(auth, provider);
  await claimSeat(user.uid).catch(async (e) => {
    if (e.message === "capacidad_llena") {
      await signOut(auth);
      throw new Error("Capacidad completa (3 usuarios máximo). Inténtalo más tarde.");
    }
    throw e;
  });
  return user;
}

export async function logout() {
  await releaseSeat();
  await signOut(auth);
}
