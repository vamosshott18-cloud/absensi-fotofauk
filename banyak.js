// Absen banyak sekaligus: ketuk beberapa jam (boleh ganti tanggal/lapangan di tengah jalan) → semua masuk daftar sesi →
// isi team per baris → simpan sekali. Draf disimpan di HP supaya tidak hilang kalau aplikasi tertutup.
const BANYAK = (() => {
  const baca = () => { try { return JSON.parse(localStorage.getItem("af_banyak") || "[]"); } catch (_) { return []; } };
  const simpanDraf = () => { try { localStorage.setItem("af_banyak", JSON.stringify(S.banyak)); } catch (_) {} };
  const jamStr = r => `${pad(r.jam)}:${pad(r.menit)}`;
  const urut = () => S.banyak.sort((a, b) => (a.tanggal + jamStr(a)).localeCompare(b.tanggal + jamStr(b)) || a.lapangan.localeCompare(b.lapangan));
  const aktif = () => S.mode === "banyak";

  // jam yang dipilih di grid untuk tanggal & lapangan yang sedang aktif
  function terpilih() {
    const f = S.f, lap = f.lapangan ? lapanganForm() : null;
    return S.banyak.filter(r => r.tanggal === f.tanggal && (lap === null || r.lapangan === lap));
  }
  function ketukJam(h) {
    const f = S.f, lap = f.lapangan ? lapanganForm() : "";
    const i = S.banyak.findIndex(r => r.tanggal === f.tanggal && r.jam === h && r.lapangan === lap);
    if (i >= 0) S.banyak.splice(i, 1);
    else S.banyak.push({ id: buatId(), tanggal: f.tanggal, jam: h, menit: f.menit, durasi: f.durasi, lapangan: lap, team: "", kontak: "", jenis: f.jenis });
    simpanDraf();
  }
  function tambah(rows) {
    rows.forEach(r => S.banyak.push({ id: buatId(), kontak: "", jenis: "FOTO", ...r }));
    simpanDraf();
  }

  const keRow = r => ({ id: r.id, nama: S.saya, tanggal: r.tanggal, jam: jamStr(r), durasi: r.durasi, lapangan: r.lapangan,
    team: r.team.trim(), kontak: (r.kontak || "").trim(), catatan: "", jenis: r.jenis });
  function bentrokBaris(r) {
    const a = r.jam * 60 + r.menit, b = a + r.durasi * 60;
    const lama = r.lapangan ? bentrok(keRow(r)).map(x => `${x.nama} ${rentangJam(x)}`) : [];
    const draf = S.banyak.filter(x => x.id !== r.id && x.lapangan && x.lapangan === r.lapangan && x.tanggal === r.tanggal
      && x.jam * 60 + x.menit < b && x.jam * 60 + x.menit + x.durasi * 60 > a).map(x => `sesi ${keJam(x.jam * 60 + x.menit)} di daftar ini`);
    return [...lama, ...draf];
  }
  function kurang() {
    const k = [];
    if (!S.saya) k.push("nama kamu");
    if (!S.banyak.length) k.push("pilih jam");
    const tanpaLap = S.banyak.filter(r => !r.lapangan).length, tanpaTeam = S.banyak.filter(r => !r.team.trim()).length;
    if (tanpaLap) k.push(`lapangan (${tanpaLap})`);
    if (tanpaTeam) k.push(`team (${tanpaTeam})`);
    return k;
  }

  function gambarDaftar() {
    urut();
    $("isiBanyak").textContent = S.banyak.length ? `${S.banyak.length} sesi` : "";
    $("dlTeam").innerHTML = daftarTeam().map(x => `<option value="${esc(x.team)}">`).join("");
    if (!S.banyak.length) { $("daftarBanyak").innerHTML = `<div class="kosong" style="padding:18px 6px">Ketuk beberapa jam di langkah 1 — tiap jam jadi satu sesi.</div>`; return; }
    const opsi = (arr, v, kosong) => (kosong ? `<option value="">${kosong}</option>` : "") + arr.map(([val, t]) => `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(t)}</option>`).join("");
    const lapOpsi = [...new Set([...S.daftar.lapangan, ...S.banyak.map(r => r.lapangan).filter(Boolean)])].map(l => [l, l]);
    let tglLalu = "";
    $("daftarBanyak").innerHTML = S.banyak.map(r => {
      const bt = bentrokBaris(r), kepala = r.tanggal !== tglLalu ? `<div class="sesi-hari">${tglPanjang(r.tanggal)}</div>` : "";
      tglLalu = r.tanggal;
      return `${kepala}<div class="sesi ${bt.length ? "bentrok" : ""}" data-id="${r.id}">
        <div class="sesi-atas"><b>${keJam(r.jam * 60 + r.menit)}–${keJam(r.jam * 60 + r.menit + r.durasi * 60)}</b>
          <select data-f="durasi" aria-label="Durasi">${opsi(DURASI.map(d => [String(d), angkaJam(d) + " jam"]), String(r.durasi))}</select>
          <select data-f="jenis" aria-label="Jenis">${opsi(JENIS, r.jenis)}</select>
          <button class="hapus" data-hapus aria-label="Hapus sesi">✕</button></div>
        <div class="sesi-bawah">
          <select data-f="lapangan" class="${r.lapangan ? "" : "kurang"}" aria-label="Lapangan">${opsi(lapOpsi, r.lapangan, "Lapangan?")}</select>
          <input data-f="team" list="dlTeam" placeholder="Nama team" value="${esc(r.team)}" class="${r.team.trim() ? "" : "kurang"}" autocomplete="off"></div>
        ${bt.length ? `<div class="sesi-awas">⚠️ Bentrok: ${esc(bt.join(", "))}</div>` : ""}</div>`;
    }).join("");
  }
  function gambarRingkas() {
    const k = kurang(), jam = S.banyak.reduce((s, r) => s + r.durasi, 0);
    $("ringkas").innerHTML = `<b>${S.banyak.length} sesi · ${angkaJam(jam)} jam</b>` + (k.length ? `<span style="color:#c2410c"> — belum: ${k.join(", ")}</span>` : "");
    $("bentrok").classList.remove("tampil");
    $("btnSimpan").disabled = k.length > 0;
    $("btnSimpan").textContent = `Simpan semua${S.banyak.length ? ` (${S.banyak.length})` : ""}`;
  }

  async function simpan() {
    if (kurang().length) return;
    const rows = S.banyak.map(keRow), btn = $("btnSimpan");
    btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      const j = await API.tambahBanyak(rows);
      if (j.rows) S.rows = j.rows;
      S.banyak = []; simpanDraf();
      toast(j.antre ? `${rows.length} absen disimpan di HP — dikirim otomatis saat ada sinyal` : `${rows.length} absen tersimpan ✓`, 3200);
      perbaruiStatus();
    } catch (e) {
      if (e.kode === "pin_salah") mintaPin(); else toast("Gagal menyimpan: " + e.message, 4000);
    }
    gambarSemua();
  }
  function pasang() {
    S.banyak = baca();
    const kotak = $("daftarBanyak");
    kotak.addEventListener("input", e => {
      const el = e.target, id = el.closest(".sesi")?.dataset.id, r = S.banyak.find(x => x.id === id);
      if (!r || el.dataset.f !== "team") return;
      r.team = el.value; el.classList.toggle("kurang", !el.value.trim());
      const t = daftarTeam().find(x => x.team.toLowerCase() === el.value.trim().toLowerCase());
      if (t && t.kontak && !r.kontak) r.kontak = String(t.kontak);
      simpanDraf(); gambarRingkas();
    });
    kotak.addEventListener("change", e => {
      const el = e.target, id = el.closest(".sesi")?.dataset.id, r = S.banyak.find(x => x.id === id);
      if (!r || !el.dataset.f || el.dataset.f === "team") return;
      r[el.dataset.f] = el.dataset.f === "durasi" ? Number(el.value) : el.value;
      simpanDraf(); gambarAbsen();
    });
    kotak.addEventListener("click", e => {
      const b = e.target.closest("[data-hapus]"); if (!b) return;
      S.banyak = S.banyak.filter(x => x.id !== b.closest(".sesi").dataset.id);
      simpanDraf(); gambarAbsen();
    });
  }

  return { aktif, terpilih, ketukJam, tambah, gambarDaftar, gambarRingkas, simpan, pasang };
})();
