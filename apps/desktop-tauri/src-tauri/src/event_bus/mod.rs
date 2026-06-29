pub mod events;

pub use events::DixEvent;

use tokio::sync::broadcast;

/// Error del Event Bus.
#[derive(Debug, thiserror::Error)]
pub enum EventBusError {
    #[error("Error al publicar evento: {0}")]
    SendError(String),
}

/// Bus de eventos pub/sub interno basado en Tokio broadcast channels.
pub struct EventBus {
    sender: broadcast::Sender<DixEvent>,
}

impl EventBus {
    /// Crea un nuevo EventBus con la capacidad de buffer indicada.
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Publica un evento a todos los suscriptores activos.
    pub fn publish(&self, event: DixEvent) -> Result<(), EventBusError> {
        self.sender
            .send(event)
            .map(|_| ())
            .map_err(|e| EventBusError::SendError(e.to_string()))
    }

    /// Devuelve un nuevo receptor para escuchar eventos futuros.
    pub fn subscribe(&self) -> broadcast::Receiver<DixEvent> {
        self.sender.subscribe()
    }
}
