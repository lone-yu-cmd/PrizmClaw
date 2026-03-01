/**
 * System Monitor Service
 * F-012: System Monitor
 *
 * Provides system information, process management, and monitoring capabilities.
 */

import os from 'node:os';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

/**
 * @typedef {Object} SystemInfo
 * @property {Object} cpu - CPU information
 * @property {number} cpu.usage - CPU usage percentage (0-100)
 * @property {number} cpu.cores - Number of CPU cores
 * @property {string} cpu.model - CPU model name
 * @property {Object} memory - Memory information
 * @property {number} memory.total - Total memory in bytes
 * @property {number} memory.free - Free memory in bytes
 * @property {number} memory.used - Used memory in bytes
 * @property {number} memory.usagePercent - Memory usage percentage
 * @property {Object} disk - Disk information
 * @property {number} disk.total - Total disk space in bytes
 * @property {number} disk.free - Free disk space in bytes
 * @property {number} disk.used - Used disk space in bytes
 * @property {number} disk.usagePercent - Disk usage percentage
 * @property {Object} network - Network information
 * @property {string[]} network.interfaces - Network interface names
 * @property {number} network.bytesReceived - Total bytes received
 * @property {number} network.bytesSent - Total bytes sent
 * @property {number} uptime - System uptime in seconds
 * @property {string} hostname - System hostname
 * @property {string} platform - Operating system platform
 */

/**
 * @typedef {Object} ProcessInfo
 * @property {number} pid - Process ID
 * @property {string} name - Process name
 * @property {number} cpu - CPU usage percentage
 * @property {number} memory - Memory usage percentage
 * @property {number} memoryBytes - Memory usage in bytes
 * @property {string} user - User running the process
 * @property {string} command - Full command line
 */

export class SystemMonitorService {
  constructor() {
    this.platform = process.platform;
    this._lastCpuInfo = null;
  }

  /**
   * Get comprehensive system information
   * @returns {Promise<SystemInfo>}
   */
  async getSystemInfo() {
    const [cpuInfo, diskInfo] = await Promise.all([
      this._getCpuInfo(),
      this._getDiskInfo()
    ]);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: cpuInfo,
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: totalMem > 0 ? (usedMem / totalMem) * 100 : 0
      },
      disk: diskInfo,
      network: this._getNetworkInfo(),
      uptime: os.uptime(),
      hostname: os.hostname(),
      platform: this.platform
    };
  }

  /**
   * Get list of running processes
   * @param {Object} options - Query options
   * @param {string} [options.sortBy='cpu'] - Sort by 'cpu' or 'memory'
   * @param {string} [options.filter] - Filter by keyword
   * @param {number} [options.limit=20] - Maximum number of processes to return
   * @returns {Promise<ProcessInfo[]>}
   */
  async getProcessList(options = {}) {
    const { sortBy = 'cpu', filter, limit = 20 } = options;

    let processes;
    try {
      processes = await this._getProcessListFromSystem();
    } catch (error) {
      // Return empty array if command fails
      return [];
    }

    // Apply filter
    if (filter) {
      const keyword = filter.toLowerCase();
      processes = processes.filter(proc =>
        proc.name.toLowerCase().includes(keyword) ||
        proc.command.toLowerCase().includes(keyword) ||
        String(proc.pid).includes(keyword)
      );
    }

    // Sort
    processes.sort((a, b) => {
      if (sortBy === 'memory') {
        return b.memory - a.memory;
      }
      return b.cpu - a.cpu;
    });

    // Limit
    return processes.slice(0, limit);
  }

  /**
   * Kill a process by PID
   * @param {number|string} pid - Process ID
   * @param {string} [signal='SIGTERM'] - Signal to send
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async killProcess(pid, signal = 'SIGTERM') {
    // Validate PID
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : pid;

    if (isNaN(numericPid) || numericPid <= 0) {
      return { success: false, error: 'Invalid PID: must be a positive number' };
    }

    try {
      // Check if process exists first
      process.kill(numericPid, 0);

      // Send the kill signal
      process.kill(numericPid, signal);

      return { success: true };
    } catch (error) {
      const code = error.code;
      if (code === 'ESRCH') {
        return { success: false, error: `Process ${numericPid} not found` };
      }
      if (code === 'EPERM') {
        return { success: false, error: `Permission denied to kill process ${numericPid}` };
      }
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const unit = units[Math.min(i, units.length - 1)];

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${unit}`;
  }

  /**
   * Format uptime to human readable string
   * @param {number} seconds - Uptime in seconds
   * @returns {string}
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Get CPU information
   * @private
   * @returns {Promise<{usage: number, cores: number, model: string}>}
   */
  async _getCpuInfo() {
    const cpus = os.cpus();
    const cores = cpus.length;
    const model = cpus[0]?.model || 'Unknown';

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    const usage = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;

    return {
      usage: Math.round(usage * 10) / 10,
      cores,
      model
    };
  }

  /**
   * Get disk information
   * @private
   * @returns {Promise<{total: number, free: number, used: number, usagePercent: number}>}
   */
  async _getDiskInfo() {
    try {
      let stdout;

      if (this.platform === 'win32') {
        // Windows: use wmic
        const result = await execAsync('wmic logicaldisk get size,freespace,caption /format:csv', {
          timeout: 5000
        });
        stdout = result.stdout;
        return this._parseWindowsDiskInfo(stdout);
      } else {
        // macOS/Linux: use df
        const result = await execAsync('df -k /', { timeout: 5000 });
        stdout = result.stdout;
        return this._parseUnixDiskInfo(stdout);
      }
    } catch (error) {
      // Return zeros if command fails
      return {
        total: 0,
        free: 0,
        used: 0,
        usagePercent: 0
      };
    }
  }

  /**
   * Parse Unix df command output
   * @private
   */
  _parseUnixDiskInfo(output) {
    const lines = output.trim().split('\n');
    if (lines.length < 2) {
      return { total: 0, free: 0, used: 0, usagePercent: 0 };
    }

    const parts = lines[1].split(/\s+/);
    if (parts.length < 4) {
      return { total: 0, free: 0, used: 0, usagePercent: 0 };
    }

    const total = parseInt(parts[1], 10) * 1024; // Convert from KB to bytes
    const used = parseInt(parts[2], 10) * 1024;
    const free = parseInt(parts[3], 10) * 1024;
    const usagePercent = total > 0 ? (used / total) * 100 : 0;

    return {
      total,
      free,
      used,
      usagePercent: Math.round(usagePercent * 10) / 10
    };
  }

  /**
   * Parse Windows wmic output
   * @private
   */
  _parseWindowsDiskInfo(output) {
    // Default to system drive
    const lines = output.trim().split('\n').filter(l => l.trim());
    let total = 0;
    let free = 0;

    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 3 && parts[1]) {
        // Get the first drive (usually C:)
        free = parseInt(parts[1], 10) || 0;
        total = parseInt(parts[2], 10) || 0;
        break;
      }
    }

    const used = total - free;
    const usagePercent = total > 0 ? (used / total) * 100 : 0;

    return {
      total,
      free,
      used,
      usagePercent: Math.round(usagePercent * 10) / 10
    };
  }

  /**
   * Get network information
   * @private
   */
  _getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const interfaceNames = Object.keys(interfaces).filter(name => name !== 'lo0' && name !== 'lo');

    return {
      interfaces: interfaceNames,
      bytesReceived: 0, // Requires platform-specific commands
      bytesSent: 0
    };
  }

  /**
   * Get process list from system
   * @private
   * @returns {Promise<ProcessInfo[]>}
   */
  async _getProcessListFromSystem() {
    try {
      let stdout;

      if (this.platform === 'win32') {
        // Windows: use tasklist
        const result = await execAsync('tasklist /fo csv /nh', { timeout: 10000 });
        stdout = result.stdout;
        return this._parseWindowsProcessList(stdout);
      } else {
        // macOS/Linux: use ps
        const result = await execAsync('ps aux', { timeout: 10000 });
        stdout = result.stdout;
        return this._parseUnixProcessList(stdout);
      }
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse Unix ps aux output
   * @private
   */
  _parseUnixProcessList(output) {
    const lines = output.trim().split('\n');
    const processes = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // ps aux format: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
      const parts = line.split(/\s+/);
      if (parts.length < 11) continue;

      const user = parts[0];
      const pid = parseInt(parts[1], 10);
      const cpu = parseFloat(parts[2]) || 0;
      const memory = parseFloat(parts[3]) || 0;
      const command = parts.slice(10).join(' ');

      // Extract process name from command
      const name = parts[10].split('/')[0].split(' ')[0];

      if (!isNaN(pid)) {
        processes.push({
          pid,
          name,
          cpu: Math.round(cpu * 10) / 10,
          memory: Math.round(memory * 10) / 10,
          memoryBytes: 0, // Would need RSS * 1024
          user,
          command
        });
      }
    }

    return processes;
  }

  /**
   * Parse Windows tasklist output
   * @private
   */
  _parseWindowsProcessList(output) {
    const lines = output.trim().split('\n');
    const processes = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      // CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
      const match = line.match(/"([^"]+)","(\d+)","([^"]+)","(\d+)","([^"]+)"/);
      if (!match) continue;

      const name = match[1];
      const pid = parseInt(match[2], 10);
      const memUsageStr = match[5].replace(/[^\d]/g, '');
      const memoryBytes = parseInt(memUsageStr, 10) * 1024; // Convert KB to bytes

      if (!isNaN(pid)) {
        processes.push({
          pid,
          name,
          cpu: 0, // Windows tasklist doesn't show CPU
          memory: 0, // Would need calculation
          memoryBytes,
          user: 'N/A',
          command: name
        });
      }
    }

    return processes;
  }
}

// Export singleton instance for convenience
export const systemMonitorService = new SystemMonitorService();

export default SystemMonitorService;
