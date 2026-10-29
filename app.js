// Absensi FotoFauk — tampilan & logika. Semua input dibuat sekali ketuk (chip), yang wajib diketik cuma nama team.
const $ = id => document.getElementById(id);
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const JENIS = [["FOTO", "Foto"], ["VIDEO", "Video"], ["FOTO DAN VIDEO", "Foto + Video"]];
const DURASI = [1, 1.5, 2, 2.5, 3, 4];
const JAM_MULAI = 6, JAM_AKHIR = 23;

const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keTanggal = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const tglPanjang = s => { const d = keTanggal(s); return `${HARI[d.getDay()]}, ${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`; };
const tglPendek = s => { const d = keTanggal(s); return `${HARI[d.getDay()].slice(0, 3)} ${d.getDate()} ${BLN[d.getMonth()]}`; };
const menitDari = j => { const [h, m] = String(j).split(":").map(Number); return h * 60 + (m || 0); };
const keJam = mnt => `${pad(Math.floor(mnt / 60) % 24)}.${pad(mnt % 60)}`;
const jamTampil = j => keJam(menitDari(j));
const rentangJam = r => `${jamTampil(r.jam)}–${keJam(menitDari(r.jam) + Math.round(r.durasi * 60))}`;
const angkaJam = n => (Math.round(n * 100) / 100).toLocaleString("id-ID");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const buatId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const simpanLokal = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const bacaLokal = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };

const hariIni = () => iso(new Date());
const S = {
  rows: [], daftar: { nama: [], lapangan: [] }, sheetUrl: "",
  saya: bacaLokal("af_saya") || "", gantiSaya: false,
  mode: bacaLokal("af_mode") === "banyak" ? "banyak" : "satu", banyak: [],
  akses: false, teams: [], tim: !!bacaLokal("af_pin_tim"), galat: "",
  f: { tanggal: hariIni(), jam: null, menit: 0, durasi: 1, lapangan: "", lapLain: "", team: "", kontak: "", catatan: "", jenis: "FOTO" },
  bulan: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  sNama: "", sLap: "", cari: "",
  periode: "bulan", rDari: "", rSampai: "", rNama: "",
};

let toastT;
function toast(t, lama = 2400) { const e = $("toast"); e.textContent = t; e.classList.add("tampil"); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove("tampil"), lama); }
function status(t, kelas) { const e = $("status"); e.textContent = t; e.className = "status " + (kelas || ""); }
function chip(teks, pilih, data, kelas = "") { return `<button class="chip ${kelas} ${pilih ? "pilih" : ""}" ${data}>${teks}</button>`; }
const semua = () => [...S.rows, ...API.antre().filter(a => !S.rows.some(r => r.id === a.id)).map(a => ({ ...a, _antre: true }))];

// =================== ABSEN ===================
function gambarSaya() {
  const k = $("kartuSaya");
  if (S.saya && !S.gantiSaya) {
    k.className = "";
    k.innerHTML = `<div class="saya-bar">Absen sebagai <b>${esc(S.saya)}</b><button class="linkbtn" id="btnGanti">Ganti</button></div>`;
    $("btnGanti").onclick = () => { S.gantiSaya = true; gambarSaya(); };
  } else {
    k.className = "kartu";
    k.innerHTML = `<div class="langkah"><span>👤</span>Kamu siapa? <small style="font-size:13px;font-weight:normal;color:var(--redup)">diingat di HP ini</small></div>
      <div class="chips">${S.daftar.nama.map(n => chip(esc(n), n === S.saya, `data-saya="${esc(n)}"`)).join("")}</div>`;
    k.querySelectorAll("[data-saya]").forEach(b => b.onclick = () => {
      S.saya = b.dataset.saya; S.gantiSaya = false; simpanLokal("af_saya", S.saya); gambarAbsen();
    });
  }
}

function terpakai(tanggal, lapangan, kecualiId) {
  return semua().filter(r => r.tanggal === tanggal && r.lapangan === lapangan && r.id !== kecualiId);
}
function lapanganForm() { return S.f.lapangan === "LAPANGAN LAINNYA" && S.f.lapLain.trim() ? S.f.lapLain.trim().toUpperCase() : S.f.lapangan; }

function gambarAbsen() {
  gambarSaya();
  const f = S.f, kemarin = iso(new Date(Date.now() - 864e5));
  $("isiTanggal").textContent = tglPanjang(f.tanggal);
  $("isiHari").textContent = f.tanggal === hariIni() ? "Hari ini" : f.tanggal === kemarin ? "Kemarin" : "";
  $("tglLain").value = f.tanggal;
  $("tglMaju").disabled = f.tanggal >= hariIni();

  const banyak = BANYAK.aktif();
  $("pilMode").innerHTML = [["satu", "Satu absen"], ["banyak", "Banyak sekaligus"]].map(([v, t]) => `<button class="${S.mode === v ? "pilih" : ""}" data-mode="${v}">${t}</button>`).join("");
  $("kartuTeam").hidden = banyak; $("kartuBanyak").hidden = !banyak;
  $("subJam").firstChild.textContent = banyak ? "Jam mulai — boleh pilih banyak " : "Jam mulai ";
  $("subDurasi").textContent = banyak ? "Durasi tiap sesi (jam)" : "Durasi (jam)";

  // jam: arsir jam yang lapangannya sudah terisi di tanggal itu
  const sibuk = new Set();
  if (f.lapangan) terpakai(f.tanggal, lapanganForm()).forEach(r => {
    for (let m = menitDari(r.jam); m < menitDari(r.jam) + r.durasi * 60; m += 60) sibuk.add(Math.floor(m / 60));
  });
  let jamHtml = "";
  const dipilih = banyak ? BANYAK.terpilih() : [];
  for (let h = JAM_MULAI; h <= JAM_AKHIR; h++) {
    const mulai = banyak ? dipilih.some(r => r.jam === h) : f.jam === h;
    const dalam = banyak ? dipilih.some(r => h > r.jam && h < r.jam + r.menit / 60 + r.durasi) : f.jam !== null && h > f.jam && h < f.jam + f.menit / 60 + f.durasi;
    jamHtml += chip(pad(h), mulai, `data-jam="${h}"`, (dalam ? "dalam " : "") + (sibuk.has(h) && !mulai && !dalam ? "terpakai" : ""));
  }
  $("pilJam").innerHTML = jamHtml;
  const seg = (teks, pilih, data) => `<button class="${pilih ? "pilih" : ""}" ${data}>${teks}</button>`;
  $("pilMenit").innerHTML = [0, 30].map(m => seg(":" + pad(m), f.menit === m, `data-menit="${m}"`)).join("");
  $("isiJam").textContent = banyak ? (dipilih.length ? `${dipilih.length} sesi` : "") : f.jam === null ? "" : `${keJam(f.jam * 60 + f.menit)}–${keJam(f.jam * 60 + f.menit + f.durasi * 60)}`;

  $("pilDurasi").innerHTML = DURASI.map(d => seg(angkaJam(d), f.durasi === d, `data-durasi="${d}"`)).join("");
  $("pilLapangan").innerHTML = S.daftar.lapangan.map(l => chip(esc(l), f.lapangan === l, `data-lap="${esc(l)}"`)).join("");
  $("lapLain").hidden = f.lapangan !== "LAPANGAN LAINNYA";
  $("pilJenis").innerHTML = JENIS.map(([v, t]) => seg(t, f.jenis === v, `data-jenis="${v}"`)).join("");
  if (banyak) { BANYAK.gambarDaftar(); BANYAK.gambarRingkas(); }
  else { $("btnSimpan").textContent = "Simpan absen"; gambarSaranTeam(); gambarRingkas(); }
}

function daftarTeam() {
  const peta = new Map();                                         // team → data terbaru (kontak terakhir)
  [...semua()].sort((a, b) => (b.tanggal + b.jam).localeCompare(a.tanggal + a.jam)).forEach(r => {
    const k = String(r.team || "").trim(); if (k && !peta.has(k.toLowerCase())) peta.set(k.toLowerCase(), { team: k, kontak: r.kontak, lapangan: r.lapangan });
  });
  S.teams.forEach(t => { const k = String(t).trim(); if (k && !peta.has(k.toLowerCase())) peta.set(k.toLowerCase(), { team: k, kontak: "", lapangan: "" }); });
  return [...peta.values()];
}
function gambarSaranTeam() {
  const q = S.f.team.trim().toLowerCase();
  let t = daftarTeam();
  if (q) t = t.filter(x => x.team.toLowerCase().includes(q) && x.team.toLowerCase() !== q);
  else if (S.f.lapangan) t = [...t.filter(x => x.lapangan === lapanganForm()), ...t.filter(x => x.lapangan !== lapanganForm())];
  $("saranTeam").innerHTML = t.slice(0, 8).map(x => chip(esc(x.team), false, `data-team="${esc(x.team)}"`, "kecil")).join("");
  $("saranTeam").hidden = !t.length;
}

function kurang() {
  const f = S.f, k = [];
  if (!S.saya) k.push("nama kamu");
  if (f.jam === null) k.push("jam");
  if (!f.lapangan) k.push("lapangan");
  if (!f.team.trim()) k.push("nama team");
  return k;
}
function bentrok(row) {
  const a = menitDari(row.jam), b = a + row.durasi * 60;
  return terpakai(row.tanggal, row.lapangan, row.id).filter(r => menitDari(r.jam) < b && menitDari(r.jam) + r.durasi * 60 > a);
}
function rowForm() {
  const f = S.f;
  return { id: buatId(), nama: S.saya, tanggal: f.tanggal, jam: `${pad(f.jam)}:${pad(f.menit)}`, durasi: f.durasi, lapangan: lapanganForm(),
    team: f.team.trim(), kontak: f.kontak.trim(), catatan: f.catatan.trim(), jenis: f.jenis };
}
function gambarRingkas() {
  const k = kurang(), f = S.f;
  const bagian = [tglPendek(f.tanggal), f.jam === null ? "" : `${keJam(f.jam * 60 + f.menit)}–${keJam(f.jam * 60 + f.menit + f.durasi * 60)}`,
    f.lapangan ? lapanganForm() : "", f.team.trim()].filter(Boolean);
  $("ringkas").innerHTML = `<b>${bagian.map(esc).join(" · ")}</b>` + (k.length ? `<span style="color:#c2410c"> — belum: ${k.join(", ")}</span>` : "");
  $("btnSimpan").disabled = k.length > 0;
  const bt = k.length ? [] : bentrok(rowForm());
  $("bentrok").classList.toggle("tampil", bt.length > 0);
  $("bentrok").innerHTML = bt.length ? `⚠️ Jam ini sudah diisi: ${bt.map(r => `<b>${esc(r.nama)}</b> ${rentangJam(r)} (${esc(r.team)})`).join(", ")} — cek biar tidak dobel.` : "";
}

function geserTanggal(n) {
  const d = keTanggal(S.f.tanggal); d.setDate(d.getDate() + n);
  if (iso(d) <= hariIni()) { S.f.tanggal = iso(d); gambarAbsen(); }
}
function bukaTambahan(buka) { $("tambahan").hidden = !buka; $("btnTambahan").hidden = buka; }

function pasangAbsen() {
  $("layarAbsen").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset, f = S.f;
    if (d.mode) { S.mode = d.mode; simpanLokal("af_mode", S.mode); }
    else if (d.jam) { if (BANYAK.aktif()) BANYAK.ketukJam(Number(d.jam)); else f.jam = Number(d.jam); }
    else if (d.menit) f.menit = Number(d.menit);
    else if (d.durasi) f.durasi = Number(d.durasi);
    else if (d.lap) { f.lapangan = d.lap; if (d.lap === "LAPANGAN LAINNYA") setTimeout(() => $("lapLain").focus(), 50); }
    else if (d.jenis) f.jenis = d.jenis;
    else if (d.team) {
      f.team = d.team; $("team").value = d.team;
      const t = daftarTeam().find(x => x.team === d.team);
      if (t && t.kontak && !f.kontak) { f.kontak = String(t.kontak); $("kontak").value = f.kontak; bukaTambahan(true); }
    } else return;
    gambarAbsen();
  });
  $("tglMundur").onclick = () => geserTanggal(-1);
  $("tglMaju").onclick = () => geserTanggal(1);
  $("tglLain").max = hariIni();
  $("tglLain").onchange = e => { if (e.target.value) { S.f.tanggal = e.target.value; gambarAbsen(); } };
  $("btnTambahan").onclick = () => { bukaTambahan(true); $("kontak").focus(); };
  $("lapLain").oninput = e => { S.f.lapLain = e.target.value; gambarRingkas(); };
  $("team").oninput = e => { S.f.team = e.target.value; gambarSaranTeam(); gambarRingkas(); };
  $("kontak").oninput = e => { S.f.kontak = e.target.value; };
  $("catatan").oninput = e => { S.f.catatan = e.target.value; };
  $("btnSimpan").onclick = () => BANYAK.aktif() ? BANYAK.simpan() : simpanAbsen();
}

async function simpanAbsen() {
  if (kurang().length) return;
  const row = rowForm(), btn = $("btnSimpan");
  btn.disabled = true; btn.textContent = "Menyimpan…";
  try {
    const j = await API.tambah(row);
    if (j.rows) S.rows = j.rows;
    toast(j.antre ? `Disimpan di HP (sinyal lemah) — dikirim otomatis nanti` : `Tersimpan ✓ ${rentangJam(row)} · ${row.lapangan}`, 3200);
    // siap untuk sesi berikutnya: jam lanjut, team dikosongkan, sisanya tetap
    const akhir = S.f.jam * 60 + S.f.menit + S.f.durasi * 60;
    Object.assign(S.f, { jam: Math.floor(akhir / 60) <= JAM_AKHIR ? Math.floor(akhir / 60) : null, menit: akhir % 60, team: "", kontak: "", catatan: "" });
    $("team").value = $("kontak").value = $("catatan").value = "";
    bukaTambahan(false);
    perbaruiStatus();
  } catch (e) {
    if (e.kode === "pin_salah") mintaPin(); else toast("Gagal menyimpan: " + e.message, 4000);
  }
  gambarSemua();
}

// =================== DATA ===================
function gambarData() {
  const b = S.bulan, awal = iso(b), akhir = iso(new Date(b.getFullYear(), b.getMonth() + 1, 0));
  $("blnJudul").textContent = `${BULAN[b.getMonth()]} ${b.getFullYear()}`;
  $("saringNama").innerHTML = chip("Semua", !S.sNama, `data-snama=""`, "kecil") + S.daftar.nama.map(n => chip(esc(n), S.sNama === n, `data-snama="${esc(n)}"`, "kecil")).join("");
  $("saringLap").innerHTML = chip("Semua lapangan", !S.sLap, `data-slap=""`, "kecil") + S.daftar.lapangan.map(n => chip(esc(n), S.sLap === n, `data-slap="${esc(n)}"`, "kecil")).join("");
  const q = S.cari.trim().toLowerCase();
  const rows = semua().filter(r => r.tanggal >= awal && r.tanggal <= akhir && (!S.sNama || r.nama === S.sNama) && (!S.sLap || r.lapangan === S.sLap)
    && (!q || [r.team, r.kontak, r.catatan, r.nama, r.lapangan].join(" ").toLowerCase().includes(q)));
  const jamTotal = rows.reduce((t, r) => t + r.durasi, 0);
  $("ringkasData").innerHTML = rows.length ? `<div><b>${rows.length}</b><span>sesi</span></div><div><b>${angkaJam(jamTotal)}</b><span>jam kerja</span></div>
    <div><b>${new Set(rows.map(r => r.lapangan)).size}</b><span>lapangan</span></div>` : "";
  if (!rows.length) { $("daftarData").innerHTML = `<div class="kosong">Belum ada absen di ${BULAN[b.getMonth()]}${S.sNama || S.sLap || q ? " untuk saringan ini" : ""}.</div>`; return; }
  const perHari = {};
  rows.forEach(r => (perHari[r.tanggal] ||= []).push(r));
  $("daftarData").innerHTML = Object.keys(perHari).sort().reverse().map(t => {
    const isi = perHari[t].sort((a, c) => a.jam.localeCompare(c.jam) || a.lapangan.localeCompare(c.lapangan));
    const jam = isi.reduce((s, r) => s + r.durasi, 0);
    return `<div class="hari"><b>${tglPanjang(t)}</b><span>${isi.length} sesi · ${angkaJam(jam)} jam</span></div>` + isi.map(r =>
      `<button class="item ${r._antre ? "antre" : ""}" data-id="${esc(r.id)}">
        <div class="jam">${jamTampil(r.jam)}<small>${angkaJam(r.durasi)} jam</small></div>
        <div class="tengah"><b>${esc(r.lapangan)}</b><span>${esc(r.team)} · ${esc(JENIS.find(j => j[0] === r.jenis)?.[1] || r.jenis)}${r.kontak ? " · " + esc(r.kontak) : ""}${r._antre ? " · menunggu sinyal" : ""}</span></div>
        <span class="siapa">${esc(r.nama)}</span></button>`).join("");
  }).join("");
}
function pasangData() {
  $("blnMundur").onclick = () => { S.bulan = new Date(S.bulan.getFullYear(), S.bulan.getMonth() - 1, 1); gambarData(); };
  $("blnMaju").onclick = () => { S.bulan = new Date(S.bulan.getFullYear(), S.bulan.getMonth() + 1, 1); gambarData(); };
  $("cari").oninput = e => { S.cari = e.target.value; gambarData(); };
  $("layarData").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if ("snama" in b.dataset) { S.sNama = b.dataset.snama; gambarData(); }
    else if ("slap" in b.dataset) { S.sLap = b.dataset.slap; gambarData(); }
    else if (b.dataset.id) bukaUbah(b.dataset.id);
  });
}

// ---- ubah / hapus satu absen ----
function bukaUbah(id) {
  const r = semua().find(x => x.id === id); if (!r) return;
  if (r._antre) { toast("Absen ini masih menunggu sinyal — bisa diubah setelah terkirim"); return; }
  S.ubahId = id;
  if (!S.akses) {                                                   // tanpa PIN: lihat saja, ubah/hapus & kontak butuh PIN
    $("lembarUbah").innerHTML = `<h2>Absen No ${r.no} <button class="linkbtn" data-tutup="lapisUbah">Tutup</button></h2>
      <div class="kartu">${[["Fotografer", r.nama], ["Tanggal", tglPanjang(r.tanggal)], ["Jam", `${rentangJam(r)} (${angkaJam(r.durasi)} jam)`],
        ["Lapangan", r.lapangan], ["Team", r.team], ["Jenis", JENIS.find(j => j[0] === r.jenis)?.[1] || r.jenis]]
        .map(([k, v]) => `<div class="detail-baris"><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
      <div class="gembok-isi" style="margin-top:0"><div class="ikon">🔒</div><h3>Ubah, hapus & kontak</h3><p>Masukkan PIN tim untuk mengubah absen ini atau melihat kontak pemesan.</p>
        <input class="isian" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="••••">
        <button class="tombol utama kecil" data-buka>Buka</button><p class="salah"></p></div>`;
    $("lapisUbah").classList.add("tampil");
    return;
  }
  const opsi = (arr, v) => [...new Set([...arr, v])].map(x => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
  $("lembarUbah").innerHTML = `<h2>Ubah absen No ${r.no} <button class="linkbtn" data-tutup="lapisUbah">Tutup</button></h2>
    <div class="kartu">
      <p class="label">Fotografer</p><select class="isian" id="uNama">${opsi(S.daftar.nama, r.nama)}</select>
      <div class="grid-2 lipat"><div><p class="label">Tanggal</p><input type="date" class="isian" id="uTgl" value="${r.tanggal}"></div>
        <div><p class="label">Jam mulai</p><input type="time" class="isian" id="uJam" step="1800" value="${pad(Math.floor(menitDari(r.jam) / 60))}:${pad(menitDari(r.jam) % 60)}"></div></div>
      <div class="grid-2 lipat"><div><p class="label">Durasi (jam)</p><input type="number" class="isian" id="uDur" step="0.5" min="0.5" value="${r.durasi}"></div>
        <div><p class="label">Jenis</p><select class="isian" id="uJenis">${JENIS.map(([v, t]) => `<option value="${v}" ${v === r.jenis ? "selected" : ""}>${t}</option>`).join("")}</select></div></div>
      <p class="label lipat">Lapangan</p><select class="isian" id="uLap">${opsi(S.daftar.lapangan, r.lapangan)}</select>
      <p class="label lipat">Nama team</p><input class="isian" id="uTeam" value="${esc(r.team)}">
      <p class="label lipat">Kontak</p><input class="isian" id="uKontak" value="${esc(r.kontak)}">
      <p class="label lipat">Catatan</p><input class="isian" id="uCat" value="${esc(r.catatan)}">
    </div>
    <button class="tombol utama" id="uSimpan">Simpan perubahan</button>
    <button class="tombol bahaya lipat" id="uHapus">Hapus absen ini</button>
    <p class="catatan-kecil">Diinput ${r.dibuat ? new Date(r.dibuat).toLocaleString("id-ID") : "-"}${r.diubah ? " · diubah " + new Date(r.diubah).toLocaleString("id-ID") : ""}</p>`;
  $("lapisUbah").classList.add("tampil");
  $("uSimpan").onclick = async () => {
    const baru = { ...r, nama: $("uNama").value, tanggal: $("uTgl").value, jam: $("uJam").value, durasi: Number($("uDur").value) || r.durasi,
      lapangan: $("uLap").value, team: $("uTeam").value.trim(), kontak: $("uKontak").value.trim(), catatan: $("uCat").value.trim(), jenis: $("uJenis").value };
    await jalankan(() => API.ubah(baru), "Perubahan tersimpan ✓");
  };
  $("uHapus").onclick = async () => {
    if (!confirm(`Hapus absen ${r.nama} · ${tglPendek(r.tanggal)} ${rentangJam(r)} · ${r.lapangan}?`)) return;
    await jalankan(() => API.hapus(r.id), "Absen dihapus");
  };
}
async function jalankan(fn, pesan) {
  try { const j = await fn(); if (j.rows) S.rows = j.rows; $("lapisUbah").classList.remove("tampil"); toast(pesan); gambarSemua(); }
  catch (e) { if (e.kode === "pin_salah") mintaPin(); else toast("Gagal: " + e.message, 4000); }
}

// =================== REKAP ===================
function periodeAktif() {
  const n = new Date();
  if (S.periode === "bulan") return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(new Date(n.getFullYear(), n.getMonth() + 1, 0)), `${BULAN[n.getMonth()]} ${n.getFullYear()}`];
  if (S.periode === "lalu") { const a = new Date(n.getFullYear(), n.getMonth() - 1, 1); return [iso(a), iso(new Date(n.getFullYear(), n.getMonth(), 0)), `${BULAN[a.getMonth()]} ${a.getFullYear()}`]; }
  if (S.periode === "minggu") {
    const a = new Date(n); a.setDate(n.getDate() - ((n.getDay() + 6) % 7)); const b = new Date(a); b.setDate(a.getDate() + 6);
    return [iso(a), iso(b), `${tglPendek(iso(a))} – ${tglPendek(iso(b))} ${b.getFullYear()}`];
  }
  const d = S.rDari || iso(new Date(n.getFullYear(), n.getMonth(), 1)), s = S.rSampai || hariIni();
  return [d, s, `${tglPendek(d)} – ${tglPendek(s)} ${keTanggal(s).getFullYear()}`];
}
function dataRekap() {
  const [dari, sampai, judul] = periodeAktif();
  const rows = S.rows.filter(r => r.tanggal >= dari && r.tanggal <= sampai && (!S.rNama || r.nama === S.rNama))
    .sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam) || a.nama.localeCompare(b.nama));
  const kelompok = kunci => {
    const m = {}; rows.forEach(r => { const k = r[kunci]; (m[k] ||= { nama: k, sesi: 0, jam: 0, foto: 0, video: 0 }); m[k].sesi++; m[k].jam += r.durasi;
      if (r.jenis !== "VIDEO") m[k].foto++; if (r.jenis !== "FOTO") m[k].video++; });
    return Object.values(m).sort((a, b) => b.jam - a.jam || a.nama.localeCompare(b.nama));
  };
  return { dari, sampai, judul, nama: S.rNama, rows, perFoto: kelompok("nama"), perLap: kelompok("lapangan"),
    sesi: rows.length, jam: rows.reduce((s, r) => s + r.durasi, 0), sheetUrl: S.sheetUrl, ...seriGrafik(rows, dari, sampai) };
}
// data grafik: tren per hari (per minggu kalau periodenya > 62 hari), jam ramai, hari ramai
function seriGrafik(rows, dari, sampai) {
  const hariKe = s => Math.round((keTanggal(s) - keTanggal(dari)) / 864e5), nHari = hariKe(sampai) + 1, perMinggu = nHari > 62;
  const tren = [];
  if (!perMinggu) for (let i = 0; i < nHari; i++) {
    const d = keTanggal(dari); d.setDate(d.getDate() + i);
    tren.push({ label: String(d.getDate()), labelPanjang: tglPanjang(iso(d)), jam: 0, sesi: 0 });
  } else for (let i = 0; i < Math.ceil(nHari / 7); i++) {
    const d = keTanggal(dari); d.setDate(d.getDate() + i * 7);
    tren.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, labelPanjang: `Minggu mulai ${tglPanjang(iso(d))}`, jam: 0, sesi: 0 });
  }
  const jamRamai = Array.from({ length: JAM_AKHIR - JAM_MULAI + 1 }, (_, i) => ({ label: pad(JAM_MULAI + i), nilai: 0 }));
  const urutHari = [1, 2, 3, 4, 5, 6, 0], hariRamai = urutHari.map(h => ({ label: HARI[h].slice(0, 3), nilai: 0, sesi: 0 }));
  rows.forEach(r => {
    const t = tren[perMinggu ? Math.floor(hariKe(r.tanggal) / 7) : hariKe(r.tanggal)]; if (t) { t.jam += r.durasi; t.sesi++; }
    const j = jamRamai[Math.floor(menitDari(r.jam) / 60) - JAM_MULAI]; if (j) j.nilai++;
    const h = hariRamai[urutHari.indexOf(keTanggal(r.tanggal).getDay())]; h.nilai += r.durasi; h.sesi++;
  });
  tren.periode = perMinggu ? "minggu" : "hari";
  jamRamai.forEach(x => x.tip = `Mulai jam ${x.label}.00\n${x.nilai} sesi`);
  hariRamai.forEach((x, i) => x.tip = `${HARI[urutHari[i]]}\n${angkaJam(x.nilai)} jam · ${x.sesi} sesi`);
  return { tren, jamRamai, hariRamai };
}
function gambarGrafik(d) {
  const lebar = id => Math.max(300, Math.round($(id).clientWidth || 340));
  $("gTren").innerHTML = d.rows.length ? GRAFIK.tren(d.tren, lebar("gTren"), 230) : `<p class="kosong" style="padding:20px">Belum ada data</p>`;
  $("kartuGFoto").hidden = !!d.nama || !d.rows.length;
  if (!$("kartuGFoto").hidden) $("gFoto").innerHTML = GRAFIK.batang(d.perFoto, lebar("gFoto"));
  $("kartuGLap").hidden = !d.rows.length;
  if (d.rows.length) {
    $("gLap").innerHTML = GRAFIK.batang(d.perLap, lebar("gLap"));
    $("gJam").innerHTML = GRAFIK.kolom(d.jamRamai, lebar("gJam"), 170, "sesi");
    $("gHari").innerHTML = GRAFIK.kolom(d.hariRamai, lebar("gHari"), 170, "jam");
  }
  $("kartuGRamai").hidden = !d.rows.length;
}
function gambarRekap() {
  $("pilPeriode").innerHTML = [["bulan", "Bulan ini"], ["lalu", "Bulan lalu"], ["minggu", "Minggu ini"], ["pilih", "📅 Pilih tanggal"]]
    .map(([v, t]) => chip(t, S.periode === v, `data-periode="${v}"`, "kecil")).join("");
  $("rentang").hidden = S.periode !== "pilih";
  $("rekapNama").innerHTML = chip("Semua", !S.rNama, `data-rnama=""`, "kecil") + S.daftar.nama.map(n => chip(esc(n), S.rNama === n, `data-rnama="${esc(n)}"`, "kecil")).join("");
  const d = dataRekap();
  $("isiEkspor").textContent = `${d.judul}${d.nama ? " · " + d.nama : ""}`;
  $("angka").innerHTML = `<div><b>${d.sesi}</b><span>sesi</span></div><div><b>${angkaJam(d.jam)}</b><span>jam kerja</span></div>
    <div><b>${d.nama ? d.perLap.length : d.perFoto.length}</b><span>${d.nama ? "lapangan" : "fotografer"}</span></div>`;
  const tabel = (arr, kolom) => !arr.length ? `<tr><td class="kosong" style="padding:16px">Belum ada data</td></tr>` :
    `<tr><th>${kolom}</th><th class="n">Sesi</th><th class="n">Jam</th></tr>` + arr.map(x => `<tr><td>${esc(x.nama)}</td><td class="n">${x.sesi}</td><td class="n">${angkaJam(x.jam)}</td></tr>`).join("")
    + `<tr class="total"><td>Total</td><td class="n">${d.sesi}</td><td class="n">${angkaJam(d.jam)}</td></tr>`;
  gambarGrafik(d);
  $("tFoto").innerHTML = tabel(d.perFoto, "Fotografer");
  $("tLap").innerHTML = tabel(d.perLap, "Lapangan");
  $("eSheet").hidden = !S.sheetUrl;
}
function pasangRekap() {
  $("layarRekap").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.periode) { S.periode = b.dataset.periode; gambarRekap(); }
    else if ("rnama" in b.dataset) { S.rNama = b.dataset.rnama; gambarRekap(); }
  });
  GRAFIK.pasangTooltip($("layarRekap"));
  let tunda; window.addEventListener("resize", () => { clearTimeout(tunda); tunda = setTimeout(() => $("layarRekap").classList.contains("aktif") && gambarRekap(), 200); });
  $("rDari").onchange = e => { S.rDari = e.target.value; gambarRekap(); };
  $("rSampai").onchange = e => { S.rSampai = e.target.value; gambarRekap(); };
  const ekspor = fn => async () => {
    const d = dataRekap();
    if (!d.rows.length) return toast("Tidak ada data di periode ini");
    try { await fn(d); } catch (e) { toast("Gagal ekspor: " + e.message, 4000); }
  };
  $("ePdf").onclick = ekspor(EKSPOR.pdf);
  $("eXlsx").onclick = ekspor(EKSPOR.xlsx);
  $("ePng").onclick = ekspor(EKSPOR.png);
  $("eCsv").onclick = ekspor(EKSPOR.csv);
  $("eWa").onclick = ekspor(EKSPOR.wa);
  $("eSheet").onclick = () => S.sheetUrl && window.open(S.sheetUrl, "_blank");
}

// =================== PENGATURAN ===================
function bukaAtur() {
  $("aturNama").value = S.daftar.nama.join("\n");
  $("aturLap").value = S.daftar.lapangan.join("\n");
  $("aturPin").value = "";
  $("lapisAtur").classList.add("tampil");
}
// PIN salah / sudah diganti admin → kunci lagi HP ini
function mintaPin() { API.lepasPin(); S.akses = false; gambarSemua(); toast("PIN tidak cocok — masukkan PIN tim lagi", 3500); }

// ---- kunci PIN: Data, Rekap & Pengaturan ----
function gambarKunci() { document.body.classList.toggle("tanpa-akses", !S.akses); document.body.classList.toggle("belum-masuk", !S.tim); }
const pesanGalat = k => k === "terkunci" ? "Terlalu banyak PIN salah — coba lagi 15 menit" : "PIN salah";
function pasangKunci() {
  document.querySelectorAll(".gembok").forEach(g => {
    g.innerHTML = `<div class="gembok-isi"><div class="ikon">🔒</div><h3>${g.dataset.gembok} dikunci</h3>
      <p>Masukkan PIN tim untuk membuka data, rekap, ekspor & pengaturan.</p>
      <input class="isian" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="••••">
      <button class="tombol utama kecil" data-buka>Buka</button><p class="salah"></p></div>`;
  });
  const buka = async g => {
    const inp = g.querySelector("input"), salah = g.querySelector(".salah"), pin = inp.value.trim();
    if (!pin) return inp.focus();
    salah.textContent = "Mengecek…";
    API.pasangPin(pin);
    await muat();
    if (S.akses) {
      inp.value = ""; salah.textContent = ""; toast("Terbuka 🔓");
      if ($("lapisUbah").classList.contains("tampil") && S.ubahId) bukaUbah(S.ubahId);
    }
    else { API.lepasPin(); salah.textContent = pesanGalat(S.galat); inp.select(); }
  };
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-buka]"); if (b) buka(b.closest(".gembok-isi"));
    if (e.target.closest("[data-kunci]")) { API.lepasPin(); S.akses = false; $("lapisAtur").classList.remove("tampil"); toast("Dikunci 🔒"); muat(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.id === "pinTim") masuk();
    else if (e.target.closest(".gembok-isi")) buka(e.target.closest(".gembok-isi"));
  });
  // PIN tim: wajib untuk membuka aplikasi
  const masuk = async () => {
    const pin = $("pinTim").value.trim();
    if (!pin) return $("pinTim").focus();
    $("masukSalah").textContent = "Mengecek…";
    API.pasangPinTim(pin);
    await muat();
    if (S.tim) { $("pinTim").value = ""; $("masukSalah").textContent = ""; toast("Selamat datang 👋"); }
    else $("masukSalah").textContent = S.galat === "terkunci" ? pesanGalat("terkunci") : S.galat === "pin_tim" ? "PIN tim salah" : "Tidak bisa tersambung — cek internet";
  };
  $("btnMasuk").onclick = masuk;
  $("btnKeluar").onclick = () => {
    if (!confirm("Keluar dari HP ini? PIN tim & admin dihapus dari HP ini.")) return;
    API.keluar(); S.tim = false; S.akses = false; S.rows = []; $("lapisAtur").classList.remove("tampil"); gambarSemua();
  };
}
function pasangAtur() {
  $("btnAtur").onclick = bukaAtur;
  document.addEventListener("click", e => { const t = e.target.closest("[data-tutup]"); if (t) $(t.dataset.tutup).classList.remove("tampil"); });
  document.querySelectorAll(".lapis").forEach(l => l.addEventListener("click", e => { if (e.target === l) l.classList.remove("tampil"); }));
  const baris = id => [...new Set($(id).value.split("\n").map(s => s.trim().toUpperCase()).filter(Boolean))];
  $("btnSimpanDaftar").onclick = async () => {
    const d = { nama: baris("aturNama"), lapangan: baris("aturLap") };
    if (!d.nama.length || !d.lapangan.length) return toast("Daftar tidak boleh kosong");
    try { const j = await API.daftar(d); S.daftar = j.daftar; toast("Daftar tersimpan ✓"); gambarSemua(); }
    catch (e) { if (e.kode === "pin_salah") mintaPin(); else toast("Gagal: " + e.message, 4000); }
  };
  document.querySelectorAll("[data-ganti]").forEach(b => b.onclick = async () => {
    const tim = b.dataset.ganti === "tim", inp = $(tim ? "aturPinTim" : "aturPin"), baru = inp.value.trim();
    if (!/^\d{6,8}$/.test(baru)) return toast("PIN harus 6–8 angka");
    if (!confirm(`Ganti PIN ${tim ? "tim" : "admin"} jadi ${baru}? HP lain harus memasukkan PIN baru.`)) return;
    try {
      await (tim ? API.gantiPinTim(baru) : API.gantiPin(baru));
      if (tim) API.pasangPinTim(baru); else API.pasangPin(baru);
      inp.value = ""; toast(`PIN ${tim ? "tim" : "admin"} diganti ✓`, 3000);
    } catch (e) { if (e.kode === "pin_salah") mintaPin(); else toast("Gagal: " + (e.kode === "terkunci" ? pesanGalat("terkunci") : e.message), 4000); }
  });
}

// =================== UMUM ===================
function gambarSemua() { gambarKunci(); gambarAbsen(); gambarData(); gambarRekap(); }
function perbaruiStatus() {
  const n = API.antre().length;
  if (n) status(`${n} menunggu sinyal`, "antre");
  else if (API.MODE_COBA) status("mode coba", "antre");
  else if (!navigator.onLine) status("offline", "galat");
  else status("tersambung", "ok");
}
let terakhirMuat = 0;
async function muat() {
  terakhirMuat = Date.now();
  try {
    const j = await API.muat();
    S.rows = j.rows; S.daftar = j.daftar; S.sheetUrl = j.sheetUrl || ""; S.akses = !!j.akses; S.teams = j.teams || [];
    S.tim = true; S.galat = "";
    perbaruiStatus();
  } catch (e) {
    S.galat = e.kode || "jaringan";
    if (e.kode === "pin_tim") { API.keluar(); S.tim = false; S.akses = false; S.rows = []; status("perlu PIN tim", "galat"); }
    else if (e.kode === "terkunci") status("PIN dikunci 15 mnt", "galat");
    else if (e.kode === "pin_salah") { status("perlu PIN", "galat"); mintaPin(); }
    else status(API.simpanan() ? "offline · data terakhir" : "gagal memuat", "galat");
  }
  gambarSemua();
}
function pasangNav() {
  document.querySelectorAll("nav.bawah button").forEach(b => b.onclick = () => {
    document.querySelectorAll("nav.bawah button").forEach(x => x.classList.toggle("aktif", x === b));
    document.querySelectorAll(".layar").forEach(l => l.classList.toggle("aktif", l.id === b.dataset.layar));
    window.scrollTo(0, 0);
    if (b.dataset.layar === "layarRekap") gambarRekap();               // grafik ikut lebar layar
    if (Date.now() - terakhirMuat > 60000) muat();
  });
}

(function mulai() {
  $("pitaCoba").hidden = !API.MODE_COBA;
  const c = API.simpanan();
  if (c && S.tim) { S.rows = c.rows; S.daftar = c.daftar; S.sheetUrl = c.sheetUrl; S.akses = !!c.akses && !!bacaLokal("af_pin"); S.teams = c.teams || []; }
  pasangKunci(); BANYAK.pasang(); pasangAbsen(); SUARA.pasang(); pasangData(); pasangRekap(); pasangAtur(); pasangNav();
  gambarSemua();
  muat();
  window.addEventListener("online", muat);
  window.addEventListener("offline", perbaruiStatus);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - terakhirMuat > 60000) muat(); });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
})();
