<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="120" alt="Dix logo"/>
</p>

<h1 align="center">Dix</h1>

<p align="center">
  <strong>The first AppIA for Linux.</strong><br/>
  AI analyzes your system and maximizes performance automatically.
</p>

<p align="center">
  <a href="https://dixsystem.com"><img src="https://img.shields.io/badge/website-dixsystem.com-orange?style=flat-square" alt="Website"/></a>
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version"/>
  <img src="https://img.shields.io/badge/platform-Linux-green?style=flat-square" alt="Platform"/>
  <img src="https://img.shields.io/badge/license-BSL_1.1-red?style=flat-square" alt="License"/>
</p>

---

## What is Dix?

Dix connects to Claude AI, scans 16 system parameters in real time, and generates a custom optimization script for your exact hardware. One click. No technical knowledge required.

## Real results — tested on Intel i5-12400 + RTX 3060 + 32GB DDR4

| Metric | Before | After | Improvement |
|---|---|---|---|
| Global score | 62/100 | 91/100 | **+47%** |
| CPU performance (sysbench) | 6,700 ev/s | 7,760 ev/s | **+15%** |
| TCP throughput (BBR) | baseline | active | **+40%** |
| NVMe latency (kyber) | baseline | optimized | **-30%** |

## Features

- **AI-powered analysis** — Claude reads your hardware and generates a personalized script
- **One-click optimization** — apply all tweaks with a single button, pkexec handles privileges
- **Safe by design** — GPU never touched, strict parameter limits enforced
- **Rollback included** — revert any change instantly
- **Score system** — before/after score so you see exactly what improved
- **Free demo** — 1 full analysis free, no account required
- **Auto-updater** — stays up to date automatically via GitHub Releases

## Installation

### Debian / Ubuntu / Linux Mint (.deb)
```bash
wget https://github.com/dixsystem/dix/releases/latest/download/Dix_1.0.0_amd64.deb
sudo dpkg -i Dix_1.0.0_amd64.deb
```

### Fedora / openSUSE / RHEL (.rpm)
```bash
wget https://github.com/dixsystem/dix/releases/latest/download/Dix-1.0.0-1.x86_64.rpm
sudo rpm -i Dix-1.0.0-1.x86_64.rpm
```

### Any distribution (.AppImage)
```bash
wget https://github.com/dixsystem/dix/releases/latest/download/Dix_1.0.0_amd64.AppImage
chmod +x Dix_1.0.0_amd64.AppImage
./Dix_1.0.0_amd64.AppImage
```

## Requirements

- Linux x86_64
- `pkexec` (included in most distributions)
- Active internet connection for AI analysis

## Tested on

- Ubuntu 24.04 / 26.04
- Fedora 40+
- Linux Mint 21+
- Arch Linux

## Get Dix Pro

[**dixsystem.com**](https://dixsystem.com) — €14.99 one-time payment. No subscription. Yours forever.

## License

Dix is released under the [Business Source License 1.1](LICENSE).  
Free for personal use. Commercial use requires written permission from DixSystem.  
Converts to MIT License on June 5, 2030.

---

<p align="center">
  Made with ❤️ by <a href="https://dixsystem.com">DixSystem</a>
</p>
