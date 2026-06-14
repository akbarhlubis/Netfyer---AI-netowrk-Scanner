import { Device, ScanResult, Anomaly } from '../../src/types';

export class ScanService {
  public static performScan(range: string): ScanResult {
    // Extract base IP components for simulation
    const rangeMatch = range.match(/^(\d+\.\d+\.\d+)\.\d+/);
    const ipBase = rangeMatch ? rangeMatch[1] : '10.20.1';
    const prefixParts = ipBase.split('.');
    const networkPrefix = prefixParts.slice(0, 2).join('.'); // e.g., 10.20
    
    // Determine scenario
    const scenarios = ['CLEAN', 'ROGUE_DHCP', 'IP_CONFLICT', 'SUSPICIOUS_DEVICE', 'OUTAGE'];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    // Cloud Runtime Info
    const cloudEnv = {
      instanceId: process.env.HOSTNAME || 'mesh-node-01',
      region: 'asia-southeast1',
      uptime: process.uptime(),
      containerImage: 'netfyer-probe:latest'
    };
    
    // Determine environment context
    const isHospital = range.toLowerCase().includes('hosp') || range.includes('10.20.');
    const environmentType = isHospital ? 'HOSPITAL' : 'CLOUD-NATIVE';

    // Simulated Infrastructure Data
    const baseDevices: (Device & { parentId?: string })[] = isHospital ? [
      { id: 'gw-1', ip: `${networkPrefix}.1.1`, mac: '00:1A:2B:3C:4D:5E', type: 'Gateway', status: 'online', name: 'CORE-SW-01' },
      { id: 'sw-1', ip: `${networkPrefix}.1.2`, mac: '00:1A:2B:3C:D1:01', type: 'Switch', status: 'online', name: 'DIST-SW-NORTH', parentId: 'gw-1' },
      { id: 'dev-1', ip: `${networkPrefix}.1.5`, mac: 'AA:BB:CC:DD:EE:01', type: 'Server', status: 'online', name: 'PACS-STORAGE-01', parentId: 'sw-1' },
      { id: 'dev-2', ip: `${networkPrefix}.1.12`, mac: 'AA:BB:CC:DD:EE:05', type: 'Workstation', status: 'offline', name: 'NURSE-STATION-A', parentId: 'sw-1' },
      { id: 'dev-3', ip: `${networkPrefix}.2.45`, mac: 'F0:E1:D2:C3:B4:A5', type: 'IoT', status: 'online', name: 'ECG-MONITOR-RM402', parentId: 'sw-1' }
    ] : [
      { id: 'gw-1', ip: `${networkPrefix}.0.1`, mac: 'DE:AD:BE:EF:00:01', type: 'Gateway', status: 'online', name: 'VPC-EDGE-ROUTER' },
      { id: 'sw-1', ip: `${networkPrefix}.0.2`, mac: 'DE:AD:BE:EF:D1:01', type: 'Switch', status: 'online', name: 'VIRTUAL-MESH-FABRIC', parentId: 'gw-1' },
      { id: 'dev-1', ip: `${networkPrefix}.0.10`, mac: '00:00:00:00:00:00', type: 'Server', status: 'online', name: cloudEnv.instanceId, parentId: 'sw-1' },
      { id: 'dev-2', ip: `${networkPrefix}.1.45`, mac: 'AA:BB:CC:DD:EE:01', type: 'Server', status: 'online', name: 'API-GATEWAY-POD', parentId: 'sw-1' },
      { id: 'dev-3', ip: `${networkPrefix}.2.122`, mac: 'F0:E1:D2:C3:B4:A5', type: 'IoT', status: 'online', name: 'INGRESS-LOADBALANCER', parentId: 'sw-1' }
    ];

    let devices = [...baseDevices];
    const anomalies: Anomaly[] = [];

    const targetDevice = devices.find(d => d.id === 'dev-1') || devices[0];
    
    switch (scenario) {
      case 'ROGUE_DHCP':
        anomalies.push({
          type: 'ROGUE_DHCP',
          description: `Unauthorized DHCP entity detected on segment ${networkPrefix}.x. Potential traffic redirection risk.`,
          sourceIp: `${networkPrefix}.1.254`,
          sourceMac: 'DE:AD:BE:EF:CA:FE'
        });
        break;
      case 'IP_CONFLICT':
        anomalies.push({
          type: 'IP_CONFLICT',
          description: `Critical IP conflict on ${targetDevice.ip} (${targetDevice.name}). Infrastructure instability detected.`,
          conflictingMacs: [targetDevice.mac, '00:B0:D0:63:C2:26']
        });
        break;
      case 'SUSPICIOUS_DEVICE':
        const intruderIp = `${networkPrefix}.4.77`;
        anomalies.push({
          type: 'SUSPICIOUS_DEVICE',
          description: 'Shadow IT endpoint detected performing horizontal network reconnaissance.',
          sourceIp: intruderIp,
          sourceMac: 'FF:EE:DD:CC:BB:AA'
        });
        devices.push({ id: 'intruder', ip: intruderIp, mac: 'FF:EE:DD:CC:BB:AA', type: 'Other', status: 'warning', name: 'SHADOW-NODE-X', parentId: 'gw-1' });
        break;
      case 'OUTAGE':
        devices = devices.map(d => d.id === 'dev-3' ? { ...d, status: 'offline' } : d);
        anomalies.push({
          type: 'VULNERABILITY',
          description: `Subnet segment for ${devices.find(d => d.id === 'dev-3')?.name || 'IoT'} is currently unreachable.`,
        });
        break;
      default:
        break;
    }

    return {
      timestamp: new Date().toISOString(),
      network: `${environmentType}-NET-${range}`,
      scanDepth: 'Universal Discovery',
      devices,
      anomalies,
      meta: {
        probeId: cloudEnv.instanceId,
        probeRegion: cloudEnv.region,
        probeUptime: `${Math.floor(cloudEnv.uptime)}s`
      }
    };
  }
}
