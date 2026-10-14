import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../api/AuthContext';

const POLL_MS = 15000;
const TOAST_MS = 6000;

// Browsers keep a freshly-created AudioContext suspended until the page has
// had a user gesture, so we create one shared instance up front and unlock
// it on the first click/keypress — otherwise a chime fired from a background
// poll (no click involved) plays silently.
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    const unlock = () => { audioCtx.resume().catch(() => {}); };
    ['click', 'keydown', 'touchstart'].forEach((evt) =>
      document.addEventListener(evt, unlock, { once: true })
    );
  }
  return audioCtx;
}

function playChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const start = now + i * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

export default function TicketNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  // Seeded lazily on first successful poll so we never notify for pre-existing state.
  const knownStatus = useRef(null);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    if (!user) {
      knownStatus.current = null;
      return;
    }
    getAudioContext();
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await api.get('/tickets', { params: { mine: true } });
        if (cancelled) return;

        if (!knownStatus.current) {
          knownStatus.current = new Map(data.map((t) => [t.ticket_no, t.status]));
          return;
        }

        const changed = data.filter((t) => {
          const prevStatus = knownStatus.current.get(t.ticket_no);
          return prevStatus && prevStatus !== t.status;
        });

        if (changed.length) {
          playChime();
          setToasts((prev) => [
            ...prev,
            ...changed.map((t) => ({ id: `${t.ticket_no}-${Date.now()}`, ticket_no: t.ticket_no, status: t.status })),
          ]);
        }
        data.forEach((t) => knownStatus.current.set(t.ticket_no, t.status));
      } catch {
        // transient network/auth error — try again on the next poll
      }
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), TOAST_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border-l-4 border-blue-600 bg-white p-4 shadow-lg">
          <button
            onClick={() => { navigate(`/tickets/${t.ticket_no}`); dismiss(t.id); }}
            className="flex-1 text-left"
          >
            <p className="text-sm font-semibold">Ticket {t.ticket_no} updated</p>
            <p className="mt-0.5 text-xs text-gray-500">Status changed to <span className="font-medium">{t.status}</span></p>
          </button>
          <button onClick={() => dismiss(t.id)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
        </div>
      ))}
    </div>
  );
}
