use crate::contracts::{DecisionReview, Hallazgo, NivelHallazgo, Task};
use uuid::Uuid;

/// Construye el prompt para qwen-es que audita el resultado de una tarea.
pub fn build_audit_prompt(task: &Task) -> String {
    let resultado = task
        .resultado
        .as_deref()
        .unwrap_or("(sin resultado disponible)");
    format!(
        "Eres un auditor técnico senior de DIX Forge. Revisa el siguiente resultado de una tarea y detecta problemas.\n\
        \n\
        TAREA: {titulo}\n\
        DESCRIPCIÓN: {desc}\n\
        DOMINIO: {dominio:?}\n\
        RESULTADO:\n{resultado}\n\
        \n\
        Analiza el resultado e indica si hay:\n\
        - Errores críticos (menciona 'error crítico' si los hay)\n\
        - Advertencias o mejoras necesarias (menciona 'advertencia' o 'mejora' si las hay)\n\
        - Si el resultado es correcto, indica 'aprobado'\n\
        \n\
        Sé conciso y directo. Lista cada problema en una línea separada.",
        titulo = task.titulo,
        desc = task.descripcion,
        dominio = task.dominio,
        resultado = resultado,
    )
}

/// Parsea la respuesta del auditor en hallazgos y una decisión de revisión.
/// Heurística: detecta palabras clave en la respuesta.
pub fn parse_audit_response(response: &str, task_id: Uuid) -> (Vec<Hallazgo>, DecisionReview) {
    let lower = response.to_lowercase();
    let mut hallazgos: Vec<Hallazgo> = Vec::new();

    for line in response.lines() {
        let l = line.trim();
        if l.is_empty() {
            continue;
        }
        let ll = l.to_lowercase();
        let nivel = if ll.contains("error crítico") || ll.contains("error critico") || ll.contains("fallo crítico") {
            Some(NivelHallazgo::Critico)
        } else if ll.contains("advertencia") || ll.contains("importante") || ll.contains("warning") || ll.contains("crítico") {
            Some(NivelHallazgo::Importante)
        } else if ll.contains("mejora") || ll.contains("opcional") || ll.contains("sugerencia") {
            Some(NivelHallazgo::Opcional)
        } else {
            None
        };

        if let Some(nivel) = nivel {
            hallazgos.push(Hallazgo {
                id: Uuid::new_v4(),
                nivel,
                descripcion: l.to_string(),
                archivo: None,
                linea: None,
                sugerencia: None,
            });
        }
    }

    let decision = if lower.contains("aprobado") && hallazgos.is_empty() {
        DecisionReview::Aprobar
    } else if hallazgos.iter().any(|h| matches!(h.nivel, NivelHallazgo::Critico)) {
        DecisionReview::Escalar
    } else if !hallazgos.is_empty() {
        DecisionReview::NuevaIteracion
    } else {
        DecisionReview::Aprobar
    };

    let _ = task_id; // usado por el caller para trazabilidad
    (hallazgos, decision)
}
