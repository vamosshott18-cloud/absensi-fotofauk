// Ekspor rekap: PDF (laporan), Excel, gambar PNG, teks WhatsApp, CSV. Pustaka PDF/Excel baru diunduh saat tombol ditekan.
const EKSPOR = (() => {
  const PUSTAKA = {
    pdf: ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"],
    xlsx: ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"],
  };
  const dimuat = {};
  const skrip = src => dimuat[src] ||= new Promise((ok, gagal) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => { delete dimuat[src]; gagal(new Error("butuh internet untuk ekspor ini")); };
    document.head.appendChild(s);
  });
  const muatPustaka = async k => { for (const s of PUSTAKA[k]) await skrip(s); };

  const jenisTeks = j => ({ FOTO: "Foto", VIDEO: "Video", "FOTO DAN VIDEO": "Foto + Video" }[j] || j);
  const namaFile = (d, ext) => `Absensi_FotoFauk_${d.judul}${d.nama ? "_" + d.nama : ""}`.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_") + "." + ext;
  const dicetak = () => new Date().toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const hp = () => matchMedia("(pointer: coarse)").matches;

  async function simpan(blob, nama) {
    const file = new File([blob], nama, { type: blob.type });
    if (hp() && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nama }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nama;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    toast(`${nama} tersimpan di Unduhan`);
  }
  const ikon = () => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = "ikon-192.png"; });
  const rincian = d => d.rows.map((r, i) => [i + 1, tglPendek(r.tanggal), rentangJam(r), angkaJam(r.durasi), r.nama, r.lapangan, r.team, jenisTeks(r.jenis), r.kontak || "", r.catatan || ""]);

  // ---------- PDF ----------
  async function pdf(d) {
    toast("Membuat PDF…");
    await muatPustaka("pdf");
    const doc = new jspdf.jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), lg = await ikon();
    doc.setFillColor(17, 17, 17); doc.rect(0, 0, W, 30, "F");
    if (lg) { doc.setFillColor(255, 255, 255); doc.roundedRect(12, 7, 16, 16, 2, 2, "F"); doc.addImage(lg, "PNG", 13, 8, 14, 14); }
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("Laporan Absensi Fotografer", 33, 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`FotoFauk Sport · ${d.judul}${d.nama ? " · " + d.nama : ""}`, 33, 21);
    doc.setFontSize(8); doc.setTextColor(170); doc.text(`Dicetak ${dicetak()}`, W - 12, 21, { align: "right" });

    const kotak = [[String(d.sesi), "sesi"], [angkaJam(d.jam), "jam kerja"], [String(d.nama ? d.perLap.length : d.perFoto.length), d.nama ? "lapangan" : "fotografer"]];
    const kw = (W - 24 - 8) / 3;
    kotak.forEach(([n, t], i) => {
      const x = 12 + i * (kw + 4);
      doc.setFillColor(255, 240, 230); doc.roundedRect(x, 36, kw, 18, 2, 2, "F");
      doc.setTextColor(17); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(n, x + 5, 46);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110); doc.text(t, x + 5, 51);
    });

    const gaya = { styles: { fontSize: 9, cellPadding: 2.2, textColor: 20 }, headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 246, 243] }, margin: { left: 12, right: 12 } };
    const kecil = (judul, kolom, arr, y) => {
      doc.setTextColor(17); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(judul, 12, y);
      doc.autoTable({ ...gaya, startY: y + 2, head: [[kolom, "Sesi", "Jam", "Foto", "Video"]],
        body: [...arr.map(x => [x.nama, x.sesi, angkaJam(x.jam), x.foto, x.video]), ["TOTAL", d.sesi, angkaJam(d.jam), "", ""]],
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
        didParseCell: c => {
          if (c.column.index > 0) c.cell.styles.halign = "right";
          if (c.section === "body" && c.row.index === arr.length) c.cell.styles.fontStyle = "bold";
        } });
      return doc.lastAutoTable.finalY + 9;
    };
    let y = 63;
    if (!d.nama) y = kecil("Rekap per fotografer", "Fotografer", d.perFoto, y);
    y = kecil("Rekap per lapangan", "Lapangan", d.perLap, y);

    doc.setTextColor(17); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Rincian absen", 12, y);
    doc.autoTable({ ...gaya, startY: y + 2, styles: { ...gaya.styles, fontSize: 8, cellPadding: 1.8 },
      head: [["No", "Tanggal", "Jam", "Durasi", "Fotografer", "Lapangan", "Team", "Jenis", "Kontak", "Catatan"]], body: rincian(d),
      columnStyles: { 0: { halign: "right", cellWidth: 8 }, 3: { halign: "right" } },
      didParseCell: c => { if (c.section === "head" && (c.column.index === 0 || c.column.index === 3)) c.cell.styles.halign = "right"; } });

    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Absensi FotoFauk · halaman ${i}/${n}`, W / 2, 290, { align: "center" }); }
    await simpan(doc.output("blob"), namaFile(d, "pdf"));
  }

  // ---------- Excel ----------
  async function xlsx(d) {
    toast("Membuat Excel…");
    await muatPustaka("xlsx");
    const wb = XLSX.utils.book_new();
    const det = XLSX.utils.aoa_to_sheet([["No", "Tanggal", "Jam mulai", "Jam selesai", "Durasi (jam)", "Fotografer", "Lapangan", "Team", "Jenis", "Kontak", "Catatan"],
      ...d.rows.map((r, i) => { const [m, s] = rentangJam(r).split("–"); return [i + 1, keTanggal(r.tanggal), m, s, r.durasi, r.nama, r.lapangan, r.team, jenisTeks(r.jenis), r.kontak || "", r.catatan || ""]; })],
      { cellDates: true, dateNF: "dd/mm/yyyy" });
    det["!cols"] = [5, 12, 9, 9, 11, 12, 18, 22, 12, 22, 24].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, det, "Rincian");
    const rek = (kolom, arr) => {
      const s = XLSX.utils.aoa_to_sheet([[kolom, "Sesi", "Jam", "Foto", "Video"], ...arr.map(x => [x.nama, x.sesi, x.jam, x.foto, x.video]), ["TOTAL", d.sesi, d.jam]]);
      s["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }]; return s;
    };
    XLSX.utils.book_append_sheet(wb, rek("Fotografer", d.perFoto), "Rekap Fotografer");
    XLSX.utils.book_append_sheet(wb, rek("Lapangan", d.perLap), "Rekap Lapangan");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    await simpan(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), namaFile(d, "xlsx"));
  }

  // ---------- CSV ----------
  async function csv(d) {
    const sel = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const isi = [["No", "Tanggal", "Jam", "Durasi", "Fotografer", "Lapangan", "Team", "Jenis", "Kontak", "Catatan"],
      ...d.rows.map((r, i) => [i + 1, r.tanggal, rentangJam(r), r.durasi, r.nama, r.lapangan, r.team, jenisTeks(r.jenis), r.kontak || "", r.catatan || ""])];
    await simpan(new Blob(["﻿" + isi.map(b => b.map(sel).join(",")).join("\n")], { type: "text/csv" }), namaFile(d, "csv"));
  }

  // ---------- teks WhatsApp ----------
  async function wa(d) {
    const t = [`*Rekap Absensi FotoFauk*`, `${d.judul}${d.nama ? " · " + d.nama : ""}`, `Total: ${d.sesi} sesi · ${angkaJam(d.jam)} jam`, ""];
    if (!d.nama) { t.push("*Per fotografer*"); d.perFoto.forEach((x, i) => t.push(`${i + 1}. ${x.nama} — ${x.sesi} sesi · ${angkaJam(x.jam)} jam`)); t.push(""); }
    t.push("*Per lapangan*"); d.perLap.forEach(x => t.push(`• ${x.nama} — ${x.sesi} sesi · ${angkaJam(x.jam)} jam`));
    if (d.nama) { t.push("", "*Rincian*"); d.rows.forEach(r => t.push(`• ${tglPendek(r.tanggal)} ${rentangJam(r)} ${r.lapangan} (${r.team})`)); }
    const teks = t.join("\n");
    if (hp() && navigator.share) { try { await navigator.share({ text: teks }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(teks); toast("Teks rekap disalin — tinggal tempel di WhatsApp", 3200); }
    catch (_) { prompt("Salin teks ini:", teks); }
  }

  // ---------- gambar PNG ----------
  async function png(d) {
    const W = 1080, P = 64, baris = 64, lg = await ikon();
    const tabel = [...(!d.nama ? [["Per fotografer", d.perFoto]] : []), ["Per lapangan", d.perLap]];
    const H = 360 + tabel.reduce((s, [, a]) => s + 110 + (a.length + 1) * baris, 0) + 70;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), f = (w, s) => `${w} ${s}px Arial, Helvetica, sans-serif`;
    g.fillStyle = "#f2f2f0"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#111"; g.fillRect(0, 0, W, 190);
    if (lg) { g.fillStyle = "#fff"; g.beginPath(); g.roundRect(P, 48, 96, 96, 18); g.fill(); g.drawImage(lg, P + 6, 54, 84, 84); }
    g.fillStyle = "#fff"; g.font = f("bold", 46); g.fillText("Rekap Absensi FotoFauk", P + 124, 98);
    g.font = f("normal", 30); g.fillStyle = "#ffb38a"; g.fillText(`${d.judul}${d.nama ? " · " + d.nama : ""}`, P + 124, 140);
    const kotak = [[String(d.sesi), "sesi"], [angkaJam(d.jam), "jam kerja"], [String(d.nama ? d.perLap.length : d.perFoto.length), d.nama ? "lapangan" : "fotografer"]];
    const kw = (W - P * 2 - 40) / 3;
    kotak.forEach(([n, t], i) => {
      const x = P + i * (kw + 20); g.fillStyle = "#fff"; g.beginPath(); g.roundRect(x, 220, kw, 110, 18); g.fill();
      g.fillStyle = "#111"; g.font = f("bold", 52); g.fillText(n, x + 26, 285); g.fillStyle = "#777"; g.font = f("normal", 24); g.fillText(t, x + 26, 316);
    });
    let y = 380;
    tabel.forEach(([judul, arr]) => {
      g.fillStyle = "#111"; g.font = f("bold", 30); g.fillText(judul, P, y + 20);
      y += 44; const tinggi = (arr.length + 1) * baris;
      g.fillStyle = "#fff"; g.beginPath(); g.roundRect(P, y, W - P * 2, tinggi, 18); g.fill();
      g.font = f("bold", 22); g.fillStyle = "#888"; g.fillText("NAMA", P + 28, y + 40); g.textAlign = "right";
      g.fillText("SESI", W - P - 200, y + 40); g.fillText("JAM", W - P - 28, y + 40); g.textAlign = "left";
      arr.forEach((x, i) => {
        const yy = y + baris * (i + 1);
        g.fillStyle = "#e6e6e1"; g.fillRect(P + 20, yy, W - P * 2 - 40, 2);
        g.fillStyle = "#111"; g.font = f("bold", 28); g.fillText(x.nama, P + 28, yy + 42);
        g.textAlign = "right"; g.font = f("normal", 28); g.fillText(String(x.sesi), W - P - 200, yy + 42);
        g.font = f("bold", 28); g.fillStyle = "#e0560f"; g.fillText(angkaJam(x.jam), W - P - 28, yy + 42); g.textAlign = "left";
      });
      y += tinggi + 66;
    });
    g.fillStyle = "#999"; g.font = f("normal", 20); g.fillText(`Dibuat ${dicetak()} · Absensi FotoFauk`, P, H - 34);
    const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
    await simpan(blob, namaFile(d, "png"));
  }

  return { pdf, xlsx, csv, wa, png };
})();
