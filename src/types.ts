export interface Device {
  id: string;
  ip: string;
  mac: string;
  type: 'Gateway' | 'Server' | 'Workstation' | 'IoT' | 'Printer' | 'Other' | 'Switch';
  status: 'online' | 'offline' | 'warning';
  name: string;
  parentId?: string; // ID of the upstream device (Switch/Gateway)
}

export interface Anomaly {
  type: 'ROGUE_DHCP' | 'IP_CONFLICT' | 'SUSPICIOUS_DEVICE' | 'VULNERABILITY';
  description: string;
  sourceIp?: string;
  sourceMac?: string;
  conflictingMacs?: string[];
}

export interface ScanResult {
  timestamp: string;
  network: string;
  scanDepth: string;
  devices: Device[];
  anomalies: Anomaly[];
  meta?: {
    probeId: string;
    probeRegion: string;
    probeUptime: string;
  };
}

export interface AIDiagnosis {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  rootCause: string;
  impact: string;
  remediationCommands: string[];
  summary: string;
}
