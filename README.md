# DIX — The World's First AppIA

![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![Tauri v2](https://img.shields.io/badge/Tauri_v2-24C8DB?style=flat&logo=tauri&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude_AI-D4A574?style=flat&logo=anthropic&logoColor=white)

<!-- DEMO GIF: replace this comment with ![DIX demo](docs/demo.gif) once recorded -->

---

## What is DIX

DIX reads your hardware and kernel state, sends it to a Claude-powered analysis layer, and applies a tailored set of kernel parameter changes — all in under a minute. It does not guess. It measures your actual CPU governor, scheduler, memory pressure, and I/O stack, then generates a script specific to your machine.

No generic tweaks. No placebo toggles. Real kernel tuning, validated before execution.

---

## How it works

**1. Scan** — DIX reads `/proc`, `/sys`, and hardware identifiers to build a full picture of your current system state.

**2. Analyze** — That snapshot is analyzed by Claude AI. The model returns a prioritized list of optimizations with estimated impact scores for your exact hardware.

**3. Apply** — A validated bash script is generated, reviewed by a static policy engine, and executed via `pkexec`. Every change is snapshotted first for one-click rollback.

---

## Install

Download the latest `.deb` from [Releases](../../releases) and install:

```bash
sudo apt install ./Dix_1.0.0_amd64.deb
```

Then launch **DIX** from your application menu or run:

```bash
dix
```

An AppImage is also available for distributions without `apt`.

---

## Requirements

- Ubuntu 20.04+ (or any systemd-based distro with equivalent kernel)
- Kernel 5.4 or newer
- `pkexec` (PolicyKit) — required for privilege escalation
- Active internet connection (analysis runs on the DIX proxy)
- DIX license key — get one at [dixsystem.com](https://dixsystem.com)

---

## Security

DIX enforces a strict static policy on every generated script before it touches `pkexec`. The following are permanently blocked, regardless of what the AI returns:

| Rule | Detail |
|------|--------|
| No GPU changes | Any reference to `nvidia`, `nouveau`, or `/sys/class/drm` is rejected |
| No `numa_balancing=0` | Disabling NUMA balancing is forbidden at the policy layer |
| No `dirty_ratio > 15` | `vm.dirty_ratio` is capped at 15 — values above are blocked |
| No `hugepages=never` | `transparent_hugepage=never` is explicitly rejected |

Scripts are also restricted to a whitelist of `sysctl` keys and `/sys/` paths. Any line that does not match — including `rm`, `curl`, `eval`, shell substitutions, and `/etc/` writes — causes the entire script to be rejected before execution.

The API key for Claude never leaves the proxy server. The client binary contains no credentials.

---

## License

Commercial — All rights reserved © 2026 DixSystem.

This software is proprietary. Redistribution, reverse engineering, and modification are not permitted without written authorization from DixSystem.

---

<p align="center">
  <a href="https://dixsystem.com">dixsystem.com</a> &nbsp;·&nbsp; @dixsystem
</p>
