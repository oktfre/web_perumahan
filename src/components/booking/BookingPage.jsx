import { useState, useEffect, useCallback } from "react";
import { propertyApi, bookingApi } from "../../utils/api";
import { fmtM, toBase64 } from "../../utils/helpers";
import Btn from "../atoms/Btn";
import Tag from "../atoms/Tag";
import Footer from "../Footer";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=85";
const DP_NOMINAL = 1_000_000;

const BANK_ACCOUNTS = {
  BCA: { norek: "1234567890", nama: "PT Havenest Properti" },
  Mandiri: { norek: "9876543210", nama: "PT Havenest Properti" },
  BRI: { norek: "5566778899", nama: "PT Havenest Properti" },
};

const STEPS = [
  { key: "data", label: "Data Diri" },
  { key: "rumah", label: "Pilih Rumah" },
  { key: "bayar", label: "Pembayaran" },
  { key: "selesai", label: "Selesai" },
];

// ── Field input label+input, konsisten dgn ContactPage ──────
function FInput({ label, value, onChange, placeholder, type = "text", required = false }) {
  return (
    <div>
      <label style={{ fontSize: ".75rem", fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--earth)", display: "block", marginBottom: ".5rem" }}>
        {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: ".75rem 1rem", border: "1px solid var(--mist)", background: "var(--white)", color: "var(--text)", fontSize: ".88rem" }}
      />
    </div>
  );
}

function FTextarea({ label, value, onChange, placeholder, required = false }) {
  return (
    <div>
      <label style={{ fontSize: ".75rem", fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--earth)", display: "block", marginBottom: ".5rem" }}>
        {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        style={{ width: "100%", padding: ".75rem 1rem", border: "1px solid var(--mist)", background: "var(--white)", color: "var(--text)", fontFamily: "var(--sans)", fontSize: ".88rem", resize: "vertical" }}
      />
    </div>
  );
}

// ── Step indicator di atas ──────────────────────────────────
function StepBar({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "2.5rem", maxWidth: 580 }}>
      {STEPS.map((s, i) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: ".4rem" }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--serif)", fontSize: ".85rem", flexShrink: 0,
              background: i <= current ? "var(--accent)" : "var(--mist)",
              color: i <= current ? "#fff" : "var(--light)",
              transition: "background .25s",
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: ".62rem", letterSpacing: ".06em", textTransform: "uppercase", color: i <= current ? "var(--accent)" : "var(--light)", whiteSpace: "nowrap" }}>
              {s.label}
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? "var(--accent)" : "var(--mist)", margin: "0 .5rem", marginBottom: "1.1rem", transition: "background .25s" }} />
          )}
        </div>
      ))}
    </div>
  );
}

const EMPTY_FORM = {
  nama_pembeli: "",
  email: "",
  no_hp: "",
  alamat: "",
  property_id: null,
  metode_pembayaran: "",
  bank: "",
  bukti_transfer: "",
};

function BookingPage({ setPage, presetProperty }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [properties, setProperties] = useState([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [selectedProp, setSelectedProp] = useState(presetProperty || null);
  const [previewImg, setPreviewImg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Muat daftar rumah yang masih tersedia
  const loadProperties = useCallback(() => {
    setLoadingProps(true);
    propertyApi
      .getTersedia("limit=50")
      .then((res) => setProperties(res.data || []))
      .catch(() => setProperties([]))
      .finally(() => setLoadingProps(false));
  }, []);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  useEffect(() => {
    if (presetProperty) {
      setSelectedProp(presetProperty);
      set("property_id", presetProperty.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetProperty]);

  const pickProperty = (p) => {
    setSelectedProp(p);
    set("property_id", p.id);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Ukuran file maksimal 3MB.");
      return;
    }
    setError("");
    const base64 = await toBase64(file);
    set("bukti_transfer", base64);
    setPreviewImg(base64);
  };

  const canNext = {
    0: form.nama_pembeli.trim() && form.no_hp.trim() && form.alamat.trim(),
    1: !!form.property_id,
    2:
      form.metode_pembayaran &&
      (form.metode_pembayaran === "QRIS" || form.bank) &&
      form.bukti_transfer,
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await bookingApi.create({
        property_id: form.property_id,
        nama_pembeli: form.nama_pembeli,
        email: form.email || undefined,
        no_hp: form.no_hp,
        alamat: form.alamat,
        metode_pembayaran: form.metode_pembayaran,
        bank: form.bank || undefined,
        bukti_transfer: form.bukti_transfer,
      });
      setResult(res.data || res);
      setStep(3);
    } catch (err) {
      setError(err.message || "Gagal membuat booking. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setSelectedProp(null);
    setPreviewImg("");
    setResult(null);
    setStep(0);
    loadProperties();
  };

  return (
    <div style={{ minHeight: "100vh", paddingTop: 80 }} className="page-enter">
      {/* Hero */}
      <div style={{ background: "var(--espresso)", padding: "3.5rem 5rem 4rem" }}>
        <Tag label="Booking Online" light />
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.2rem,4vw,3rem)", fontWeight: 300, color: "var(--sand)", marginBottom: ".8rem" }}>
          Booking Rumah Impian Anda
        </h1>
        <p style={{ fontSize: ".92rem", color: "var(--clay)", maxWidth: 540, lineHeight: 1.75 }}>
          Amankan unit pilihan Anda dengan DP {fmtM(DP_NOMINAL)}. Proses cepat — tim kami akan memverifikasi pembayaran dalam 1×24 jam.
        </p>
      </div>

      <div style={{ padding: "3rem 5rem 5rem", maxWidth: 720, margin: "0 auto" }}>
        {step < 3 && <StepBar current={step} />}

        {error && (
          <div style={{ background: "rgba(160,64,64,.1)", border: "1px solid rgba(160,64,64,.3)", color: "#A04040", padding: ".75rem 1rem", marginBottom: "1.5rem", fontSize: ".85rem" }}>
            ❌ {error}
          </div>
        )}

        {/* ── STEP 0: Data Diri ── */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <FInput label="Nama Lengkap" value={form.nama_pembeli} onChange={(v) => set("nama_pembeli", v)} placeholder="Budi Santoso" required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <FInput label="Nomor HP / WhatsApp" value={form.no_hp} onChange={(v) => set("no_hp", v)} placeholder="08xxxxxxxxxx" type="tel" required />
              <FInput label="Email" value={form.email} onChange={(v) => set("email", v)} placeholder="email@anda.com" type="email" />
            </div>
            <FTextarea label="Alamat Lengkap" value={form.alamat} onChange={(v) => set("alamat", v)} placeholder="Jl. Contoh No. 1, Kota..." required />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <Btn onClick={next} disabled={!canNext[0]}>Lanjut: Pilih Rumah →</Btn>
            </div>
          </div>
        )}

        {/* ── STEP 1: Pilih Rumah ── */}
        {step === 1 && (
          <div>
            {loadingProps ? (
              <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--light)" }}>Memuat daftar rumah tersedia…</div>
            ) : properties.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--light)" }}>Belum ada unit tersedia saat ini.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
                {properties.map((p) => {
                  const active = selectedProp?.id === p.id;
                  const harga = parseFloat(p.harga_jual_juta || 0) * 1_000_000;
                  return (
                    <div
                      key={p.id}
                      onClick={() => pickProperty(p)}
                      style={{
                        cursor: "pointer",
                        border: active ? "2px solid var(--accent)" : "1px solid var(--mist)",
                        background: active ? "rgba(181,132,74,.06)" : "var(--white)",
                        padding: "1rem",
                        display: "flex",
                        gap: ".9rem",
                        transition: "all .15s",
                      }}
                    >
                      <div style={{ width: 84, height: 84, flexShrink: 0, background: `url('${p.gambar_utama || PLACEHOLDER}') center/cover no-repeat` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--serif)", fontSize: "1rem", color: "var(--espresso)", marginBottom: ".15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.nama_properti || `${p.perumahan} Tipe ${p.nomor_tipe}`}
                        </div>
                        <div style={{ fontSize: ".72rem", color: "var(--light)", marginBottom: ".4rem" }}>📍 {p.lokasi}</div>
                        <div style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", color: "var(--accent)" }}>{fmtM(harga)}</div>
                      </div>
                      {active && <div style={{ alignSelf: "center", color: "var(--accent)", fontSize: "1.3rem" }}>✓</div>}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Btn variant="ghost" onClick={back}>← Kembali</Btn>
              <Btn onClick={next} disabled={!canNext[1]}>Lanjut: Pembayaran →</Btn>
            </div>
          </div>
        )}

        {/* ── STEP 2: Pembayaran ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.8rem" }}>
            {selectedProp && (
              <div style={{ background: "var(--sand)", padding: "1rem 1.2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--light)" }}>Unit dipilih</div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "1.05rem", color: "var(--espresso)" }}>
                    {selectedProp.nama_properti || `${selectedProp.perumahan} Tipe ${selectedProp.nomor_tipe}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--light)" }}>DP yang harus dibayar</div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: "1.3rem", color: "var(--accent)" }}>{fmtM(DP_NOMINAL)}</div>
                </div>
              </div>
            )}

            {/* Pilih metode pembayaran */}
            <div>
              <label style={{ fontSize: ".75rem", fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--earth)", display: "block", marginBottom: ".7rem" }}>
                Metode Pembayaran <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".8rem" }}>
                {[
                  { key: "QRIS", icon: "📱", label: "QRIS" },
                  { key: "Transfer Bank", icon: "🏦", label: "Transfer Bank" },
                  { key: "Virtual Account", icon: "🧾", label: "Virtual Account" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => { set("metode_pembayaran", m.key); set("bank", ""); }}
                    style={{
                      padding: "1.1rem .8rem",
                      border: form.metode_pembayaran === m.key ? "2px solid var(--accent)" : "1px solid var(--mist)",
                      background: form.metode_pembayaran === m.key ? "rgba(181,132,74,.06)" : "var(--white)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all .15s",
                    }}
                  >
                    <div style={{ fontSize: "1.6rem", marginBottom: ".4rem" }}>{m.icon}</div>
                    <div style={{ fontSize: ".78rem", fontWeight: 500, color: "var(--text)" }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pilih bank — untuk Transfer Bank & Virtual Account */}
            {(form.metode_pembayaran === "Transfer Bank" || form.metode_pembayaran === "Virtual Account") && (
              <div>
                <label style={{ fontSize: ".75rem", fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--earth)", display: "block", marginBottom: ".7rem" }}>
                  Pilih Bank <span style={{ color: "var(--accent)" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: ".8rem" }}>
                  {["BCA", "Mandiri", "BRI"].map((b) => (
                    <button
                      key={b}
                      onClick={() => set("bank", b)}
                      style={{
                        flex: 1,
                        padding: ".8rem",
                        border: form.bank === b ? "2px solid var(--accent)" : "1px solid var(--mist)",
                        background: form.bank === b ? "rgba(181,132,74,.06)" : "var(--white)",
                        cursor: "pointer",
                        fontSize: ".85rem",
                        fontWeight: 500,
                        color: "var(--text)",
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info pembayaran statis sesuai metode dipilih */}
            {form.metode_pembayaran === "QRIS" && (
              <div style={{ background: "var(--espresso)", padding: "2rem", textAlign: "center" }}>
                <div style={{ width: 180, height: 180, margin: "0 auto 1rem", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>
                  ⬛⬜⬛
                </div>
                <div style={{ color: "var(--sand)", fontSize: ".88rem", marginBottom: ".3rem" }}>Scan QRIS di atas untuk membayar</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", color: "var(--accent)" }}>{fmtM(DP_NOMINAL)}</div>
                <div style={{ color: "var(--clay)", fontSize: ".75rem", marginTop: ".3rem" }}>a.n. PT Havenest Properti</div>
              </div>
            )}
            {form.metode_pembayaran === "Transfer Bank" && form.bank && (
              <div style={{ background: "var(--espresso)", padding: "1.6rem 2rem" }}>
                <div style={{ color: "var(--clay)", fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: ".5rem" }}>Transfer ke rekening</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--sand)", marginBottom: ".2rem" }}>{form.bank} — {BANK_ACCOUNTS[form.bank].norek}</div>
                <div style={{ color: "var(--clay)", fontSize: ".85rem", marginBottom: "1rem" }}>a.n. {BANK_ACCOUNTS[form.bank].nama}</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", color: "var(--accent)" }}>Nominal: {fmtM(DP_NOMINAL)}</div>
              </div>
            )}
            {form.metode_pembayaran === "Virtual Account" && form.bank && (
              <div style={{ background: "var(--espresso)", padding: "1.6rem 2rem" }}>
                <div style={{ color: "var(--clay)", fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: ".5rem" }}>Nomor Virtual Account {form.bank}</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--sand)", letterSpacing: ".05em", marginBottom: "1rem" }}>
                  8808{form.bank === "BCA" ? "01" : form.bank === "Mandiri" ? "02" : "03"}{String(selectedProp?.id || 0).padStart(6, "0")}
                </div>
                <div style={{ fontFamily: "var(--serif)", fontSize: "1.4rem", color: "var(--accent)" }}>Nominal: {fmtM(DP_NOMINAL)}</div>
              </div>
            )}

            {/* Upload bukti transfer */}
            <div>
              <label style={{ fontSize: ".75rem", fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--earth)", display: "block", marginBottom: ".5rem" }}>
                Upload Bukti Transfer <span style={{ color: "var(--accent)" }}>*</span>
              </label>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: ".7rem",
                border: "1.5px dashed var(--clay)", padding: previewImg ? ".8rem" : "2rem", cursor: "pointer",
                background: "var(--sand)",
              }}>
                {previewImg ? (
                  <img src={previewImg} alt="Preview bukti transfer" style={{ maxHeight: 140, objectFit: "contain" }} />
                ) : (
                  <span style={{ color: "var(--light)", fontSize: ".85rem" }}>📎 Klik untuk pilih foto/screenshot bukti transfer (maks. 3MB)</span>
                )}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Btn variant="ghost" onClick={back}>← Kembali</Btn>
              <Btn onClick={submit} disabled={!canNext[2] || submitting}>
                {submitting ? "Mengirim…" : "Kirim Booking →"}
              </Btn>
            </div>
          </div>
        )}

        {/* ── STEP 3: Selesai ── */}
        {step === 3 && result && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>✅</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: "2rem", color: "var(--espresso)", marginBottom: "1rem" }}>
              Booking Berhasil Dibuat!
            </div>
            <div style={{ fontSize: ".9rem", color: "var(--light)", marginBottom: "2rem", lineHeight: 1.7, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
              Booking Anda untuk <strong>{selectedProp?.nama_properti || "unit pilihan"}</strong> berstatus{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>Pra-Booking</span> — menunggu verifikasi
              admin atas pembayaran DP {fmtM(DP_NOMINAL)} Anda. Kami akan menghubungi Anda di{" "}
              <strong>{form.no_hp}</strong> dalam 1×24 jam setelah pembayaran dikonfirmasi.
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <Btn variant="ghost" onClick={resetAll}>Booking Unit Lain</Btn>
              <Btn onClick={() => setPage("home")}>Kembali ke Beranda</Btn>
            </div>
          </div>
        )}
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}

export default BookingPage;
