use crate::contracts::{EstadoPipeline, EstadoTarea, Pipeline, Task};

/// Transiciona el estado del pipeline al nuevo estado dado.
pub fn transicionar(pipeline: &mut Pipeline, nuevo_estado: EstadoPipeline) {
    pipeline.estado = nuevo_estado;
    pipeline.actualizado_en = chrono::Utc::now();
}

/// Devuelve referencias a las tareas con estado Pendiente.
pub fn tareas_pendientes(pipeline: &Pipeline) -> Vec<&Task> {
    pipeline
        .tareas
        .iter()
        .filter(|t| matches!(t.estado, EstadoTarea::Pendiente))
        .collect()
}

/// Verifica si el pipeline puede continuar (no está cancelado ni fallido).
pub fn puede_continuar(pipeline: &Pipeline) -> bool {
    !matches!(
        pipeline.estado,
        EstadoPipeline::Cancelado | EstadoPipeline::Fallido | EstadoPipeline::Completado
    )
}
