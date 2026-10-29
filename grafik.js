// Grafik rekap (SVG): tren jam kerja per hari (kolom volume + kurva rata-rata), batang per fotografer / lapangan,
// kolom jam ramai & hari ramai. SVG yang sama dipakai di layar Rekap, PDF, dan gambar rekap.
// Warna: oranye = volume jam (#eb6834), biru = kurva rata-rata (#2a78d6) — pasangan lolos cek buta warna.
const GRAFIK = (() => {
  const W = { volume: "#eb6834", kurva: "#2a78d6", grid: "#ececE8", sumbu: "#cfcfca", teks: "#6b6b6b", tinta: "#141414", permukaan: "#ffffff" };
  const F = "Arial, Helvetica, sans-serif";
  const e = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const angka = n => (Math.round(n * 10) / 10).toLocaleString("id-ID");
  // atas sumbu yang "bulat": 1, 2, 5, 10 …
  function atasBulat(maks, langkah = 4) {
    if (maks <= 0) return { atas: 1, tik: [0, 1] };
    const kasar = maks / langkah, p = Math.pow(10, Math.floor(Math.log10(kasar))), n = kasar / p;
    const jarak = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p, atas = Math.ceil(maks / jarak) * jarak;
    const tik = []; for (let v = 0; v <= atas + 1e-9; v += jarak) tik.push(Math.round(v * 100) / 100);
    return { atas, tik };
  }
  // kolom: ujung data membulat 4px, rata di garis dasar
  function kolomPath(x, y, w, h, r = 4) {
    if (h <= 0) return "";
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function batangPath(x, y, w, h, r = 4) {
    if (w <= 0) return "";
    r = Math.min(r, h / 2, w);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  // kurva halus tanpa melenceng melewati titik (monotone cubic / Fritsch–Carlson)
  function kurvaPath(p) {
    if (p.length < 2) return "";
    const n = p.length, d = [], m = [];
    for (let i = 0; i < n - 1; i++) d.push((p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    let s = `M${p[0].x},${p[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const h = (p[i + 1].x - p[i].x) / 3;
      s += `C${p[i].x + h},${p[i].y + m[i] * h} ${p[i + 1].x - h},${p[i + 1].y - m[i + 1] * h} ${p[i + 1].x},${p[i + 1].y}`;
    }
    return s;
  }
  const bungkus = (w, h, isi, judul) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${e(judul)}" font-family="${F}">
    <rect width="${w}" height="${h}" fill="${W.permukaan}"/>${isi}</svg>`;

  // ---- tren: kolom jam per hari + kurva rata-rata bergerak ----
  // titik: [{ label, labelPanjang, jam, sesi }]
  function tren(titik, w = 640, h = 230, jendela = 7) {
    const kiri = 34, kanan = 10, atasP = 34, bawah = 26, pw = w - kiri - kanan, ph = h - atasP - bawah, n = titik.length;
    const rata = titik.map((_, i) => { const a = titik.slice(Math.max(0, i - jendela + 1), i + 1); return a.reduce((t, x) => t + x.jam, 0) / a.length; });
    const { atas, tik } = atasBulat(Math.max(...titik.map(t => t.jam), ...rata, 1));
    const sx = i => kiri + (i + 0.5) * (pw / n), sy = v => atasP + ph - (v / atas) * ph;
    const lebar = Math.max(2, Math.min(24, pw / n - 2));
    let g = tik.map(v => `<line x1="${kiri}" x2="${w - kanan}" y1="${sy(v)}" y2="${sy(v)}" stroke="${v ? W.grid : W.sumbu}" stroke-width="1"/>
      <text x="${kiri - 6}" y="${sy(v) + 4}" font-size="11" fill="${W.teks}" text-anchor="end">${angka(v)}</text>`).join("");
    const setiap = Math.ceil(n / Math.max(1, Math.floor(pw / 34)));
    g += titik.map((t, i) => i % setiap === 0 || i === n - 1 ? `<text x="${sx(i)}" y="${h - 8}" font-size="11" fill="${W.teks}" text-anchor="middle">${e(t.label)}</text>` : "").join("");
    g += titik.map((t, i) => `<path d="${kolomPath(sx(i) - lebar / 2, sy(t.jam), lebar, atasP + ph - sy(t.jam))}" fill="${W.volume}"/>`).join("");
    const pts = titik.map((_, i) => ({ x: sx(i), y: sy(rata[i]) }));
    g += `<path d="${kurvaPath(pts)}" fill="none" stroke="${W.kurva}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    const akhir = pts[n - 1];
    if (akhir) g += `<circle cx="${akhir.x}" cy="${akhir.y}" r="4.5" fill="${W.kurva}" stroke="${W.permukaan}" stroke-width="2"/>`;
    // label puncak (satu saja)
    let ip = 0; titik.forEach((t, i) => { if (t.jam > titik[ip].jam) ip = i; });
    if (titik[ip] && titik[ip].jam > 0) {
      const x = Math.min(Math.max(sx(ip), kiri + 40), w - kanan - 40);
      g += `<text x="${x}" y="${sy(titik[ip].jam) - 7}" font-size="11" font-weight="bold" fill="${W.tinta}" text-anchor="middle">puncak ${angka(titik[ip].jam)} jam</text>`;
    }
    // legenda (2 seri)
    g += `<rect x="${kiri}" y="9" width="12" height="12" rx="3" fill="${W.volume}"/><text x="${kiri + 18}" y="19" font-size="12" fill="${W.tinta}">Jam kerja per ${titik.periode || "hari"}</text>
      <line x1="${kiri + 160}" x2="${kiri + 178}" y1="15" y2="15" stroke="${W.kurva}" stroke-width="2.5" stroke-linecap="round"/><text x="${kiri + 184}" y="19" font-size="12" fill="${W.tinta}">Rata-rata ${jendela} ${titik.periode || "hari"}</text>`;
    // area sentuh untuk tooltip
    g += titik.map((t, i) => `<rect x="${kiri + i * pw / n}" y="${atasP}" width="${pw / n}" height="${ph}" fill="transparent" data-tip="${e(`${t.labelPanjang}\n${angka(t.jam)} jam · ${t.sesi} sesi\nrata-rata ${angka(rata[i])} jam`)}"/>`).join("");
    return bungkus(w, h, g, "Tren jam kerja");
  }

  // ---- batang mendatar: per fotografer / per lapangan ----
  // baris: [{ nama, jam, sesi }]
  function batang(baris, w = 640) {
    const tinggiBaris = 30, atasP = 6, kiri = Math.min(150, Math.max(60, 12 + Math.max(...baris.map(b => b.nama.length), 4) * 8.6));   // nama huruf besar tebal ±8,6px/huruf
    const kanan = 14 + Math.max(...baris.map(b => `${angka(b.jam)} jam · ${b.sesi} sesi`.length)) * 6.7;   // ruang label di ujung batang
    const h = atasP + baris.length * tinggiBaris + 6, pw = w - kiri - kanan;
    const maks = Math.max(...baris.map(b => b.jam), 1);
    const g = baris.map((b, i) => {
      const y = atasP + i * tinggiBaris, bw = (b.jam / maks) * pw, tebal = 16;
      return `<text x="${kiri - 8}" y="${y + tinggiBaris / 2 + 4}" font-size="12" font-weight="bold" fill="${W.tinta}" text-anchor="end">${e(b.nama)}</text>
        <path d="${batangPath(kiri, y + (tinggiBaris - tebal) / 2, Math.max(bw, 2), tebal)}" fill="${W.volume}"/>
        <text x="${kiri + bw + 6}" y="${y + tinggiBaris / 2 + 4}" font-size="12" fill="${W.tinta}"><tspan font-weight="bold">${angka(b.jam)} jam</tspan><tspan fill="${W.teks}"> · ${b.sesi} sesi</tspan></text>
        <rect x="0" y="${y}" width="${w}" height="${tinggiBaris}" fill="transparent" data-tip="${e(`${b.nama}\n${angka(b.jam)} jam · ${b.sesi} sesi`)}"/>`;
    }).join("") + `<line x1="${kiri}" x2="${kiri}" y1="${atasP - 2}" y2="${h - 4}" stroke="${W.sumbu}" stroke-width="1"/>`;
    return bungkus(w, h, g, "Jam kerja per kategori");
  }

  // ---- kolom kecil: jam ramai (06–23) / hari ramai (Sen–Min) ----
  // isi: [{ label, nilai, tip }], satuan untuk label puncak
  function kolom(isi, w = 640, h = 170, satuan = "sesi") {
    const kiri = 30, kanan = 8, atasP = 22, bawah = 24, pw = w - kiri - kanan, ph = h - atasP - bawah, n = isi.length;
    const { atas, tik } = atasBulat(Math.max(...isi.map(x => x.nilai), 1), 3);
    const sx = i => kiri + (i + 0.5) * (pw / n), sy = v => atasP + ph - (v / atas) * ph, lebar = Math.min(24, pw / n - 2);
    let g = tik.map(v => `<line x1="${kiri}" x2="${w - kanan}" y1="${sy(v)}" y2="${sy(v)}" stroke="${v ? W.grid : W.sumbu}" stroke-width="1"/>
      <text x="${kiri - 6}" y="${sy(v) + 4}" font-size="11" fill="${W.teks}" text-anchor="end">${angka(v)}</text>`).join("");
    const setiap = Math.ceil(n / Math.max(1, Math.floor(pw / 30)));
    let ip = 0; isi.forEach((x, i) => { if (x.nilai > isi[ip].nilai) ip = i; });
    g += isi.map((x, i) => `<path d="${kolomPath(sx(i) - lebar / 2, sy(x.nilai), lebar, atasP + ph - sy(x.nilai))}" fill="${W.volume}"/>
      ${i % setiap === 0 ? `<text x="${sx(i)}" y="${h - 8}" font-size="11" fill="${W.teks}" text-anchor="middle">${e(x.label)}</text>` : ""}
      <rect x="${kiri + i * pw / n}" y="${atasP}" width="${pw / n}" height="${ph}" fill="transparent" data-tip="${e(x.tip || `${x.label}\n${angka(x.nilai)} ${satuan}`)}"/>`).join("");
    if (isi[ip] && isi[ip].nilai > 0) {
      const x = Math.min(Math.max(sx(ip), kiri + 30), w - kanan - 30);
      g += `<text x="${x}" y="${sy(isi[ip].nilai) - 7}" font-size="11" font-weight="bold" fill="${W.tinta}" text-anchor="middle">${angka(isi[ip].nilai)} ${satuan}</text>`;
    }
    return bungkus(w, h, g, "Sebaran");
  }

  // SVG → PNG (untuk PDF & gambar rekap)
  async function keGambar(svg, skala = 3, jenis = "image/png") {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement("canvas"); c.width = img.width * skala; c.height = img.height * skala;
    const g = c.getContext("2d"); g.scale(skala, skala); g.drawImage(img, 0, 0);
    return { url: c.toDataURL(jenis, 0.9), w: img.width, h: img.height, img, kanvas: c };
  }

  // tooltip sederhana untuk layar (hover di laptop, ketuk di HP)
  function pasangTooltip(wadah) {
    let tip = document.getElementById("grafikTip");
    if (!tip) { tip = document.createElement("div"); tip.id = "grafikTip"; tip.className = "grafik-tip"; document.body.appendChild(tip); }
    const tampil = ev => {
      const t = ev.target.closest("[data-tip]");
      if (!t || !wadah.contains(t)) { tip.style.opacity = 0; return; }
      tip.textContent = t.getAttribute("data-tip"); tip.style.opacity = 1;
      const x = Math.min(ev.clientX + 12, innerWidth - tip.offsetWidth - 8), y = Math.max(ev.clientY - tip.offsetHeight - 12, 8);
      tip.style.left = x + "px"; tip.style.top = y + "px";
    };
    wadah.addEventListener("pointermove", tampil);
    wadah.addEventListener("pointerdown", tampil);
    wadah.addEventListener("pointerleave", () => tip.style.opacity = 0);
  }

  return { tren, batang, kolom, keGambar, pasangTooltip, warna: W };
})();
