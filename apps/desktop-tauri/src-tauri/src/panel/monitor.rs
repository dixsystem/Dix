use crate::event_bus::events::DixEvent;
use super::Panel;
use std::sync::Arc;
use tokio::sync::broadcast;

/// Tarea async que suscribe al EventBus y actualiza el estado de los pipelines.
/// Lanzar con tokio::spawn. Corre indefinidamente hasta que el canal se cierre.
pub async fn iniciar_monitor(panel: Arc<Panel>, mut rx: broadcast::Receiver<DixEvent>) {
    loop {
        match rx.recv().await {
            Ok(DixEvent::PipelineStateChanged { pipeline_id, estado }) => {
                if let Ok(mut pipelines) = panel.pipelines.write() {
                    if let Some(p) = pipelines.get_mut(&pipeline_id) {
                        p.estado = estado;
                        p.actualizado_en = chrono::Utc::now();
                    }
                }
            }
            Ok(_) => {} // otros eventos ignorados por el monitor de panel
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}
