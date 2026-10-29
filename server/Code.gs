// Absensi FotoFauk — penyimpan data (Google Apps Script + Google Sheet).
// Semua data absen ada di sheet "Absen", daftar nama & lapangan di sheet "Daftar".
// PIN tim disimpan di Script Properties: PIN (tidak pernah ditulis di kode ini).
// Tanpa PIN: hanya bisa ABSEN (lihat jadwal ringkas 7 hari untuk cek bentrok + nama team).
// Dengan PIN: lihat semua data, rekap & ekspor, ubah/hapus absen, ubah pengaturan & ganti PIN.
const KOLOM = ["id", "no", "nama", "tanggal", "jam", "durasi", "lapangan", "team", "kontak", "catatan", "jenis", "dibuat", "diubah"];
const DAFTAR_AWAL = {
  nama: ["FEBRI", "FAJAR", "FERDI", "NANANG", "FAUK", "FADLAN", "IKBAL", "RAJWA", "HABIL", "RIANDA", "MUJI", "IWAN", "FATHIR"],
  lapangan: ["BENECIA 1", "BENECIA 2", "RENDEZVOUS", "SPARTA", "ARIOS", "PUNAKHA", "LAPANGAN LAINNYA"],
};

function doGet() { return ContentService.createTextOutput("Absensi FotoFauk: layanan data aktif"); }

function doPost(e) {
  let out;
  const kunci = LockService.getScriptLock();
  try {
    const q = JSON.parse(e.postData.contents);
    const pin = PropertiesService.getScriptProperties().getProperty("PIN");
    const akses = !pin || String(q.pin || "") === pin;
    if (["ubah", "hapus", "daftar", "gantiPin"].indexOf(q.aksi) >= 0 && !akses) out = { galat: "pin_salah" };
    else {
      kunci.waitLock(20000);                                     // dua orang simpan bersamaan → antre, nomor tidak dobel
      if (q.aksi === "muat") out = muat(akses);
      else if (q.aksi === "tambah") { tambah(q.rows || [q.row]); out = muat(akses); }
      else if (q.aksi === "ubah") out = ubah(q.row);
      else if (q.aksi === "hapus") out = hapus(q.id);
      else if (q.aksi === "daftar") out = simpanDaftar(q.daftar);
      else if (q.aksi === "gantiPin") out = gantiPin(q.pinBaru);
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
  // tanpa PIN: jadwal 7 hari terakhir (tanpa kontak/catatan) untuk cek bentrok + daftar nama team untuk saran
  const batas = Utilities.formatDate(new Date(Date.now() - 7 * 864e5), "Asia/Jakarta", "yyyy-MM-dd");
  const rows = semua.filter(r => String(r.tanggal) >= batas)
    .map(r => ({ id: r.id, no: r.no, nama: r.nama, tanggal: r.tanggal, jam: r.jam, durasi: r.durasi, lapangan: r.lapangan, team: r.team, jenis: r.jenis }));
  const teams = [...new Set(semua.map(r => String(r.team).trim()).filter(Boolean))];
  return { ok: true, akses: false, rows: rows, teams: teams, daftar: bacaDaftar() };
}
function gantiPin(baru) {
  baru = String(baru || "").trim();
  if (!/^\d{4,8}$/.test(baru)) return { galat: "PIN harus 4–8 angka" };
  PropertiesService.getScriptProperties().setProperty("PIN", baru);
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

// Jalankan sekali dari editor: buat PIN tim acak 6 angka (kalau belum ada) lalu tampilkan di log. Ganti PIN lewat aplikasi → Pengaturan.
function buatPinAwal() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty("PIN")) p.setProperty("PIN", String(Math.floor(100000 + Math.random() * 900000)));
  Logger.log("PIN tim: " + p.getProperty("PIN"));
}
