// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem

import { useEffect, useRef } from "react";
import { C } from "../constants";
import { useT } from "../i18n";

export function LiveTerminal({
  scan,
  revealedCount,
  analysisText,
}: {
  scan: Record<string, unknown> | null;
  revealedCount: number;
  analysisText?: string;
}) {
  const { t } = useT();
  const termRef = useRef<HTMLDivElement>(null);
  const entries = scan ? Object.entries(scan) : [];
  const visible = entries.slice(0, revealedCount);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [revealedCount, analysisText]);

  return (
    <div
      ref={termRef}
      style={{
        flex: 1,
        background: "#010409",
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 11,
        lineHeight: 1.85,
        overflowY: "auto",
        minHeight: 200,
      }}
    >
      <div style={{ color: C.muted, marginBottom: 6, fontSize: 10, letterSpacing: "0.5px" }}>
        {t("live_terminal_header")}
      </div>
      {visible.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 6 }}>
          <span style={{ color: C.orange, minWidth: 130 }}>{k}</span>
          <span style={{ color: C.green }}>{String(v)}</span>
        </div>
      ))}
      {scan && revealedCount < entries.length && (
        <div style={{ color: C.muted }}>▋</div>
      )}
      {analysisText && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}33` }}>
          <div style={{ color: C.yellow, fontSize: 10, marginBottom: 4 }}>─ CLAUDE AI ──────────────────</div>
          <div style={{ color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{analysisText}</div>
        </div>
      )}
    </div>
  );
}
