import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { spawn } from 'node:child_process';

// Mock data
const mockCpus = [
  { model: 'Apple M1 Pro', speed: 2400, times: { user: 100, nice: 10, sys: 50, idle: 800, irq: 5 } },
  { model: 'Apple M1 Pro', speed: 2400, times: { user: 90, nice: 8, sys: 45, idle: 820, irq: 4 } }
];

const mockNetworkInterfaces = {
  en0: [{ address: '192.168.1.100', family: 'IPv4', internal: false, rx: 1000000, tx: 500000 }],
  lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }]
};

describe('F-012 SystemMonitorService', () => {
  let SystemMonitorService;
  let originalPlatform;
  let originalHomedir;
  let originalCpus;
  let originalTotalmem;
  let originalFreemem;
  let originalUptime;
  let originalHostname;
  let originalNetworkInterfaces;

  beforeEach(async () => {
    // Save original values
    originalPlatform = process.platform;
    originalHomedir = os.homedir;
    originalCpus = os.cpus;
    originalTotalmem = os.totalmem;
    originalFreemem = os.freemem;
    originalUptime = os.uptime;
    originalHostname = os.hostname;
    originalNetworkInterfaces = os.networkInterfaces;

    // Mock os methods
    os.cpus = () => mockCpus;
    os.totalmem = () => 16 * 1024 * 1024 * 1024; // 16GB
    os.freemem = () => 6 * 1024 * 1024 * 1024; // 6GB free
    os.uptime = () => 86400; // 1 day
    os.hostname = () => 'test-host';
    os.networkInterfaces = () => mockNetworkInterfaces;

    // Import fresh module
    const module = await import('../../src/services/system-monitor-service.js');
    SystemMonitorService = module.SystemMonitorService;
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    os.homedir = originalHomedir;
    os.cpus = originalCpus;
    os.totalmem = originalTotalmem;
    os.freemem = originalFreemem;
    os.uptime = originalUptime;
    os.hostname = originalHostname;
    os.networkInterfaces = originalNetworkInterfaces;
  });

  describe('getSystemInfo', () => {
    test('should return valid system info structure', async () => {
      const service = new SystemMonitorService();
      const info = await service.getSystemInfo();

      assert.ok(info, 'Should return system info object');
      assert.ok(info.cpu, 'Should have cpu info');
      assert.ok(info.memory, 'Should have memory info');
      assert.ok(info.disk, 'Should have disk info');
      assert.ok(info.network, 'Should have network info');
      assert.ok(typeof info.uptime === 'number', 'Should have uptime');
      assert.ok(typeof info.hostname === 'string', 'Should have hostname');
      assert.ok(typeof info.platform === 'string', 'Should have platform');
    });

    test('should return CPU info with correct structure', async () => {
      const service = new SystemMonitorService();
      const info = await service.getSystemInfo();

      assert.ok(info.cpu.cores, 'Should have cpu cores');
      assert.ok(info.cpu.model, 'Should have cpu model');
      assert.ok(typeof info.cpu.usage === 'number', 'Should have cpu usage');
      assert.ok(info.cpu.usage >= 0 && info.cpu.usage <= 100, 'CPU usage should be 0-100');
    });

    test('should return memory info with correct structure', async () => {
      const service = new SystemMonitorService();
      const info = await service.getSystemInfo();

      assert.ok(typeof info.memory.total === 'number', 'Should have total memory');
      assert.ok(typeof info.memory.free === 'number', 'Should have free memory');
      assert.ok(typeof info.memory.used === 'number', 'Should have used memory');
      assert.ok(typeof info.memory.usagePercent === 'number', 'Should have usage percent');
      assert.ok(info.memory.usagePercent >= 0 && info.memory.usagePercent <= 100, 'Memory usage should be 0-100');
    });

    test('should calculate memory usage correctly', async () => {
      const service = new SystemMonitorService();
      const info = await service.getSystemInfo();

      // Total 16GB, Free 6GB, Used 10GB -> 62.5% usage
      assert.equal(info.memory.total, 16 * 1024 * 1024 * 1024);
      assert.equal(info.memory.free, 6 * 1024 * 1024 * 1024);
      assert.equal(info.memory.used, 10 * 1024 * 1024 * 1024);
      assert.ok(Math.abs(info.memory.usagePercent - 62.5) < 1, 'Memory usage should be ~62.5%');
    });

    test('should return uptime in seconds', async () => {
      const service = new SystemMonitorService();
      const info = await service.getSystemInfo();

      assert.equal(info.uptime, 86400, 'Uptime should be 86400 seconds');
    });

    test('should return hostname', async () => {
      const service = new SystemMonitorService();
      const info = await service.getSystemInfo();

      assert.equal(info.hostname, 'test-host', 'Hostname should match');
    });

    test('should return platform', async () => {
      const service = new SystemMonitorService();
      const info = await service.getSystemInfo();

      assert.ok(['darwin', 'linux', 'win32'].includes(info.platform) || typeof info.platform === 'string', 'Platform should be valid');
    });
  });

  describe('getProcessList', () => {
    test('should return array of processes', async () => {
      const service = new SystemMonitorService();
      const processes = await service.getProcessList();

      assert.ok(Array.isArray(processes), 'Should return an array');
      if (processes.length > 0) {
        const proc = processes[0];
        assert.ok(typeof proc.pid === 'number', 'Should have pid');
        assert.ok(typeof proc.name === 'string', 'Should have name');
        assert.ok(typeof proc.cpu === 'number', 'Should have cpu');
        assert.ok(typeof proc.memory === 'number', 'Should have memory');
      }
    });

    test('should sort by CPU when sortBy=cpu', async () => {
      const service = new SystemMonitorService();
      const processes = await service.getProcessList({ sortBy: 'cpu' });

      if (processes.length > 1) {
        for (let i = 1; i < processes.length; i++) {
          assert.ok(processes[i - 1].cpu >= processes[i].cpu, 'Should be sorted by CPU descending');
        }
      }
    });

    test('should sort by memory when sortBy=memory', async () => {
      const service = new SystemMonitorService();
      const processes = await service.getProcessList({ sortBy: 'memory' });

      if (processes.length > 1) {
        for (let i = 1; i < processes.length; i++) {
          assert.ok(processes[i - 1].memory >= processes[i].memory, 'Should be sorted by memory descending');
        }
      }
    });

    test('should filter processes by keyword', async () => {
      const service = new SystemMonitorService();
      const processes = await service.getProcessList({ filter: 'node' });

      if (processes.length > 0) {
        for (const proc of processes) {
          const matchesKeyword = proc.name.toLowerCase().includes('node') ||
            proc.command.toLowerCase().includes('node');
          assert.ok(matchesKeyword, 'All processes should match filter keyword');
        }
      }
    });

    test('should limit process count', async () => {
      const service = new SystemMonitorService();
      const processes = await service.getProcessList({ limit: 10 });

      assert.ok(processes.length <= 10, 'Should not exceed limit');
    });
  });

  describe('killProcess', () => {
    test('should return error for invalid PID', async () => {
      const service = new SystemMonitorService();
      const result = await service.killProcess('invalid');

      assert.equal(result.success, false);
      assert.ok(result.error, 'Should have error message');
    });

    test('should return error for negative PID', async () => {
      const service = new SystemMonitorService();
      const result = await service.killProcess(-1);

      assert.equal(result.success, false);
      assert.ok(result.error, 'Should have error message');
    });

    test('should return error for non-existent PID', async () => {
      const service = new SystemMonitorService();
      // PID 999999 is unlikely to exist
      const result = await service.killProcess(999999);

      assert.equal(result.success, false);
      assert.ok(result.error, 'Should have error message for non-existent process');
    });
  });

  describe('formatUptime', () => {
    test('should format seconds correctly', async () => {
      const service = new SystemMonitorService();
      const formatted = service.formatUptime(45);

      assert.ok(formatted.includes('45'), 'Should include seconds');
    });

    test('should format minutes correctly', async () => {
      const service = new SystemMonitorService();
      const formatted = service.formatUptime(125); // 2m 5s

      assert.ok(formatted.includes('2'), 'Should include minutes');
    });

    test('should format hours correctly', async () => {
      const service = new SystemMonitorService();
      const formatted = service.formatUptime(3665); // 1h 1m 5s

      assert.ok(formatted.includes('1'), 'Should include hours');
    });

    test('should format days correctly', async () => {
      const service = new SystemMonitorService();
      const formatted = service.formatUptime(90065); // 1d 1h 1m 5s

      assert.ok(formatted.includes('1'), 'Should include days');
    });
  });

  describe('formatBytes', () => {
    test('should format bytes', async () => {
      const service = new SystemMonitorService();
      assert.ok(service.formatBytes(500).includes('B'));
      assert.ok(service.formatBytes(500).includes('500'));
    });

    test('should format kilobytes', async () => {
      const service = new SystemMonitorService();
      assert.ok(service.formatBytes(1024).includes('KB'));
    });

    test('should format megabytes', async () => {
      const service = new SystemMonitorService();
      const result = service.formatBytes(1024 * 1024);
      assert.ok(result.includes('MB'));
    });

    test('should format gigabytes', async () => {
      const service = new SystemMonitorService();
      const result = service.formatBytes(16 * 1024 * 1024 * 1024);
      assert.ok(result.includes('GB'));
    });
  });
});
