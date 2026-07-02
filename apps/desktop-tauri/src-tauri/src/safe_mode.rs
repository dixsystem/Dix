// SPDX-License-Identifier: AGPL-3.0-only
// Copyright © 2026 DixSystem
//
// Modo de rescate de arranque. Si una optimización deja el sistema en un
// bucle de arranque (boot loop), la app de Dix no puede ni abrirse para que
// el usuario pulse "deshacer". Esta red de seguridad vive fuera de la app:
// un servicio systemd que arranca muy temprano cuenta intentos de arranque
// sin confirmar, y si detecta 2 arranques seguidos sin llegar al escritorio,
// restaura automáticamente la última copia de seguridad — sin depender de
// que nada de la interfaz de Dix funcione.

/// Se ejecuta en cada arranque, muy pronto (sysinit.target). Cuenta
/// intentos; si hay 2 sin confirmación y existe un rollback pendiente, lo
/// aplica él mismo y limpia el contador.
pub const BOOT_CHECK_SCRIPT: &str = "#!/bin/bash\n\
# Dix — Red de seguridad de arranque. NO editar manualmente.\n\
set -u\n\
mkdir -p /var/lib/dix\n\
COUNTER_FILE=/var/lib/dix/boot_attempts\n\
MARKER_FILE=/var/lib/dix/pending_rollback\n\
COUNT=$(cat \"$COUNTER_FILE\" 2>/dev/null || echo 0)\n\
case \"$COUNT\" in (''|*[!0-9]*) COUNT=0 ;; esac\n\
COUNT=$((COUNT + 1))\n\
echo \"$COUNT\" > \"$COUNTER_FILE\"\n\
if [ \"$COUNT\" -ge 2 ] && [ -f \"$MARKER_FILE\" ]; then\n\
  ROLLBACK=$(cat \"$MARKER_FILE\")\n\
  if [ -n \"$ROLLBACK\" ] && [ -f \"$ROLLBACK\" ]; then\n\
    logger -t dix-safe-mode \"Arranque inestable detectado ($COUNT intentos sin confirmar) — restaurando $ROLLBACK\" || true\n\
    bash \"$ROLLBACK\" || true\n\
  fi\n\
  rm -f \"$MARKER_FILE\"\n\
  echo 0 > \"$COUNTER_FILE\"\n\
fi\n";

/// Se ejecuta solo si el arranque llega bien hasta el escritorio
/// (graphical.target). Confirma que todo fue bien y resetea el contador.
pub const BOOT_CONFIRM_SCRIPT: &str = "#!/bin/bash\n\
# Dix — Confirmación de arranque correcto. NO editar manualmente.\n\
mkdir -p /var/lib/dix\n\
echo 0 > /var/lib/dix/boot_attempts 2>/dev/null || true\n";

pub const BOOT_CHECK_SERVICE: &str = "[Unit]\n\
Description=Dix - Boot safety net (cuenta arranques sin confirmar)\n\
DefaultDependencies=no\n\
Before=basic.target\n\
\n\
[Service]\n\
Type=oneshot\n\
RemainAfterExit=no\n\
ExecStart=/bin/bash /usr/local/lib/dix/boot-check.sh\n\
\n\
[Install]\n\
WantedBy=sysinit.target\n";

pub const BOOT_CONFIRM_SERVICE: &str = "[Unit]\n\
Description=Dix - Confirma arranque correcto hasta el escritorio\n\
After=graphical.target\n\
\n\
[Service]\n\
Type=oneshot\n\
RemainAfterExit=yes\n\
ExecStart=/bin/bash /usr/local/lib/dix/boot-confirm.sh\n\
\n\
[Install]\n\
WantedBy=graphical.target\n";

/// Construye las líneas (a ejecutar ya como root, dentro del script
/// combinado existente) que instalan la red de seguridad y apuntan el
/// rollback de esta transacción como "pendiente de confirmar".
pub fn install_lines(check_path: &str, confirm_path: &str, check_svc_path: &str, confirm_svc_path: &str, rollback_abs_path: &str) -> String {
    format!(
        "mkdir -p /usr/local/lib/dix /var/lib/dix\n\
         /usr/bin/tee /usr/local/lib/dix/boot-check.sh < {check} > /dev/null\n\
         chmod +x /usr/local/lib/dix/boot-check.sh\n\
         /usr/bin/tee /usr/local/lib/dix/boot-confirm.sh < {confirm} > /dev/null\n\
         chmod +x /usr/local/lib/dix/boot-confirm.sh\n\
         /usr/bin/tee /etc/systemd/system/dix-boot-check.service < {check_svc} > /dev/null\n\
         /usr/bin/tee /etc/systemd/system/dix-boot-confirm.service < {confirm_svc} > /dev/null\n\
         systemctl daemon-reload 2>/dev/null || true\n\
         systemctl enable dix-boot-check.service dix-boot-confirm.service 2>/dev/null || true\n\
         echo {rollback} > /var/lib/dix/pending_rollback\n",
        check = check_path, confirm = confirm_path,
        check_svc = check_svc_path, confirm_svc = confirm_svc_path,
        rollback = rollback_abs_path,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boot_check_never_disables_below_threshold() {
        // El script solo restaura si COUNT >= 2 — un único arranque fallido
        // no debe disparar el rollback automático.
        assert!(BOOT_CHECK_SCRIPT.contains("COUNT\" -ge 2"));
    }

    #[test]
    fn boot_confirm_resets_counter() {
        assert!(BOOT_CONFIRM_SCRIPT.contains("echo 0 > /var/lib/dix/boot_attempts"));
    }

    #[test]
    fn install_lines_includes_rollback_marker() {
        let lines = install_lines("/a", "/b", "/c", "/d", "/home/x/.config/dix/rollbacks/rollback_1.sh");
        assert!(lines.contains("/home/x/.config/dix/rollbacks/rollback_1.sh"));
        assert!(lines.contains("pending_rollback"));
    }

    #[test]
    fn services_are_independent_of_dix_app() {
        // Ninguno de los dos servicios debe depender de que la app Dix esté
        // corriendo — deben funcionar aunque la UI nunca llegue a abrirse.
        assert!(!BOOT_CHECK_SERVICE.contains("dix.service"));
        assert!(!BOOT_CONFIRM_SERVICE.contains("dix.service"));
    }
}
