// © 2026 DixSystem — Todos los derechos reservados.
// Dix — La primera AppIA del Mundo
// Prohibida la reproducción sin autorización expresa de DixSystem.

use std::path::PathBuf;
use std::process::ExitCode;

struct Cli {
    command: Command,
}

enum Command {
    Scan,
    Analyze {
        profile: Profile,
    },
    Apply {
        script: PathBuf,
    },
    Revert {
        rollback: String,
    },
}

enum Profile {
    Gaming,
    Streaming,
    Dev,
    Server,
    Balanced,
}

impl Cli {
    fn parse() -> Result<Self, String> {
        let mut args = std::env::args().skip(1);
        let command = match args.next().as_deref() {
            Some("scan") => {
                ensure_no_extra(args)?;
                Command::Scan
            }
            Some("analyze") => {
                let flag = args
                    .next()
                    .ok_or_else(|| usage_error("Falta --profile <gaming|streaming|dev|server|balanced>"))?;
                if flag != "--profile" {
                    return Err(usage_error("Uso: dix-cli analyze --profile <gaming|streaming|dev|server|balanced>"));
                }
                let profile = args
                    .next()
                    .ok_or_else(|| usage_error("Falta valor para --profile"))?;
                ensure_no_extra(args)?;
                Command::Analyze {
                    profile: Profile::parse(&profile)?,
                }
            }
            Some("apply") => {
                let script = args
                    .next()
                    .ok_or_else(|| usage_error("Uso: dix-cli apply <ruta-a-script.sh>"))?;
                ensure_no_extra(args)?;
                Command::Apply {
                    script: PathBuf::from(script),
                }
            }
            Some("revert") => {
                let rollback = args
                    .next()
                    .ok_or_else(|| usage_error("Uso: dix-cli revert <nombre-rollback.sh>"))?;
                ensure_no_extra(args)?;
                Command::Revert { rollback }
            }
            Some("-h") | Some("--help") => return Err(usage()),
            Some(other) => return Err(usage_error(&format!("Subcomando desconocido: {}", other))),
            None => return Err(usage()),
        };

        Ok(Self { command })
    }
}

impl Profile {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "gaming" => Ok(Self::Gaming),
            "streaming" => Ok(Self::Streaming),
            "dev" => Ok(Self::Dev),
            "server" => Ok(Self::Server),
            "balanced" => Ok(Self::Balanced),
            _ => Err(usage_error("Perfil inválido. Usa gaming, streaming, dev, server o balanced")),
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Gaming => "gaming",
            Self::Streaming => "streaming",
            Self::Dev => "dev",
            Self::Server => "server",
            Self::Balanced => "balanced",
        }
    }
}

fn ensure_no_extra(mut args: impl Iterator<Item = String>) -> Result<(), String> {
    if let Some(extra) = args.next() {
        Err(usage_error(&format!("Argumento inesperado: {}", extra)))
    } else {
        Ok(())
    }
}

fn usage_error(message: &str) -> String {
    format!("{}\n\n{}", message, usage())
}

fn usage() -> String {
    "Uso:\n  dix-cli scan\n  dix-cli analyze --profile <gaming|streaming|dev|server|balanced>\n  dix-cli apply <ruta-a-script.sh>\n  dix-cli revert <nombre-rollback.sh>".to_string()
}

#[tokio::main]
async fn main() -> ExitCode {
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("Error: {}", err);
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), String> {
    let cli = Cli::parse()?;

    match cli.command {
        Command::Scan => {
            let scan = dix::scanner::scan()?;
            let json = serde_json::to_string_pretty(&scan)
                .map_err(|e| format!("No se pudo serializar el escaneo: {}", e))?;
            println!("{}", json);
        }
        Command::Analyze { profile } => {
            let scan = dix::scanner::scan()?;
            let profile = profile.as_str();

            #[cfg(target_os = "windows")]
            let system = format!(
                "Eres un experto en optimizacion Windows. Respondes SOLO con JSON valido sin markdown.\n{}",
                dix::analysis::profile_hint(profile)
            );
            #[cfg(not(target_os = "windows"))]
            let system = format!(
                "{}\n{}\n{}",
                "Eres un experto en optimización Linux. Respondes SOLO con JSON válido sin markdown.",
                dix::policy::policy_rules_for_prompt(),
                dix::analysis::profile_hint(profile)
            );

            #[cfg(target_os = "windows")]
            let user = dix::analysis::build_analysis_prompt_windows(&scan, None, profile);
            #[cfg(not(target_os = "windows"))]
            let user = dix::analysis::build_analysis_prompt(&scan, None, profile);

            // Deliberadamente no replica caché, Atlas ni límites demo de la GUI:
            // el CLI ejecuta un análisis directo y deja la seguridad al gateway/policy.
            let result = dix::claude_gateway::call(&system, &user, 4000).await?;
            println!("{}", result);
        }
        Command::Apply { script } => {
            let content = std::fs::read_to_string(&script)
                .map_err(|e| format!("No se pudo leer {}: {}", script.display(), e))?;
            let scan = dix::scanner::scan()?;
            let result = dix::executor::run_script(&content, &scan)?;
            println!("{}", result);
        }
        Command::Revert { rollback } => {
            let result = dix::executor::execute_rollback(&rollback)?;
            println!("{}", result);
        }
    }

    Ok(())
}
