// Absen pakai suara: rekam ucapan (Web Speech API, bahasa Indonesia) → baca kalimatnya → isi form absen.
// Contoh: "Aku Fadlan, tadi moto di Punakha jam 8 malam, durasi 1 jam, nama timnya Garuda FC".
const SUARA = (() => {
  const ANGKA = { nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
  const RE_ANGKA = "(nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)";

  // "dua puluh tiga" → 23, "tujuh belas" → 17, "sejam" → "1 jam", "1,5" → "1.5"
  function angkakan(t) {
    return t
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/\bsejam\b/g, "1 jam")
      .replace(new RegExp(`\\b${RE_ANGKA} puluh(?: ${RE_ANGKA})?\\b`, "g"), (_, a, b) => String(ANGKA[a] * 10 + (b ? ANGKA[b] : 0)))
      .replace(new RegExp(`\\b${RE_ANGKA} belas\\b`, "g"), (_, a) => String(10 + ANGKA[a]))
      .replace(/\bsebelas\b/g, "11").replace(/\bsepuluh\b/g, "10")
      .replace(new RegExp(`\\b${RE_ANGKA}\\b`, "g"), (_, a) => String(ANGKA[a]));
  }
  // ejaan longgar untuk mencocokkan nama lapangan hasil dengar (punaka ≈ PUNAKHA, benesia ≈ BENECIA)
  const longgar = s => s.toLowerCase().replace(/lapangan/g, "").replace(/[^a-z0-9]/g, "")
    .replace(/ph/g, "f").replace(/kh/g, "k").replace(/h/g, "").replace(/c/g, "s").replace(/z/g, "s").replace(/v/g, "f").replace(/ou/g, "u").replace(/(.)\1+/g, "$1");
  function jarak(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const judul = s => s.replace(/\S+/g, w => w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1));

  const NAMA_HARI = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
  const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const RE_STOP = "di|dengan|durasi|durasinya|selama|jam|pukul|lapangan|foto|video|moto|ngevideo|kontak|nomor|no|hp|catatan|tanggal|kemarin|tadi|hari|terus|trus|lalu|habis|abis|kemudian|lanjut|sesi|sama|dan";

  // Baca satu kalimat yang bisa berisi BANYAK sesi. Tiap sebutan "jam …" = satu sesi.
  // Tanggal, lapangan, durasi & jenis terbawa ke sesi berikutnya sampai disebut lagi; nama team per sesi.
  function bacaBanyak(asli, daftar, hariIniIso, bawaan = {}) {
    let t = " " + angkakan(asli.toLowerCase()).replace(/[!?;]|[,.](?!\d)/g, " , ").replace(/\s+/g, " ") + " ";
    const tutup = (a, b) => { t = t.slice(0, a) + " ".repeat(b - a) + t.slice(b); };
    const ambil = (re, f) => {
      const ketemu = [...t.matchAll(re)];
      ketemu.forEach(m => tutup(m.index, m.index + m[0].length));          // tandai sudah dipakai, posisi kata lain tetap
      return ketemu.map(m => ({ i: m.index, v: f(m) })).filter(x => x.v !== undefined && x.v !== "");
    };
    const hari = new Date(hariIniIso + "T00:00:00");
    const mundur = n => { const d = new Date(hari); d.setDate(d.getDate() - n); return isoD(d); };

    const team = ambil(new RegExp(`\\b(?:nama\\s+)?(?:tim|team|tem)(?:nya)?\\s+(?:adalah\\s+|itu\\s+|si\\s+|namanya\\s+)?(.+?)(?=\\s+(?:${RE_STOP})\\b|\\s+\\d+(?:\\.\\d+)?\\s*(?:setengah\\s*)?jam\\b|\\s*,|\\s*$)`, "g"),
      m => judul(m[1].trim()) || undefined);
    const kontak = ambil(/(?:\+?62|\b0)8[\d\s-]{7,14}\d/g, m => m[0].replace(/[\s-]/g, "").replace(/^\+?62/, "0"));
    const nama = daftar.nama.find(n => new RegExp(`\\b${n.toLowerCase()}\\b`).test(t));
    if (nama) t = t.replace(new RegExp(`\\b${nama.toLowerCase()}\\b`, "g"), x => " ".repeat(x.length));
    const tanggal = ambil(/\b(kemarin lusa|2 hari (?:yang )?lalu|kemarin|tanggal (\d{1,2})|hari ini|tadi|barusan|sekarang|(?:hari )?(minggu|senin|selasa|rabu|kamis|jumat|jum'at|sabtu)(?! (?:ini|lalu|depan)))\b/g, m => {
      if (m[2]) { const d = new Date(hari.getFullYear(), hari.getMonth(), +m[2]); if (d > hari) d.setMonth(d.getMonth() - 1); return isoD(d); }
      if (m[3]) { const d = new Date(hari); while (d.getDay() !== NAMA_HARI.indexOf(m[3].replace("'", ""))) d.setDate(d.getDate() - 1); return isoD(d); }
      return /lusa|2 hari/.test(m[1]) ? mundur(2) : /kemarin/.test(m[1]) ? mundur(1) : hariIniIso;
    });
    const akhir = ambil(/\b(?:sampai|sampe|hingga)\s*(?:jam\s*|pukul\s*)?(\d{1,2})(?:[.:](\d{2}))?(?:\s*(?:pagi|siang|sore|malam))?/g, m => +m[1] + (m[2] ? +m[2] / 60 : 0));
    const mulai = ambil(/\b(?:jam|pukul)\s*(setengah\s*)?(\d{1,2})(?:[.:](\d{2}))?(?:\s*(pagi|siang|sore|malam))?/g, m => {
      let jam = +m[2], menit = m[3] ? +m[3] : 0, ragu = false;
      if (jam > 23) return undefined;
      if (m[1]) { jam -= 1; menit = 30; }
      if (m[4] === "pagi") { if (jam === 12) jam = 0; }
      else if (m[4] === "siang") { if (jam < 5) jam += 12; }
      else if (m[4] === "sore" || m[4] === "malam") { if (jam < 12) jam += 12; }
      else if (jam <= 5) jam += 12;                                      // "jam 4" tanpa keterangan → 16.00
      else if (jam <= 11) { jam += 12; ragu = true; }                   // "jam 8" → anggap malam, bisa diganti pagi
      return { jam, menit: menit >= 30 ? 30 : 0, ragu };
    });
    const durasi = ambil(/\b(\d+(?:\.\d+)?)\s*(setengah\s*)?jam(\s*setengah)?\b|\bdurasi(?:nya)?\s*(\d+(?:\.\d+)?)(\s*setengah)?\b|\bsetengah jam\b/g,
      m => m[1] ? +m[1] + (m[2] || m[3] ? 0.5 : 0) : m[4] ? +m[4] + (m[5] ? 0.5 : 0) : 0.5);

    // lapangan: potongan 1–3 kata yang mirip nama lapangan (ejaan longgar), ambil yang paling mirip & tidak tumpang tindih
    const kata = [...t.matchAll(/\S+/g)].map(m => ({ w: m[0], i: m.index }));
    const calon = [];
    kata.forEach((k, a) => { if (/^lapangan$/.test(k.w) && kata[a + 1] && /^lain/.test(kata[a + 1].w)) calon.push({ i: k.i, a, b: a + 1, l: daftar.lapangan.find(l => /LAIN/.test(l)), skor: 1 }); });
    daftar.lapangan.filter(l => !/LAIN/.test(l)).forEach(l => {
      const kunci = longgar(l), n = l.split(" ").length;
      for (let p = 1; p <= Math.min(3, n + 1); p++) for (let a = 0; a + p <= kata.length; a++) {
        const c = longgar(kata.slice(a, a + p).map(k => k.w).join(" ")); if (c.length < 4 || /^\d+$/.test(c)) continue;
        const skor = 1 - jarak(c, kunci) / Math.max(c.length, kunci.length);
        if (skor >= 0.6) calon.push({ i: kata[a].i, a, b: a + p - 1, l, skor });
      }
    });
    const lapangan = [], dipakai = new Set();
    calon.sort((x, y) => y.skor - x.skor || (y.b - y.a) - (x.b - x.a)).forEach(c => {
      for (let k = c.a; k <= c.b; k++) if (dipakai.has(k)) return;
      for (let k = c.a; k <= c.b; k++) dipakai.add(k);
      if (c.l) lapangan.push({ i: c.i, v: c.l });
    });
    lapangan.sort((x, y) => x.i - y.i);
    const jenis = [...t.matchAll(/\b(video|ngevideo|videoin|rekam|foto|moto|motret|fotoin)\b/g)].map(m => ({ i: m.index, v: /vid|rekam/.test(m[1]) ? "V" : "F" }));

    // ---- susun sesi ----
    const awal = mulai.length ? mulai[0].i : Infinity;
    const sebelum = arr => arr.length > 0 && arr[0].i < awal;            // pola "di Punakha jam 7" vs "jam 7 di Punakha"
    const ambilUntuk = (arr, lo, hi, prev) => sebelum(arr) ? arr.filter(x => x.i > prev && x.i < lo).pop() : arr.find(x => x.i > lo && x.i < hi);
    const titik = mulai.length ? mulai : [{ i: -1, v: null }];
    let bawa = { tanggal: bawaan.tanggal, lapangan: "", durasi: bawaan.durasi, jenis: "FOTO" };
    const sesi = titik.map((s, k) => {
      const lo = s.i, hi = titik[k + 1] ? titik[k + 1].i : Infinity, prev = k ? titik[k - 1].i : -Infinity;
      const pilih = arr => mulai.length ? ambilUntuk(arr, lo, hi, prev) : arr[0];
      const o = { tanggal: pilih(tanggal)?.v ?? bawa.tanggal, lapangan: pilih(lapangan)?.v ?? bawa.lapangan, team: pilih(team)?.v || "",
        kontak: (mulai.length ? kontak.find(x => x.i > lo && x.i < hi) : kontak[0])?.v || "" };
      const ak = mulai.length ? akhir.find(x => x.i > lo && x.i < hi) : null;
      if (s.v && ak) { let e = ak.v; const st = s.v.jam + s.v.menit / 60; if (e < st) e += 12; const d = e - st; o.durasi = d > 0 && d <= 8 ? Math.round(d * 2) / 2 : bawa.durasi; }
      else o.durasi = pilih(durasi)?.v ?? bawa.durasi;
      const js = mulai.length ? jenis.filter(x => sebelum(jenis) ? x.i > prev && x.i < lo : x.i > lo && x.i < hi) : jenis;
      o.jenis = js.length ? (js.some(x => x.v === "V") && js.some(x => x.v === "F") ? "FOTO DAN VIDEO" : js[0].v === "V" ? "VIDEO" : "FOTO") : bawa.jenis;
      if (s.v) { o.jam = s.v.jam; o.menit = s.v.menit; o.jamRagu = s.v.ragu; }
      bawa = { tanggal: o.tanggal, lapangan: o.lapangan, durasi: o.durasi, jenis: o.jenis };
      return o;
    });
    return { nama, sesi };
  }
  // satu sesi saja (dipakai untuk uji cepat)
  const baca = (asli, daftar, hariIniIso) => { const h = bacaBanyak(asli, daftar, hariIniIso); return { nama: h.nama, ...h.sesi[0] }; };

  // ---------- tampilan ----------
  const Rek = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rek = null, dengar = false, hasil = { sesi: [] };

  function buka() {
    $("lapisSuara").classList.add("tampil");
    $("suaraTeks").value = ""; hasil = { sesi: [] }; gambarHasil();
    $("btnMic").hidden = !Rek; $("suaraNoMic").hidden = !!Rek;
    if (Rek) mulai();
  }
  function tutup() { berhenti(); $("lapisSuara").classList.remove("tampil"); }
  function mulai() {
    if (!Rek) return;
    if (dengar) return berhenti();
    rek = new Rek(); rek.lang = "id-ID"; rek.interimResults = true; rek.continuous = true;
    const awal = $("suaraTeks").value.trim();
    rek.onresult = e => {
      let s = ""; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      $("suaraTeks").value = (awal ? awal + " " : "") + s.trim(); perbarui();
    };
    rek.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { toast("Izinkan mikrofon dulu di browser, atau ketik kalimatnya", 3500); $("suaraNoMic").hidden = false; } };
    rek.onend = () => { dengar = false; gambarMic(); };
    try { rek.start(); dengar = true; } catch (_) { dengar = false; }
    gambarMic();
  }
  function berhenti() { if (rek && dengar) rek.stop(); dengar = false; gambarMic(); }
  function gambarMic() {
    $("btnMic").classList.toggle("aktif", dengar);
    $("suaraStatus").textContent = dengar ? "Mendengarkan… ketuk lagi kalau sudah selesai" : Rek ? "Ketuk mic lalu bicara" : "";
  }
  function perbarui() {
    hasil = bacaBanyak($("suaraTeks").value, S.daftar, hariIni(), { tanggal: S.f.tanggal, durasi: S.f.durasi });
    hasil.sesi.forEach(s => {                                          // pakai ejaan team yang sudah pernah dicatat
      if (!s.team) return;
      const k = longgar(s.team), kenal = daftarTeam().map(x => ({ x, skor: 1 - jarak(longgar(x.team), k) / Math.max(k.length, longgar(x.team).length, 1) }))
        .sort((a, b) => b.skor - a.skor)[0];
      if (kenal && kenal.skor >= 0.75) s.team = kenal.x.team;
    });
    gambarHasil();
  }

  const sesiLengkap = s => s.jam !== undefined && s.lapangan && s.team;
  const lengkap = () => (hasil.nama || S.saya) && hasil.sesi.length && hasil.sesi.every(sesiLengkap);
  const tombolPagi = (s, i) => s.jamRagu ? ` <button class="linkbtn" data-pagi="${i}">ganti ke ${keJam((s.jam - 12) * 60 + s.menit)} pagi</button>` : "";
  function gambarHasil() {
    const ada = $("suaraTeks").value.trim().length > 0, sesi = hasil.sesi || [], n = sesi.length;
    const kurang = v => `<b class="kurang">${v}</b>`;
    let html = `<div class="sh-baris"><span>Nama</span>${hasil.nama ? `<b>${hasil.nama}</b>` : S.saya ? `<b>${esc(S.saya)} <small style="font-weight:normal;color:var(--redup)">(dari HP ini)</small></b>` : kurang("belum terdengar")}</div>`;
    if (n <= 1) {
      const s = sesi[0] || {};
      html += [
        ["Tanggal", s.tanggal ? `<b>${tglPanjang(s.tanggal)}</b>` : kurang("belum terdengar")],
        ["Jam", s.jam !== undefined ? `<b>${keJam(s.jam * 60 + s.menit)}–${keJam(s.jam * 60 + s.menit + s.durasi * 60)}</b>${tombolPagi(s, 0)}` : kurang("belum terdengar")],
        ["Durasi", `<b>${angkaJam(s.durasi ?? S.f.durasi)} jam</b>`],
        ["Lapangan", s.lapangan ? `<b>${s.lapangan}</b>` : kurang("belum terdengar")],
        ["Team", s.team ? `<b>${esc(s.team)}</b>` : kurang("belum terdengar")],
        ["Jenis", `<b>${JENIS.find(j => j[0] === s.jenis)?.[1] || "Foto"}</b>`],
        ...(s.kontak ? [["Kontak", `<b>${s.kontak}</b>`]] : []),
      ].map(([k, v]) => `<div class="sh-baris"><span>${k}</span>${v}</div>`).join("");
    } else {
      html += `<div class="sh-baris"><span>Sesi</span><b>${n} sesi terbaca</b></div>` + sesi.map((s, i) => `<div class="sh-sesi ${sesiLengkap(s) ? "" : "belum"}">
        <b>${tglPendek(s.tanggal)} · ${keJam(s.jam * 60 + s.menit)}–${keJam(s.jam * 60 + s.menit + s.durasi * 60)}</b>${tombolPagi(s, i)}<br>
        ${s.lapangan || '<span class="kurang">lapangan?</span>'} · ${s.team ? esc(s.team) : '<span class="kurang">team?</span>'}${s.jenis !== "FOTO" ? " · " + JENIS.find(j => j[0] === s.jenis)[1] : ""}</div>`).join("");
    }
    $("suaraHasil").hidden = !ada;
    $("suaraHasil").innerHTML = html;
    $("suaraHasil").querySelectorAll("[data-pagi]").forEach(b => b.onclick = () => { const s = hasil.sesi[+b.dataset.pagi]; s.jam -= 12; s.jamRagu = false; gambarHasil(); });
    $("suaraSimpan").disabled = !ada || !lengkap();
    $("suaraSimpan").textContent = n > 1 ? `Simpan semua (${n})` : "Simpan sekarang";
    $("suaraIsi").disabled = !ada;
  }
  function terapkan() {
    if (hasil.nama) { S.saya = hasil.nama; S.gantiSaya = false; simpanLokal("af_saya", S.saya); }
    const sesi = hasil.sesi || [];
    if (sesi.length > 1) {                                             // banyak sesi → masuk daftar mode "Banyak sekaligus"
      S.mode = "banyak"; simpanLokal("af_mode", "banyak");
      BANYAK.tambah(sesi.filter(s => s.jam !== undefined).map(s => ({ tanggal: s.tanggal, jam: s.jam, menit: s.menit, durasi: s.durasi,
        lapangan: s.lapangan || "", team: s.team || "", jenis: s.jenis, kontak: s.kontak || "" })));
      S.f.tanggal = sesi[sesi.length - 1].tanggal;
      gambarAbsen(); return;
    }
    S.mode = "satu"; simpanLokal("af_mode", "satu");
    const h = sesi[0] || {}, f = S.f;
    if (h.tanggal) f.tanggal = h.tanggal;
    if (h.jam !== undefined) { f.jam = h.jam; f.menit = h.menit; }
    if (h.durasi !== undefined) f.durasi = h.durasi;
    if (h.lapangan) f.lapangan = h.lapangan;
    if (h.team) { f.team = h.team; $("team").value = h.team; }
    if (h.jenis) f.jenis = h.jenis;
    if (h.kontak) { f.kontak = h.kontak; $("kontak").value = h.kontak; bukaTambahan(true); }
    else if (h.team && !f.kontak) {
      const t = daftarTeam().find(x => x.team.toLowerCase() === h.team.toLowerCase());
      if (t && t.kontak) { f.kontak = String(t.kontak); $("kontak").value = f.kontak; bukaTambahan(true); }
    }
    gambarAbsen();
  }

  function pasang() {
    $("btnSuara").onclick = buka;
    $("btnMic").onclick = mulai;
    $("suaraTutup").onclick = tutup;
    $("suaraTeks").oninput = perbarui;
    $("suaraIsi").onclick = () => {
      const n = hasil.sesi.length; terapkan(); tutup();
      if (n > 1) { $("kartuBanyak").scrollIntoView({ block: "start" }); toast(`${n} sesi masuk daftar — cek lalu tekan Simpan semua`, 3200); }
      else { window.scrollTo(0, 0); toast("Form terisi — cek lagi lalu tekan Simpan", 3000); }
    };
    $("suaraSimpan").onclick = async () => { const n = hasil.sesi.length; terapkan(); tutup(); await (n > 1 ? BANYAK.simpan() : simpanAbsen()); };
  }
  return { pasang, baca, bacaBanyak };
})();
