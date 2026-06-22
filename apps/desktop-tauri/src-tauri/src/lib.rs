// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.
//
// Núcleo de DIX como librería — permite reutilizar scanner/policy/executor/
// command_engine/journal/etc. desde más de un binario (la app Tauri en
// main.rs, y dix-cli para servidores sin GUI) sin duplicar lógica de
// seguridad. Ningún módulo aquí depende de Tauri.

pub mod scanner;
pub mod analysis;
pub mod policy;
pub mod memory;
pub mod claude_gateway;
pub mod executor;
pub mod cache;
pub mod atlas;
pub mod benchmark;
pub mod state;
pub mod startup;
pub mod command_engine;
pub mod journal;
pub mod safe_mode;
pub mod ai_budget;
pub mod dixkontrol;
#[cfg(target_os = "windows")]
pub mod winutil;
