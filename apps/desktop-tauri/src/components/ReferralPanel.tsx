import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ReferralInfo {
  code: string;
  link: string;
  downloads: number;
  activated: boolean;
  email: string | null;
}

export function ReferralPanel() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);

  useEffect(() => {
    invoke<ReferralInfo>("get_referral_info")
      .then(setInfo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    if (!info) return;
    navigator.clipboard.writeText(info.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!info) return;
    const text = `Llevo semanas con el PC lento y encontré esto.\nDIX lo analiza, lo optimiza y te dice exactamente qué está fallando.\nCompletamente gratis en beta.\n👉 ${info.link}`;
    if (navigator.share) {
      navigator.share({ title: "DIX — Optimizador IA", text, url: info.link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  const handleEmailSave = async () => {
    if (!email.includes("@")) return;
    try {
      await invoke("set_referral_email", { email });
      setEmailSaved(true);
      if (info) setInfo({ ...info, email });
    } catch {}
  };

  if (loading) return null;
  if (!info) return null;

  if (info.activated) {
    return (
      <div style={styles.container}>
        <div style={styles.icon}>🏆</div>
        <h3 style={styles.title}>¡Lo conseguiste!</h3>
        <p style={styles.subtitle}>
          5 personas descargaron DIX gracias a ti.<br />
          Tu licencia de por vida está activada. Revisa tu email.
        </p>
      </div>
    );
  }

  const dots = [0, 1, 2, 3, 4];

  return (
    <div style={styles.container}>
      <div style={styles.icon}>🤖</div>
      <h3 style={styles.title}>¿Quieres la licencia de por vida completamente gratis?</h3>
      <p style={styles.subtitle}>
        Comparte DIX con 5 personas. Cuando descarguen, la licencia es tuya. Para siempre.
      </p>

      <div style={styles.linkBox}>
        <span style={styles.linkText}>{info.link}</span>
      </div>

      <div style={styles.buttons}>
        <button style={styles.btnPrimary} onClick={handleCopy}>
          {copied ? "✓ Copiado" : "📋 Copiar enlace"}
        </button>
        <button style={styles.btnSecondary} onClick={handleShare}>
          → Compartir
        </button>
      </div>

      <div style={styles.counter}>
        <div style={styles.dots}>
          {dots.map(i => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i < info.downloads ? "#FF6B00" : "#30363d",
              }}
            />
          ))}
        </div>
        <span style={styles.counterText}>{info.downloads} de 5 referidos</span>
      </div>

      {!info.email && !emailSaved && (
        <div style={styles.emailSection}>
          <p style={styles.emailHint}>Añade tu email para recibir la licencia automáticamente:</p>
          <div style={styles.emailRow}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={styles.emailInput}
            />
            <button style={styles.btnSave} onClick={handleEmailSave}>Guardar</button>
          </div>
        </div>
      )}
      {(info.email || emailSaved) && (
        <p style={styles.emailConfirmed}>✓ Te notificaremos en {info.email || email}</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 12,
    padding: "24px 20px",
    textAlign: "center",
    marginBottom: 16,
  },
  icon: { fontSize: 32, marginBottom: 8 },
  title: { margin: "0 0 8px", color: "#FF6B00", fontSize: 16, fontWeight: 700 },
  subtitle: { margin: "0 0 16px", color: "#8b949e", fontSize: 13, lineHeight: 1.5 },
  linkBox: {
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 12,
    wordBreak: "break-all",
  },
  linkText: { color: "#58a6ff", fontSize: 12, fontFamily: "monospace" },
  buttons: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 },
  btnPrimary: {
    background: "#FF6B00", color: "#fff", border: "none", borderRadius: 8,
    padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  btnSecondary: {
    background: "transparent", color: "#FF6B00", border: "1px solid #FF6B00",
    borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13,
  },
  counter: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  dots: { display: "flex", gap: 6 },
  dot: { width: 14, height: 14, borderRadius: "50%", transition: "background 0.3s" },
  counterText: { color: "#8b949e", fontSize: 12 },
  emailSection: { marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 16 },
  emailHint: { color: "#8b949e", fontSize: 12, margin: "0 0 8px" },
  emailRow: { display: "flex", gap: 8, justifyContent: "center" },
  emailInput: {
    background: "#0d1117", border: "1px solid #30363d", borderRadius: 6,
    color: "#fff", padding: "6px 10px", fontSize: 12, outline: "none", width: 180,
  },
  btnSave: {
    background: "#21262d", color: "#fff", border: "1px solid #30363d",
    borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12,
  },
  emailConfirmed: { color: "#00FF88", fontSize: 12, marginTop: 12 },
};
