// Penghubung ke Google Sheet lewat Apps Script. Data terakhir disimpan di perangkat supaya aplikasi langsung tampil,
// dan absen yang gagal terkirim (sinyal hilang) masuk antrean lalu dikirim ulang otomatis.
const API = (() => {
  const URL_API = (window.ABSEN_CONFIG || {}).api;
  const MODE_COBA = !URL_API;
  const DAFTAR_AWAL = {
    nama: ["FEBRI", "FAJAR", "FERDI", "NANANG", "FAUK", "FADLAN", "IKBAL", "RAJWA", "HABIL", "RIANDA", "MUJI", "IWAN", "FATHIR"],
    lapangan: ["BENECIA 1", "BENECIA 2", "RENDEZVOUS", "SPARTA", "ARIOS", "PUNAKHA", "LAPANGAN LAINNYA"],
  };
  const baca = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } };
  const tulis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  // ---- mode coba: meniru server (PIN tim coba 111111, PIN admin coba 123456), semua di localStorage ----
  function layananCoba(q) {
    const pinAdmin = baca("af_coba_pin", "123456"), pinTim = baca("af_coba_pin_tim", "111111");
    const admin = q.pin === pinAdmin, tim = admin || q.pinTim === pinTim || q.pinTim === pinAdmin;
    if (!tim) return { galat: "pin_tim" };
    if (["ubah", "hapus", "daftar", "gantiPin", "gantiPinTim"].includes(q.aksi) && !admin) return { galat: "pin_salah" };
    const ada = baca("af_coba_rows", []);
    const muat = () => {
      const daftar = baca("af_coba_daftar", DAFTAR_AWAL);
      if (admin) return { ok: true, akses: true, rows: baca("af_coba_rows", []), daftar, sheetUrl: "" };
      return { ok: true, akses: false, daftar, rows: baca("af_coba_rows", []).map(({ kontak, catatan, dibuat, diubah, ...r }) => r) };
    };
    if (q.aksi === "muat") return muat();
    if (q.aksi === "tambah") {
      let no = ada.reduce((m, r) => Math.max(m, r.no), 0);
      q.rows.forEach(r => { if (!ada.some(x => x.id === r.id)) { r.no = ++no; r.dibuat = new Date().toISOString(); ada.push(r); } });
      tulis("af_coba_rows", ada); return muat();
    }
    if (q.aksi === "ubah") {
      const i = ada.findIndex(x => x.id === q.row.id);
      if (i >= 0) ada[i] = { ...ada[i], ...q.row, no: ada[i].no, diubah: new Date().toISOString() };
      tulis("af_coba_rows", ada); return muat();
    }
    if (q.aksi === "hapus") { tulis("af_coba_rows", ada.filter(x => x.id !== q.id)); return muat(); }
    if (q.aksi === "daftar") { tulis("af_coba_daftar", q.daftar); return { ok: true, daftar: q.daftar }; }
    if (q.aksi === "gantiPin" || q.aksi === "gantiPinTim") {
      if (!/^\d{6,8}$/.test(q.pinBaru || "")) return { galat: "PIN harus 6–8 angka" };
      if (q.pinBaru === (q.aksi === "gantiPin" ? pinTim : pinAdmin)) return { galat: "PIN tim & PIN admin harus beda" };
      tulis(q.aksi === "gantiPin" ? "af_coba_pin" : "af_coba_pin_tim", q.pinBaru); return { ok: true };
    }
    return { galat: "aksi tidak dikenal" };
  }

  async function kirim(isi) {
    isi.pin = localStorage.getItem("af_pin") || "";
    isi.pinTim = localStorage.getItem("af_pin_tim") || "";
    let j;
    if (MODE_COBA) j = layananCoba(JSON.parse(JSON.stringify(isi)));
    else {
      const r = await fetch(URL_API, { method: "POST", body: JSON.stringify(isi) });   // tanpa header → tidak perlu preflight CORS
      j = await r.json();
    }
    if (j.galat) { const e = new Error(j.galat); e.kode = j.galat; throw e; }
    return j;
  }

  const antre = () => baca("af_antre", []);
  async function kirimAntrean() {
    const a = antre();
    if (!a.length) return null;
    const j = await kirim({ aksi: "tambah", rows: a });
    tulis("af_antre", antre().filter(r => !a.some(x => x.id === r.id)));
    return j;
  }

  return {
    MODE_COBA,
    simpanan: () => baca("af_cache", null),
    antre,
    async muat() {
      try { await kirimAntrean(); } catch (_) {}
      const j = await kirim({ aksi: "muat" });
      tulis("af_cache", { rows: j.rows, daftar: j.daftar, teams: j.teams || [], akses: !!j.akses, sheetUrl: j.sheetUrl || "", waktu: Date.now() });
      return j;
    },
    async tambah(row) {
      try { return await kirim({ aksi: "tambah", rows: [...antre(), row] }).then(j => { tulis("af_antre", []); return j; }); }
      catch (e) {
        if (e.kode && e.kode !== "terkunci") throw e;                 // ditolak server (mis. PIN salah) → jangan diantre
        tulis("af_antre", [...antre().filter(x => x.id !== row.id), row]);
        return { ok: true, antre: true };
      }
    },
    async tambahBanyak(rows) {
      try { return await kirim({ aksi: "tambah", rows: [...antre(), ...rows] }).then(j => { tulis("af_antre", []); return j; }); }
      catch (e) {
        if (e.kode && e.kode !== "terkunci") throw e;
        const ids = new Set(rows.map(r => r.id));
        tulis("af_antre", [...antre().filter(x => !ids.has(x.id)), ...rows]);
        return { ok: true, antre: true };
      }
    },
    ubah: row => kirim({ aksi: "ubah", row }),
    hapus: id => kirim({ aksi: "hapus", id }),
    daftar: daftar => kirim({ aksi: "daftar", daftar }),
    gantiPin: pinBaru => kirim({ aksi: "gantiPin", pinBaru }),
    gantiPinTim: pinBaru => kirim({ aksi: "gantiPinTim", pinBaru }),
    pasangPinTim: pin => { try { localStorage.setItem("af_pin_tim", pin); } catch (_) {} },
    keluar: () => { try { ["af_pin_tim", "af_pin", "af_cache"].forEach(k => localStorage.removeItem(k)); } catch (_) {} },
    pasangPin: pin => { try { localStorage.setItem("af_pin", pin); } catch (_) {} },
    lepasPin: () => { try { localStorage.removeItem("af_pin"); localStorage.removeItem("af_cache"); } catch (_) {} },
    kirimAntrean,
  };
})();
