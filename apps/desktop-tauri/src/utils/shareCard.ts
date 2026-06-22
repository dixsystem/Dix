// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

import { scoreColor } from "./score";

export async function generateShareCard(
  scoreBefore: number,
  scoreAfter: number,
  cpuModel: string,
  memTotalMb: number,
  distro: string,
  distroVersion: string,
  dixImgSrc: string,
): Promise<string> {
  const isWin = distro === "windows";
  const W = 1200, H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Cargar imagen de DIX en paralelo con el dibujado
  const dixImg = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dixImgSrc;
  });

  // Fondo
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);

  // Borde exterior naranja
  ctx.strokeStyle = "#FF6B00";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Línea decorativa superior
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.3, "#FF6B00");
  grad.addColorStop(0.7, "#FF6B00");
  grad.addColorStop(1, "transparent");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(W, 5); ctx.stroke();

  // Logo DIX — texto
  ctx.fillStyle = "#FF6B00";
  ctx.font = "bold 52px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("DIX", 60, 80);
  ctx.fillStyle = "#8b949e";
  ctx.font = "18px 'Inter', system-ui, sans-serif";
  ctx.fillText(isWin ? "Windows AI Optimizer" : "Linux Kernel Optimizer", 148, 73);

  // URL derecha
  ctx.fillStyle = "#8b949e";
  ctx.font = "16px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("dixsystem.com", W - 60, 73);

  // Separador horizontal
  ctx.strokeStyle = "#21262d";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 100); ctx.lineTo(W - 60, 100); ctx.stroke();

  // Título central
  ctx.fillStyle = "#e6edf3";
  ctx.font = "bold 34px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isWin ? "My Windows performance score" : "My Linux performance score", W / 2, 158);

  // ── Score ANTES ────────────────────────────────────────────────────────────
  const cx1 = 260, cy = 355, radius = 115, strokeW = 17;
  const colorBefore = scoreColor(scoreBefore);
  const colorAfter  = scoreColor(scoreAfter);

  ctx.strokeStyle = "#21262d";
  ctx.lineWidth = strokeW;
  ctx.beginPath();
  ctx.arc(cx1, cy, radius, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = colorBefore;
  ctx.lineWidth = strokeW;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx1, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * scoreBefore) / 100);
  ctx.stroke();
  ctx.fillStyle = colorBefore;
  ctx.font = "bold 70px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(scoreBefore), cx1, cy + 22);
  ctx.fillStyle = "#8b949e";
  ctx.font = "20px 'Inter', system-ui, sans-serif";
  ctx.fillText("/100", cx1, cy + 50);
  ctx.fillStyle = "#8b949e";
  ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
  ctx.fillText("BEFORE", cx1, cy + radius + 32);

  // ── Imagen DIX en el centro ────────────────────────────────────────────────
  if (dixImg) {
    const imgSize = 170;
    const imgX = W / 2 - imgSize / 2;
    const imgY = cy - imgSize / 2 - 10;
    // Halo naranja suave detrás de DIX
    const halo = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, imgSize * 0.7);
    halo.addColorStop(0, "rgba(255,107,0,0.18)");
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.fillRect(imgX - 20, imgY - 20, imgSize + 40, imgSize + 40);
    ctx.drawImage(dixImg, imgX, imgY, imgSize, imgSize);
  }

  // Delta encima de DIX
  const delta = scoreAfter - scoreBefore;
  if (delta > 0) {
    ctx.fillStyle = "#00FF88";
    ctx.font = "bold 28px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`+${delta} pts`, W / 2, cy + radius + 32);
  }

  // Flechas a cada lado de DIX
  const arrowY = cy;
  // Flecha izquierda (desde ring antes hasta DIX)
  ctx.strokeStyle = "#FF6B00";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx1 + radius + 10, arrowY); ctx.lineTo(W / 2 - 95, arrowY); ctx.stroke();
  // Flecha derecha (desde DIX hasta ring después)
  const cx2 = W - 260;
  ctx.beginPath(); ctx.moveTo(W / 2 + 95, arrowY); ctx.lineTo(cx2 - radius - 10, arrowY); ctx.stroke();
  // Punta de flecha derecha
  ctx.fillStyle = "#FF6B00";
  ctx.beginPath();
  ctx.moveTo(cx2 - radius - 10, arrowY);
  ctx.lineTo(cx2 - radius - 28, arrowY - 11);
  ctx.lineTo(cx2 - radius - 28, arrowY + 11);
  ctx.closePath(); ctx.fill();

  // ── Score DESPUÉS ──────────────────────────────────────────────────────────
  ctx.strokeStyle = "#21262d";
  ctx.lineWidth = strokeW;
  ctx.beginPath();
  ctx.arc(cx2, cy, radius, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = colorAfter;
  ctx.lineWidth = strokeW;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx2, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * scoreAfter) / 100);
  ctx.stroke();
  ctx.fillStyle = colorAfter;
  ctx.font = "bold 70px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(scoreAfter), cx2, cy + 22);
  ctx.fillStyle = "#8b949e";
  ctx.font = "20px 'Inter', system-ui, sans-serif";
  ctx.fillText("/100", cx2, cy + 50);
  ctx.fillStyle = "#8b949e";
  ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
  ctx.fillText("AFTER", cx2, cy + radius + 32);

  // Separador inferior
  ctx.strokeStyle = "#21262d";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, H - 105); ctx.lineTo(W - 60, H - 105); ctx.stroke();

  // Hardware info
  const ramGb = Math.round((memTotalMb + 512) / 1024);
  const cpuShort = cpuModel.replace(/\(R\)|\(TM\)|CPU\s+@.*/gi, "").trim().slice(0, 42);
  const hwLine = `${cpuShort}  ·  ${ramGb} GB RAM  ·  ${distro} ${distroVersion}`.trim();
  ctx.fillStyle = "#8b949e";
  ctx.font = "16px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(hwLine, W / 2, H - 72);

  // Hashtags
  ctx.fillStyle = "#FF6B00";
  ctx.font = "bold 19px 'Inter', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isWin ? "#DIXScore  ·  #Windows  ·  dixsystem.com" : "#DIXScore  ·  #Linux  ·  dixsystem.com", W / 2, H - 38);

  return canvas.toDataURL("image/png");
}

// Descarga una data URL como archivo en Tauri (blob URL evita que el WebView la intercepte)
export function downloadDataUrl(dataUrl: string, filename: string) {
  fetch(dataUrl)
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
}
