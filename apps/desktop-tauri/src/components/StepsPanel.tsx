// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

import { C } from "../constants";
import { useT } from "../i18n";

export function StepsPanel({ scanStep }: { scanStep: number }) {
  const { t } = useT();
  const steps = [
    { step: 1, label: t("steps_panel_step1_label"),       sublabel: "/proc · /sys · pactl" },
    { step: 2, label: t("steps_panel_step2_label"),       sublabel: "sysbench cpu · memory · fio 4K" },
    { step: 3, label: t("steps_panel_step3_label"),       sublabel: "claude-sonnet-4-6" },
    { step: 4, label: t("steps_panel_step4_label"),       sublabel: t("steps_panel_step4_sublabel") },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map(({ step, label, sublabel }) => {
        const done    = scanStep > step;
        const active  = scanStep === step;
        const pending = scanStep < step;
        return (
          <div
            key={step}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8,
              background: done ? `${C.green}0d` : active ? `${C.orange}12` : `${C.card}`,
              border: `1px solid ${done ? C.green + "33" : active ? C.orange + "44" : C.border}`,
              opacity: pending ? 0.45 : 1,
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: done ? C.green : active ? C.orange : C.border,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: done ? "#000" : "#fff",
            }}>
              {done ? "✓" : step}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: done ? C.green : active ? C.text : C.muted }}>{label}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{sublabel}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
