'use strict';
// ───────── SIM – nuotolinis valdymas: WebRTC duomenų kanalas, susiejimas QR kodais (be serverio) ─────────
// Monitorius sukuria pasiūlymą (QR), instruktorius jį nuskaito ir parodo atsakymą (QR), monitorius nuskaito – ryšys tiesioginis.
// Veikia, kai abu telefonai tame pačiame Wi-Fi ar vieno telefono interneto prieigos taške; su internetu – dažnai ir per mobilųjį ryšį.
const RTC = (() => {
  let pc = null, dc = null, role = '', onMsg = null, onState = null, snapT = 0;
  const ICE = () => navigator.onLine ? [{ urls: 'stun:stun.l.google.com:19302' }] : [];
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function pipe(u8, T) { const r = new Response(new Blob([u8]).stream().pipeThrough(new T('deflate-raw'))); return new Uint8Array(await r.arrayBuffer()); }
  // SDP sutrumpinamas: paliekamos tik duomenų kanalui reikalingos eilutės
  const slim = sdp => sdp.split(/\r?\n/).filter(l => l && !/^a=(extmap|msid-semantic|ice-options:trickle)/.test(l)).join('\r\n') + '\r\n';
  async function enc(t, sdp) {
    const raw = new TextEncoder().encode(JSON.stringify({ t, s: slim(sdp) }));
    if (typeof CompressionStream !== 'undefined') { try { return 'SIM1z' + b64(await pipe(raw, CompressionStream)); } catch (e) {} }
    return 'SIM1j' + b64(raw);
  }
  async function dec(code) {
    code = String(code || '').trim(); const m = /^SIM1([zj])([A-Za-z0-9_-]+)$/.exec(code); if (!m) throw new Error('Netinkamas kodas');
    let u = unb64(m[2]); if (m[1] === 'z') { if (typeof DecompressionStream === 'undefined') throw new Error('Naršyklė per sena – atnaujinkite'); u = await pipe(u, DecompressionStream); }
    const o = JSON.parse(new TextDecoder().decode(u)); if (!o || !o.s || (o.t !== 'o' && o.t !== 'a')) throw new Error('Netinkamas kodas'); return o;
  }
  function gather() {
    return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const to = setTimeout(res, 3500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(to); res(); } }); });
  }
  function close() { try { dc && dc.close(); } catch (e) {} try { pc && pc.close(); } catch (e) {} pc = null; dc = null; role = ''; st('off'); }
  const st = s => { if (onState) onState(s); };
  function wire(ch) {
    dc = ch;
    dc.onopen = () => st('on');
    dc.onclose = () => st('off');
    dc.onmessage = e => { let o; try { o = JSON.parse(e.data); } catch (x) { return; } if (onMsg) onMsg(o); };
  }
  function mk() {
    close(); pc = new RTCPeerConnection({ iceServers: ICE() });
    pc.onconnectionstatechange = () => { const s = pc && pc.connectionState; if (s === 'failed' || s === 'closed' || s === 'disconnected') st(s === 'disconnected' ? 'lost' : 'off'); };
  }
  // ── monitorius ──
  async function host() {
    mk(); role = 'host'; wire(pc.createDataChannel('sim', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer()); await gather(); st('wait');
    return enc('o', pc.localDescription.sdp);
  }
  async function hostAccept(code) {
    if (!pc || role !== 'host') throw new Error('Pirmiausia sukurkite monitoriaus kodą');
    const o = await dec(code); if (o.t !== 'a') throw new Error('Tai ne instruktoriaus atsakymo kodas');
    await pc.setRemoteDescription({ type: 'answer', sdp: o.s }); st('conn');
  }
  // ── instruktorius ──
  async function join(code) {
    const o = await dec(code); if (o.t !== 'o') throw new Error('Tai ne monitoriaus kodas');
    mk(); role = 'ctrl'; pc.ondatachannel = e => wire(e.channel);
    await pc.setRemoteDescription({ type: 'offer', sdp: o.s });
    await pc.setLocalDescription(await pc.createAnswer()); await gather(); st('wait');
    return enc('a', pc.localDescription.sdp);
  }
  function send(o) { if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(o)); return true; } catch (e) {} } return false; }
  const open = () => !!(dc && dc.readyState === 'open');

  // ── QR rodymas ir skenavimas ──
  function loadLib(src, test) { return new Promise((res, rej) => { if (test()) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Nepavyko įkelti ' + src)); document.head.appendChild(s); }); }
  async function qrSvg(str) {
    await loadLib('vendor/qrcode.min.js', () => typeof qrcode !== 'undefined');
    const q = qrcode(0, 'L'); q.addData(str, 'Byte'); q.make(); return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
  }
  let stream = null, loop = 0;
  function scanStop() { clearInterval(loop); loop = 0; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
  async function scan(video, onCode, onErr) {
    scanStop();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Kamera šioje naršyklėje nepasiekiama – naudokite kodo įklijavimą');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream; await video.play();
      let det = null;
      if ('BarcodeDetector' in window) { try { const f = await BarcodeDetector.getSupportedFormats(); if (f.indexOf('qr_code') >= 0) det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {} }
      if (!det) await loadLib('vendor/jsqr.min.js', () => typeof jsQR !== 'undefined');
      const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }); let busy = false;
      loop = setInterval(async () => {
        if (busy || !stream || video.readyState < 2) return; busy = true;
        try {
          let txt = '';
          if (det) { const r = await det.detect(video); if (r[0]) txt = r[0].rawValue; }
          else { const w = Math.min(800, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth); cv.width = w; cv.height = h; cx.drawImage(video, 0, 0, w, h); const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); if (r) txt = r.data; }
          if (/^SIM1[zj]/.test(txt)) { scanStop(); if (navigator.vibrate) navigator.vibrate(60); onCode(txt); }
        } catch (e) {}
        busy = false;
      }, 200);
    } catch (e) { scanStop(); onErr(e && e.name === 'NotAllowedError' ? 'Kamera neleidžiama – leiskite naršyklės nustatymuose arba įklijuokite kodą' : (e && e.message) || 'Kamera nepasiekiama'); }
  }
  return { host, hostAccept, join, send, close, open, role: () => role, set onMsg(f) { onMsg = f; }, set onState(f) { onState = f; }, qrSvg, scan, scanStop, _dec: dec };
})();
