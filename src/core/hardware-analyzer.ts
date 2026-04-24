import * as si from 'systeminformation';
import { TemperatureMonitor, TemperatureData as ExtendedTemperatureData } from './temperature-monitor';

export interface SystemInfo {
  os: {
    platform: string;
    distro: string;
    release: string;
    arch: string;
  };
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speed: number;
    speedMax: number;
  };
  gpu: Array<{
    vendor: string;
    model: string;
    vram: number;
  }>;
  ram: {
    total: number;
    type: string;
    speed: number;
  };
  storage: Array<{
    device: string;
    type: string;
    size: number;
    model: string;
  }>;
  motherboard: {
    manufacturer: string;
    model: string;
  };
}

export interface TemperatureData {
  cpu: number | null;
  gpu: number | null;
  main: number | null;
  cores: number[];
}

export class HardwareAnalyzer {
  private tempMonitor: TemperatureMonitor;

  constructor() {
    this.tempMonitor = new TemperatureMonitor();
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const [osInfo, cpuInfo, graphics, mem, disk, baseboard] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.graphics(),
      si.mem(),
      si.diskLayout(),
      si.baseboard(),
    ]);

    return {
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        arch: osInfo.arch,
      },
      cpu: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
        speed: cpuInfo.speed,
        speedMax: cpuInfo.speedMax || cpuInfo.speed,
      },
      gpu: graphics.controllers.map(gpu => ({
        vendor: gpu.vendor || 'Unknown',
        model: gpu.model || 'Unknown',
        vram: gpu.vram || 0,
      })),
      ram: {
        total: mem.total,
        type: 'Unknown', // Would need dmidecode on Linux
        speed: 0,
      },
      storage: disk.map(d => ({
        device: d.device,
        type: d.type,
        size: d.size,
        model: d.name || 'Unknown',
      })),
      motherboard: {
        manufacturer: baseboard.manufacturer || 'Unknown',
        model: baseboard.model || 'Unknown',
      },
    };
  }

  async getCPUInfo(): Promise<any> {
    const cpu = await si.cpu();
    const currentLoad = await si.currentLoad();
    
    return {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      vendor: cpu.vendor,
      family: cpu.family,
      model: cpu.model,
      stepping: cpu.stepping,
      speed: cpu.speed,
      speedMin: cpu.speedMin,
      speedMax: cpu.speedMax,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores,
      processors: cpu.processors,
      flags: cpu.flags,
      usage: currentLoad.currentLoad,
      loadPerCore: currentLoad.cpus.map(c => c.load),
    };
  }

  async getGPUInfo(): Promise<any> {
    const graphics = await si.graphics();
    
    return {
      controllers: graphics.controllers.map(gpu => ({
        vendor: gpu.vendor,
        model: gpu.model,
        vram: gpu.vram,
        vramDynamic: gpu.vramDynamic,
        bus: gpu.bus,
        pciBus: gpu.pciBus,
      })),
      displays: graphics.displays.map(display => ({
        vendor: display.vendor,
        model: display.model,
        resolutionX: display.resolutionX,
        resolutionY: display.resolutionY,
        refreshRate: display.currentResY || 60,
      })),
    };
  }

  async getRAMInfo(): Promise<any> {
    const mem = await si.mem();
    const memLayout = await si.memLayout();
    
    return {
      total: mem.total,
      free: mem.free,
      used: mem.used,
      active: mem.active,
      available: mem.available,
      swaptotal: mem.swaptotal,
      swapused: mem.swapused,
      swapfree: mem.swapfree,
      layout: memLayout.map(slot => ({
        size: slot.size,
        type: slot.type,
        speed: slot.clockSpeed,
        manufacturer: slot.manufacturer,
        partNum: slot.partNum,
      })),
    };
  }

  async getStorageInfo(): Promise<any> {
    const disks = await si.diskLayout();
    const fsSize = await si.fsSize();
    const blockDevices = await si.blockDevices();
    
    return {
      disks: disks.map(disk => ({
        device: disk.device,
        type: disk.type,
        name: disk.name,
        vendor: disk.vendor,
        size: disk.size,
        interfaceType: disk.interfaceType,
        smartStatus: disk.smartStatus,
      })),
      filesystems: fsSize.map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: fs.size,
        used: fs.used,
        available: fs.available,
        use: fs.use,
        mount: fs.mount,
      })),
      blockDevices: blockDevices.map(dev => ({
        name: dev.name,
        type: dev.type,
        size: dev.size,
        mount: dev.mount,
        label: dev.label,
        model: dev.model,
      })),
    };
  }

  async getTemperatures(): Promise<ExtendedTemperatureData> {
    return this.tempMonitor.getTemperatures();
  }

  getTempAdminMessage(): string {
    return this.tempMonitor.getAdminMessage();
  }

  isAdminMode(): boolean {
    return this.tempMonitor.isAdminMode();
  }

  async getNetworkInfo(): Promise<any> {
    const networkInterfaces = await si.networkInterfaces();
    const defaultInterface = await si.networkInterfaceDefault();
    
    return {
      defaultInterface,
      interfaces: networkInterfaces.map(iface => ({
        iface: iface.iface,
        ifaceName: iface.ifaceName,
        ip4: iface.ip4,
        ip6: iface.ip6,
        mac: iface.mac,
        type: iface.type,
        speed: iface.speed,
        duplex: iface.duplex,
      })),
    };
  }

  async getBatteryInfo(): Promise<any> {
    const battery = await si.battery();
    
    return {
      hasBattery: battery.hasBattery,
      isCharging: battery.isCharging,
      voltage: battery.voltage,
      percent: battery.percent,
      timeRemaining: battery.timeRemaining,
      acConnected: battery.acConnected,
      maxCapacity: battery.maxCapacity,
      currentCapacity: battery.currentCapacity,
    };
  }
}
