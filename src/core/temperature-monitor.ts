import { execSync } from 'child_process';
import * as si from 'systeminformation';
import * as os from 'os';

export interface TemperatureData {
  cpu: number | null;
  gpu: number | null;
  main: number | null;
  cores: number[];
  sensors?: any[]; // Raw sensor data for debugging
  error?: string;
}

export class TemperatureMonitor {
  private platform: string;
  private isAdmin: boolean = false;

  constructor() {
    this.platform = os.platform();
    this.checkAdminPrivileges();
  }

  private checkAdminPrivileges(): void {
    try {
      if (this.platform === 'win32') {
        // Check if running as admin on Windows using multiple methods
        try {
          execSync('net session', { stdio: 'ignore' });
          this.isAdmin = true;
        } catch {
          // Try alternative method
          try {
            const result = execSync('whoami /groups | findstr S-1-16-12288', { stdio: 'pipe', encoding: 'utf8' });
            this.isAdmin = result.includes('12288');
          } catch {
            this.isAdmin = false;
          }
        }
      } else {
        this.isAdmin = process.getuid?.() === 0 || false;
      }
    } catch {
      this.isAdmin = false;
    }
  }

  async getTemperatures(): Promise<TemperatureData> {
    const errors: string[] = [];
    
    // Try multiple methods in order of preference
    
    // Method 1: systeminformation (cross-platform)
    try {
      const temps = await si.cpuTemperature();
      if (temps.main || (temps.cores && temps.cores.length > 0)) {
        return {
          cpu: temps.main || (temps.cores && temps.cores.length > 0 ? Math.max(...temps.cores) : null),
          gpu: null, // Will try other methods
          main: temps.main,
          cores: temps.cores || [],
        };
      }
    } catch (e: any) {
      errors.push(`systeminformation: ${e.message}`);
    }

    // Platform-specific fallbacks
    if (this.platform === 'win32') {
      return this.getWindowsTemperatures(errors);
    } else if (this.platform === 'darwin') {
      return this.getMacTemperatures(errors);
    } else if (this.platform === 'linux') {
      return this.getLinuxTemperatures(errors);
    }

    return {
      cpu: null,
      gpu: null,
      main: null,
      cores: [],
      error: errors.join('; '),
    };
  }

  private async getWindowsTemperatures(errors: string[]): Promise<TemperatureData> {
    let cpu: number | null = null;
    let gpu: number | null = null;

    // Try WMIC (requires admin)
    if (this.isAdmin) {
      try {
        // CPU temperature via WMI
        const result = execSync(
          'wmic /namespace:\\\\root\\\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature /value',
          { encoding: 'utf8', timeout: 5000 }
        );
        
        const matches = result.match(/CurrentTemperature=(\d+)/g);
        if (matches) {
          const temps = matches.map(m => {
            const val = parseInt(m.replace('CurrentTemperature=', ''));
            // WMI returns temperature in tenths of Kelvin
            return Math.round((val / 10) - 273.15);
          });
          cpu = Math.max(...temps);
        }
      } catch (e: any) {
        errors.push(`WMI: ${e.message}`);
      }

      // Try PowerShell (Windows 11 compatible)
      try {
        const psResult = execSync(
          'powershell -Command "Get-WmiObject -Class MSAcpi_ThermalZoneTemperature -Namespace root/wmi | Select-Object -ExpandProperty CurrentTemperature"',
          { encoding: 'utf8', timeout: 5000 }
        );
        
        const lines = psResult.trim().split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const temps = lines.map(l => {
            const val = parseInt(l.trim());
            if (!isNaN(val)) {
              return Math.round((val / 10) - 273.15);
            }
            return null;
          }).filter((t): t is number => t !== null);
          
          if (temps.length > 0) {
            cpu = Math.max(...temps);
          }
        }
      } catch (e: any) {
        errors.push(`PowerShell: ${e.message}`);
      }
    }

    // Try GPU temperature via NVIDIA SMI (works without admin for most GPUs)
    try {
      const nvidiaResult = execSync(
        'nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader',
        { encoding: 'utf8', timeout: 3000, shell: 'cmd' }
      );
      const gpuTemp = parseInt(nvidiaResult.trim());
      if (!isNaN(gpuTemp) && gpuTemp > 0 && gpuTemp < 120) {
        gpu = gpuTemp;
      }
    } catch {
      // nvidia-smi not available or no NVIDIA GPU
    }
    
    // Try LibreHardwareMonitor CLI if available (more reliable)
    if (!cpu || !gpu) {
      try {
        const lhmResult = execSync(
          'powershell -Command "Get-WmiObject -Namespace root/LibreHardwareMonitor -Class Sensor | Where-Object { $_.SensorType -eq \u0027Temperature\u0027 } | Select-Object -ExpandProperty Value"',
          { encoding: 'utf8', timeout: 5000 }
        );
        const temps = lhmResult.trim().split('\n')
          .map(t => parseFloat(t.trim()))
          .filter(t => !isNaN(t) && t > 0 && t < 120);
        if (temps.length > 0 && !cpu) {
          cpu = Math.round(Math.max(...temps));
        }
      } catch {
        // LibreHardwareMonitor not installed
      }
    }
    
    // Try OHM (Open Hardware Monitor) as fallback
    if (!cpu) {
      try {
        const ohmResult = execSync(
          'powershell -Command "Get-WmiObject -Namespace root/OpenHardwareMonitor -Class Sensor | Where-Object { $_.SensorType -eq \u0027Temperature\u0027 } | Select-Object Name, Value"',
          { encoding: 'utf8', timeout: 5000 }
        );
        const lines = ohmResult.trim().split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes('cpu') || line.toLowerCase().includes('core')) {
            const match = line.match(/(\d+\.?\d*)/);
            if (match) {
              const temp = parseFloat(match[1]);
              if (temp > 0 && temp < 120) {
                cpu = Math.round(temp);
                break;
              }
            }
          }
        }
      } catch {
        // OHM not available
      }
    }

    return {
      cpu,
      gpu,
      main: cpu,
      cores: cpu ? [cpu] : [],
      error: errors.length > 0 && !cpu ? errors.join('; ') : undefined,
    };
  }

  private async getMacTemperatures(errors: string[]): Promise<TemperatureData> {
    let cpu: number | null = null;
    let gpu: number | null = null;

    // Method 1: SMC via system_profiler (no admin needed)
    try {
      const result = execSync(
        'system_profiler SPiBridgeDataType SPSensorsDataType SPPowerDataType 2>/dev/null | grep -i "temperature\|thermal" | head -5',
        { encoding: 'utf8', timeout: 5000 }
      );
      // Parse any temperature values found
      const temps = result.match(/(\d+)\.?\d*\s*°?C?/gi);
      if (temps && temps.length > 0) {
        const values = temps.map(t => parseInt(t)).filter(v => v > 20 && v < 120);
        if (values.length > 0) {
          cpu = Math.round(values[0]);
        }
      }
    } catch {
      // system_profiler doesn't expose temps on most Macs
    }

    // Method 2: Use powermetrics with sudo (requires admin password on first run)
    if (!cpu) {
      try {
        const result = execSync(
          'powermetrics --samplers smc -n 1 -i 10 2>/dev/null | grep -E "(CPU die|GPU die|thermal)" | head -3',
          { encoding: 'utf8', timeout: 8000 }
        );
        const matches = result.match(/(\d+\.?\d*)\s*[°Cc]/);
        if (matches) {
          cpu = Math.round(parseFloat(matches[1]));
        }
      } catch {
        // powermetrics requires root or specific entitlements
      }
    }

    // Method 3: Check thermal pressure via pmset
    try {
      const result = execSync('pmset -g thermlog 2>/dev/null | grep -i "thermal" | head -1', 
        { encoding: 'utf8', timeout: 3000 }
      );
      if (result.toLowerCase().includes('normal')) {
        // Can't get exact temp but can infer it's in normal range (40-80°C)
      }
    } catch {
      // pmset thermal info not available
    }

    return {
      cpu,
      gpu,
      main: cpu,
      cores: cpu ? [cpu] : [],
      error: !cpu ? 'Températures non accessibles sur macOS ( limitation système)' : undefined,
    };
  }

  private async getLinuxTemperatures(errors: string[]): Promise<TemperatureData> {
    let cpu: number | null = null;
    let gpu: number | null = null;
    let allTemps: number[] = [];

    // Try sensors (lm-sensors)
    try {
      const result = execSync('sensors -u', { encoding: 'utf8', timeout: 3000 });
      // Parse sensors output for CPU
      const cpuMatches = result.match(/temp1_input:\s*([\d.]+)/);
      if (cpuMatches) {
        cpu = Math.round(parseFloat(cpuMatches[1]));
        allTemps.push(cpu);
      }
      
      // Parse for GPU if available
      const gpuMatches = result.match(/edge_input:\s*([\d.]+)|temp2_input:\s*([\d.]+)/);
      if (gpuMatches) {
        gpu = Math.round(parseFloat(gpuMatches[1] || gpuMatches[2]));
      }
    } catch (e: any) {
      errors.push(`sensors: ${e.message}`);
    }

    // Try thermal zone files directly
    if (!cpu) {
      try {
        const thermalPath = '/sys/class/thermal/';
        const zones = execSync(`ls ${thermalPath}`, { encoding: 'utf8' });
        const zoneDirs = zones.trim().split('\n').filter(d => d.startsWith('thermal_zone'));
        
        for (const zone of zoneDirs) {
          try {
            const temp = execSync(`cat ${thermalPath}${zone}/temp`, { encoding: 'utf8' });
            const val = parseInt(temp.trim());
            if (!isNaN(val) && val > 0) {
              // Convert millidegrees to degrees
              allTemps.push(Math.round(val / 1000));
            }
          } catch {
            // Ignore individual zone errors
          }
        }
        
        if (allTemps.length > 0) {
          cpu = Math.max(...allTemps);
        }
      } catch (e: any) {
        errors.push(`thermal zones: ${e.message}`);
      }
    }

    return {
      cpu,
      gpu,
      main: cpu,
      cores: allTemps,
      error: errors.length > 0 && !cpu ? errors.join('; ') : undefined,
    };
  }

  isAdminMode(): boolean {
    return this.isAdmin;
  }

  // Get admin requirement message
  getAdminMessage(): string {
    if (this.platform === 'win32') {
      if (!this.isAdmin) {
        return 'Relancer en admin pour les températures';
      }
      return 'Températures via WMI';
    } else if (this.platform === 'darwin') {
      return 'Températures CPU indisponibles (macOS)';
    }
    return 'Températures indisponibles';
  }
}
