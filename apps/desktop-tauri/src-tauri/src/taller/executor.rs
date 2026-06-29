use crate::cerebro::{Cerebro, CerebroError};
use crate::contracts::{EstadoTarea, Spec, Task};
use super::TallerError;

/// Ejecuta una tarea con reintentos hasta `task.max_intentos`.
/// Incrementa `task.intentos` en cada fallo. Al agotar, marca la tarea como Escalada.
pub async fn ejecutar_con_reintentos(
    cerebro: &Cerebro,
    spec: &Spec,
    task: &mut Task,
) -> Result<String, TallerError> {
    loop {
        match cerebro.execute_task(spec, task).await {
            Ok(resultado) => {
                task.estado = EstadoTarea::Completada;
                return Ok(resultado);
            }
            Err(CerebroError::TaskFailed { intentos: _, motivo }) => {
                task.intentos += 1;
                task.estado = EstadoTarea::Fallida;
                if task.intentos >= task.max_intentos {
                    task.estado = EstadoTarea::Escalada;
                    return Err(TallerError::Agotado {
                        max: task.max_intentos,
                        motivo,
                    });
                }
            }
            Err(e) => {
                task.intentos += 1;
                task.estado = EstadoTarea::Fallida;
                if task.intentos >= task.max_intentos {
                    task.estado = EstadoTarea::Escalada;
                    return Err(TallerError::Agotado {
                        max: task.max_intentos,
                        motivo: e.to_string(),
                    });
                }
            }
        }
    }
}
