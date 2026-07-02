# DIX — AI-Assisted System Optimization for Windows & Linux

![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![Tauri v2](https://img.shields.io/badge/Tauri_v2-24C8DB?style=flat&logo=tauri&logoColor=white)
![AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0--only-blue?style=flat)

<!-- DEMO GIF: replace this comment with ![DIX demo](docs/demo.gif) once recorded -->

---

## What DIX actually does

DIX reads real hardware and OS state (Windows registry/power settings, or Linux
`/proc`/`/sys`), sends that snapshot to an AI analysis step, and proposes a set of
concrete configuration changes specific to that snapshot. A validated script
implements the accepted changes; a static policy engine rejects anything outside a
fixed whitelist before it can run with elevated privileges.

It is not a generic tweak pack, it does not run autonomously without your review,
and it does not guarantee an improvement on every machine — the result depends on
what your current configuration already is. If your system is already well tuned,
DIX may find little or nothing to change.

---

## Current state

Real, working releases exist for Windows and Linux (see [Releases](../../releases)).
Implemented and in use: hardware scan, AI-assisted analysis, script generation and
execution, one-click rollback via snapshots, a real benchmark (before/after),
a startup-items panel, an optional active-tuning mode ("DixKontrol"), and a referral
system. This is single-maintainer software in active development — expect rough
edges, and please report issues.

---

## How it works

**1. Scan** — DIX reads local hardware/OS identifiers and current configuration.

**2. Analyze** — The snapshot is sent to an AI analysis step (Anthropic Claude),
either through DixSystem's proxy (license or free-tier limited) or directly with
your own API key (see BYOK below). The result is a prioritized list of changes with
an estimated impact.

**3. Apply** — A generated script passes a static policy check, then runs with
elevated privileges (`pkexec` on Linux, admin on Windows). Every change it touches
is snapshotted first, so it can be reverted with one click.

---

## Bring Your Own Key (BYOK)

You can use your own Anthropic API key instead of a DixSystem license:

- Configured from inside the app ("Mi API Key" / My API Key panel).
- Stored only on your machine, in your OS credential store (keyring on Linux,
  Credential Manager on Windows) — never in plain text unless your system offers no
  keyring at all, in which case it falls back to a local file.
- **Never sent to DixSystem.** With a key configured, DIX calls Anthropic's API
  directly — DixSystem's servers are not in that request path.
- Never hardcoded anywhere in this repository.

Without your own key, DIX falls back to DixSystem's proxy: a small number of free
analyses, then a paid license is required.

---

## Install

Download the package for your platform from [Releases](../../releases).

**Windows**
```
Run the .exe (NSIS) or .msi installer.
```

**Debian / Ubuntu / Linux Mint**
```bash
sudo apt install ./Dix_<version>_amd64.deb
```

**Fedora / openSUSE / RHEL**
```bash
sudo rpm -i Dix-<version>-1.x86_64.rpm
```

**Any Linux distribution (AppImage)**
```bash
chmod +x Dix_<version>_amd64.AppImage && ./Dix_<version>_amd64.AppImage
```

---

## Requirements

- Windows 10/11, or a systemd-based Linux distro with kernel 5.4+
- Linux only: `pkexec` (PolicyKit) for privilege escalation
- An internet connection for the analysis step — either with a DixSystem license/
  free tier, or with your own Anthropic API key (BYOK)
- No fully offline mode exists yet (see Limitations)

---

## Security

DIX enforces a strict static policy on every generated script before it touches
elevated execution. The following are permanently blocked, regardless of what the
AI returns:

| Rule | Detail |
|------|--------|
| No GPU changes | Any reference to `nvidia`, `nouveau`, or `/sys/class/drm` is rejected |
| No `numa_balancing=0` | Disabling NUMA balancing is forbidden at the policy layer |
| No `dirty_ratio > 15` | `vm.dirty_ratio` is capped at 15 — values above are blocked |
| No `hugepages=never` | `transparent_hugepage=never` is explicitly rejected |

Scripts are restricted to a whitelist of `sysctl` keys and `/sys/` paths (Linux) or
equivalent guardrails on Windows. Any line that does not match — including `rm`,
`curl`, `eval`, shell substitutions, and `/etc/` writes — causes the entire script
to be rejected before execution. This validator ships as part of this AGPL-licensed
repository — you can audit it yourself, it is not a black box.

---

## Known limitations

- No fully offline/local-only analysis mode yet — every analysis needs internet and
  either a DixSystem license or your own API key.
- Windows and Linux only — no macOS support.
- Rollback covers parameters the last applied script actually touched, not a full
  system snapshot.
- Single-maintainer project — response time on issues may vary.

---

## Repository scope

This repository contains DIX Windows/Linux — the public client — licensed
**AGPL-3.0-only**. It does **not** contain and never will:

- `dix-proxy/` — the server-side analysis/licensing backend DixSystem operates.
  Gitignored, never published here.
- DIX Forge — an internal tool DixSystem uses to build other AppIAs. It is a
  separate application with its own binary; it is not compiled into the DIX client
  and is not distributed in this repository.

---

## License

AGPL-3.0-only © 2026 DixSystem. See [LICENSE](LICENSE).

---

<p align="center">
  <a href="https://dixsystem.com">dixsystem.com</a> &nbsp;·&nbsp; @dixsystem
</p>
