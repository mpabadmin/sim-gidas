'use strict';
// ── Trumpa instrukcija „Kaip naudotis“: rodoma pirmą kartą atidarius pradžios ekraną, vėliau – mygtukas „?“ (pradžioje) ir Nustatymuose ──
// Bendras visoms 1040 medkuopos programėlėms; turinys – STEPS žemiau. Mygtukai su data-g="open" atidaro instrukciją.
const GUIDE = (() => {
  const KEY = 'sim-guide', VER = 1;
  const IC = {
    search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z|M20 20l-4-4', moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    chat: 'M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.6a8.5 8.5 0 1 1 15.6-4.4z', refresh: 'M20 11a8 8 0 0 0-14.3-4.9L4 8|M4 3v5h5|M4 13a8 8 0 0 0 14.3 4.9L20 16|M20 21v-5h-5',
    gear: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0|M16 4v4M10 10v4M18 16v4', wave: 'M22 12h-2.5a2 2 0 0 0-1.9 1.5l-2.4 8.3a.25.25 0 0 1-.5 0L9.2 2.2a.25.25 0 0 0-.5 0L6.4 10.5A2 2 0 0 1 4.5 12H2',
    stop: 'M6 6h12v12H6z', help: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z|M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8|M12 17h.01'
  };
  const svg = (k, c) => `<svg class="${c || 'gdi'}" viewBox="0 0 24 24" aria-hidden="true">${(IC[k] || k).split('|').map(d => `<path d="${d}"/>`).join('')}</svg>`;
  const txt = s => s.replace(/\{(\w+)\}/g, (m, k) => IC[k] ? svg(k, 'gdii') : m);
  const STEPS = [
  { ic: 'wave', t: 'SIM – monitoriaus simuliatorius', p: 'Treniruotėms: vienas telefonas tampa <b>paciento monitoriumi</b> (EKG, SpO₂, AKS, kvėpavimas, aliarmai), kitas – <b>instruktoriaus pultu</b>. Užtenka ir vieno telefono.' },
  { ic: 'M3 6h18v12H3z|M7 21h10', t: 'Monitorius', p: 'Paspauskite <b>Monitorius</b> ir pastatykite telefoną gulsčiai. Pultas atsidaro mygtuku {gear} kairėje viršuje arba ilgai palaikius ekraną. Palietus AKS langelį – matuojamas AKS, palietus kreivės pavadinimą – greitis, amplitudė ir triukšmas.' },
  { ic: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z|M14 14h2v2h-2zM18 18h2v2h-2z', t: 'Instruktoriaus telefonas', p: 'Atidarius <b>Monitorių</b>, ekrane iš karto rodomas QR kodas ir kodas (vėliau – pulte <b>Ryšys</b>). Kitu telefonu nuskaitykite QR kodą arba SIM → <b>Instruktorius</b> ir įveskite kodą. Abiem reikia interneto. Prisijungus atsidaro skirtukas <b>Simuliacija</b>.' },
  { ic: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z|M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2', t: 'Simuliacija', p: 'Skirtukas <b>Simuliacija</b> – vedlys: vieta (MEDEVAC ar Role 1), pacientas, sužalojimai, kas atlikta iki atvykimo, dinamika → <b>PRADĖTI</b>.' },
  { ic: 'M18 6H6a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-4a4 4 0 0 0-4-4Z|M10 10h.01M14 14h.01M10 14h.01M14 10h.01', t: 'Eiga', p: '<b>Procedūros</b> ir <b>Vaistai</b> keičia būklę – po 5 s veiksmas įvyksta, matosi, kas pasikeitė. <b>Įvykiai</b> – instruktoriaus trikdžiai (atsilaisvino turniketas, nukrito elektrodas). {wave} – kreivės pulte, {stop} – baigti ir ataskaita.' },
  { ic: 'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z', t: 'Dinamika', p: 'Kaip keisis būklė:', x: () => '<ul><li><b>Rankinis</b> – rodiklius keičiate patys.</li><li><b>Telefono modelis ≈</b> – automatiškai, be interneto.</li><li><b>Pulse Physiology Engine</b> – žmogaus fiziologijos modelis serveryje; raktą suteikia Moebius.</li></ul><p style="margin-top:10px">Instrukciją vėl atidarysite pradžios ekrane – <b>„Kaip naudotis“</b>.</p>' }
];
  let i = 0, el = null, last = null;
  const seen = () => { try { return +JSON.parse(localStorage.getItem(KEY) || '0') >= VER; } catch (e) { return false; } };
  const mark = () => { try { localStorage.setItem(KEY, JSON.stringify(VER)); } catch (e) {} };
  function draw() {
    const S = STEPS[i], n = STEPS.length, end = i === n - 1;
    el.innerHTML = `<div class="gdc" role="dialog" aria-modal="true" aria-labelledby="gdt"><div class="gdh"><div class="gdd">${STEPS.map((x, j) => `<button data-g="go" data-i="${j}" class="${j === i ? 'on' : ''}" aria-label="${j + 1} iš ${n}"></button>`).join('')}</div><button class="gdx" data-g="close">${end ? 'Uždaryti' : 'Praleisti'}</button></div>` +
      `<div class="gdb"><div class="gdic">${svg(S.ic)}</div><h2 id="gdt">${S.t}</h2><p>${txt(S.p)}</p>${S.x ? S.x() : ''}</div>` +
      `<div class="gdf">${i ? '<button class="gdbk" data-g="prev">Atgal</button>' : '<span></span>'}<button class="gdgo" data-g="${end ? 'close' : 'next'}">${end ? 'Pradėti' : 'Toliau'}</button></div></div>`;
    const b = el.querySelector('.gdgo'); if (b) b.focus({ preventScroll: true });
  }
  function open(at) {
    if (el) return;
    last = document.activeElement; i = Math.max(0, Math.min(STEPS.length - 1, +at || 0));
    el = document.createElement('div'); el.className = 'gd'; document.body.appendChild(el); document.body.classList.add('gdon');
    draw();
  }
  function close() {
    if (!el) return;
    mark(); el.remove(); el = null; document.body.classList.remove('gdon');
    if (last && last.focus) try { last.focus({ preventScroll: true }); } catch (e) {}
    if (typeof GUIDE_DONE === 'function') try { GUIDE_DONE(); } catch (e) {}
  }
  const go = d => { i = Math.max(0, Math.min(STEPS.length - 1, i + d)); draw(); };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-g]'); if (!b) { if (el && e.target === el) close(); return; }
    e.preventDefault(); e.stopPropagation();
    const g = b.dataset.g;
    if (g === 'open') return open();
    if (!el) return;
    if (g === 'next') go(1); else if (g === 'prev') go(-1); else if (g === 'go') { i = +b.dataset.i; draw(); } else if (g === 'close') close();
    else if (STEPS[i].on) { STEPS[i].on(g, b); draw(); }
  }, true);
  document.addEventListener('keydown', e => { if (!el) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); });
  let tx = null;
  document.addEventListener('touchstart', e => { if (el && e.target.closest('.gdc')) tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => { if (!el || tx == null) return; const d = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(d) > 60) go(d < 0 ? 1 : -1); }, { passive: true });
  // pirmą kartą – kai atidaromas pradžios ekranas (automatiniuose testuose nerodoma)
  const home = () => !location.hash || location.hash === '#/' || location.hash === '#';
  const maybe = () => { if (!el && !seen() && !navigator.webdriver && home()) open(); };
  addEventListener('hashchange', () => setTimeout(maybe, 400));
  setTimeout(maybe, 700);
  return { open, close, seen, svg };
})();
