#!/bin/bash
echo "Iniciando optimizacion del sistema..."
echo "Configurando CPU Governor a performance..."
echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor || true
echo "Ajustando scheduler NVMe a none..."
echo none | tee /sys/block/nvme*/queue/scheduler || true
echo "Configurando swappiness a 10..."
sysctl -w vm.swappiness=10 || true
echo "vm.swappiness=10" >> /etc/sysctl.conf || true
echo "Configurando NVIDIA performance mode..."
nvidia-settings -a "[gpu:0]/GpuPowerMizerMode=1" || true
nvidia-smi -pm 1 || true
nvidia-smi -pl 170 || true
echo "Habilitando transparent hugepages en madvise..."
echo madvise | tee /sys/kernel/mm/transparent_hugepage/enabled || true
echo "Desactivando mitigaciones Spectre/Meltdown..."
sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/&mitigations=off /' /etc/default/grub || true
update-grub || true
echo "Aumentando readahead NVMe a 512KB..."
blockdev --setra 1024 /dev/nvme0n1 || true
echo "Optimizando interrupciones de red (IRQ affinity)..."
for irq in $(grep eth0 /proc/interrupts | awk '{print $1}' | sed 's/://'); do echo 0f > /proc/irq/$irq/smp_affinity || true; done
echo "Configurando dirty_ratio para escrituras..."
sysctl -w vm.dirty_ratio=15 || true
sysctl -w vm.dirty_background_ratio=5 || true
echo "vm.dirty_ratio=15" >> /etc/sysctl.conf || true
echo "vm.dirty_background_ratio=5" >> /etc/sysctl.conf || true
echo "Deshabilitando watchdog del kernel..."
sysctl -w kernel.nmi_watchdog=0 || true
echo "kernel.nmi_watchdog=0" >> /etc/sysctl.conf || true
echo "Ajustes de red adicionales..."
sysctl -w net.core.netdev_max_backlog=5000 || true
sysctl -w net.ipv4.tcp_fastopen=3 || true
echo "Optimizando cache de archivo..."
sysctl -w vm.vfs_cache_pressure=50 || true
echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.conf || true
echo "Configuracion completada. Reinicio requerido para aplicar todos los cambios."
echo "Ejecuta: reboot"
