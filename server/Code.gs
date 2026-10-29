// Absensi FotoFauk — penyimpan data (Google Apps Script + Google Sheet).
// Semua data absen ada di sheet "Absen", daftar nama & lapangan di sheet "Daftar".
// Dua PIN di Script Properties (tidak pernah ditulis di kode ini):
//   PIN_TIM — untuk semua fotografer: buka aplikasi, absen, lihat jadwal/jam kerja/lokasi.
//   PIN     — admin: kontak & catatan, rekap & ekspor, ubah/hapus absen, pengaturan, ganti PIN.
// Tanpa PIN tim, server menolak semuanya. PIN salah 10× dalam 15 menit → semua cek PIN ditolak 15 menit.
const KOLOM = ["id", "no", "nama", "tanggal", "jam", "durasi", "lapangan", "team", "kontak", "catatan", "jenis", "dibuat", "diubah"];
const DAFTAR_AWAL = {
  nama: ["FEBRI", "FAJAR", "FERDI", "NANANG", "FAUK", "FADLAN", "IKBAL", "RAJWA", "HABIL", "RIANDA", "MUJI", "IWAN", "FATHIR"],
  lapangan: ["BENECIA 1", "BENECIA 2", "RENDEZVOUS", "SPARTA", "ARIOS", "PUNAKHA", "LAPANGAN LAINNYA"],
};

function doGet() { return ContentService.createTextOutput("Absensi FotoFauk: layanan data aktif"); }

const GAGAL_MAKS = 10, GAGAL_DETIK = 900;

function doPost(e) {
  let out;
  const kunci = LockService.getScriptLock();
  try {
    const q = JSON.parse(e.postData.contents);
    kunci.waitLock(25000);                                       // semua permintaan antre: nomor tidak dobel & tebak PIN jadi lambat
    const prop = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
    const pinAdmin = prop.getProperty("PIN"), pinTim = prop.getProperty("PIN_TIM");
    const gagal = Number(cache.get("gagal") || 0);
    if (gagal >= GAGAL_MAKS) out = { galat: "terkunci" };
    else {
      const dikirimAdmin = String(q.pin || ""), dikirimTim = String(q.pinTim || "");
      const admin = !!pinAdmin && dikirimAdmin === pinAdmin;
      const tim = admin || (!!pinTim && (dikirimTim === pinTim || dikirimTim === pinAdmin));
      if ((dikirimAdmin && !admin) || (dikirimTim && !tim)) {     // ada PIN yang salah → catat & perlambat
        cache.put("gagal", String(gagal + 1), GAGAL_DETIK);
        Utilities.sleep(1500);
      }
      if (!tim) out = { galat: "pin_tim" };
      else if (["ubah", "hapus", "daftar", "gantiPin", "gantiPinTim"].indexOf(q.aksi) >= 0 && !admin) out = { galat: "pin_salah" };
      else if (q.aksi === "muat") out = muat(admin);
      else if (q.aksi === "tambah") { tambah(q.rows || [q.row]); out = muat(admin); }
      else if (q.aksi === "ubah") out = ubah(q.row);
      else if (q.aksi === "hapus") out = hapus(q.id);
      else if (q.aksi === "daftar") out = simpanDaftar(q.daftar);
      else if (q.aksi === "gantiPin") out = gantiPin("PIN", q.pinBaru);
      else if (q.aksi === "gantiPinTim") out = gantiPin("PIN_TIM", q.pinBaru);
      else out = { galat: "aksi tidak dikenal" };
    }
  } catch (err) { out = { galat: String(err) }; }
  finally { try { kunci.releaseLock(); } catch (_) {} }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function buku() {
  const id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create("Absensi FotoFauk (data aplikasi)");
  PropertiesService.getScriptProperties().setProperty("SHEET_ID", ss.getId());
  const a = ss.getSheets()[0].setName("Absen");
  a.getRange(1, 1, 1, KOLOM.length).setValues([KOLOM]).setFontWeight("bold");
  a.setFrozenRows(1);
  a.getRange("D:E").setNumberFormat("@");                          // tanggal, jam & kontak disimpan sebagai teks apa adanya
  a.getRange("I:I").setNumberFormat("@");
  a.getRange("L:M").setNumberFormat("@");
  const d = ss.insertSheet("Daftar");
  d.getRange(1, 1, 1, 2).setValues([["nama", "lapangan"]]).setFontWeight("bold");
  tulisDaftar(d, DAFTAR_AWAL);
  return ss;
}
const lembar = nama => buku().getSheetByName(nama);

function bacaDaftar() {
  const d = lembar("Daftar"), n = d.getLastRow();
  const v = n > 1 ? d.getRange(2, 1, n - 1, 2).getValues() : [];
  return { nama: v.map(r => String(r[0])).filter(Boolean), lapangan: v.map(r => String(r[1])).filter(Boolean) };
}
function tulisDaftar(d, daftar) {
  const n = Math.max(daftar.nama.length, daftar.lapangan.length);
  if (d.getLastRow() > 1) d.getRange(2, 1, d.getLastRow() - 1, 2).clearContent();
  if (n) d.getRange(2, 1, n, 2).setValues(Array.from({ length: n }, (_, i) => [daftar.nama[i] || "", daftar.lapangan[i] || ""]));
}

function semuaBaris() {
  const a = lembar("Absen"), n = a.getLastRow();
  if (n < 2) return [];
  return a.getRange(2, 1, n - 1, KOLOM.length).getValues().map(r => {
    const o = {}; KOLOM.forEach((k, i) => o[k] = r[i] instanceof Date ? Utilities.formatDate(r[i], "Asia/Jakarta", "yyyy-MM-dd") : r[i]);
    o.no = Number(o.no) || 0; o.durasi = Number(o.durasi) || 0; o.jam = String(o.jam); o.kontak = String(o.kontak);
    return o;
  });
}

function muat(akses) {
  const semua = semuaBaris();
  if (akses) return { ok: true, akses: true, rows: semua, daftar: bacaDaftar(), sheetUrl: buku().getUrl() };
  // PIN tim saja: jadwal, jam kerja & lokasi — kontak & catatan pemesan tidak dikirim
  const rows = semua.map(r => ({ id: r.id, no: r.no, nama: r.nama, tanggal: r.tanggal, jam: r.jam, durasi: r.durasi, lapangan: r.lapangan, team: r.team, jenis: r.jenis }));
  return { ok: true, akses: false, rows: rows, daftar: bacaDaftar() };
}
function gantiPin(nama, baru) {
  baru = String(baru || "").trim();
  if (!/^\d{6,8}$/.test(baru)) return { galat: "PIN harus 6–8 angka" };
  const p = PropertiesService.getScriptProperties();
  if (baru === p.getProperty(nama === "PIN" ? "PIN_TIM" : "PIN")) return { galat: "PIN tim & PIN admin harus beda" };
  p.setProperty(nama, baru);
  return { ok: true };
}

function tambah(rows) {
  const a = lembar("Absen"), ada = semuaBaris();
  let no = ada.reduce((m, r) => Math.max(m, r.no), 0);
  const kenal = new Set(ada.map(r => r.id)), baru = [];
  rows.forEach(r => {
    if (!r || kenal.has(r.id)) return;                               // kiriman ulang dari antrean offline → abaikan
    r.no = ++no; r.dibuat = r.dibuat || new Date().toISOString(); r.diubah = "";
    baru.push(r);
  });
  if (baru.length) a.getRange(a.getLastRow() + 1, 1, baru.length, KOLOM.length).setValues(baru.map(r => KOLOM.map(k => r[k] ?? "")));
}

function cariBaris(id) {
  const a = lembar("Absen"), n = a.getLastRow();
  if (n < 2) return -1;
  const ids = a.getRange(2, 1, n - 1, 1).getValues().map(r => r[0]);
  const i = ids.indexOf(id);
  return i < 0 ? -1 : i + 2;
}
function ubah(row) {
  const b = cariBaris(row.id);
  if (b < 0) return { galat: "data tidak ditemukan" };
  const a = lembar("Absen"), lama = a.getRange(b, 1, 1, KOLOM.length).getValues()[0];
  row.no = lama[1]; row.dibuat = lama[11]; row.diubah = new Date().toISOString();
  a.getRange(b, 1, 1, KOLOM.length).setValues([KOLOM.map(k => row[k] ?? "")]);
  return { ok: true, rows: semuaBaris() };
}
function hapus(id) {
  const b = cariBaris(id);
  if (b > 0) lembar("Absen").deleteRow(b);
  return { ok: true, rows: semuaBaris() };
}
function simpanDaftar(daftar) {
  tulisDaftar(lembar("Daftar"), daftar);
  return { ok: true, daftar: bacaDaftar() };
}

// Jalankan sekali dari editor untuk membuat Sheet & memberi izin.
function siapkan() { Logger.log(buku().getUrl()); }

// Jalankan sekali dari editor: buat PIN admin & PIN tim acak 6 angka (kalau belum ada) lalu tampilkan di log.
// Ganti PIN lewat aplikasi → Pengaturan.
function buatPinAwal() {
  const p = PropertiesService.getScriptProperties(), acak = () => String(Math.floor(100000 + Math.random() * 900000));
  if (!p.getProperty("PIN")) p.setProperty("PIN", acak());
  while (!p.getProperty("PIN_TIM") || p.getProperty("PIN_TIM") === p.getProperty("PIN")) p.setProperty("PIN_TIM", acak());
  Logger.log("PIN admin: " + p.getProperty("PIN") + " | PIN tim: " + p.getProperty("PIN_TIM"));
}
