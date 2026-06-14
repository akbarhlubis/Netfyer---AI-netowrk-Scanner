/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Activity, 
  Shield, 
  Search, 
  AlertTriangle, 
  RefreshCw, 
  Server, 
  Cpu, 
  Database,
  Terminal,
  ChevronRight,
  Stethoscope,
  Info,
  Globe,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { ScanResult, AIDiagnosis, Device } from './types';
import { diagnoseNetwork } from './services/aiService';

/**
 * Topology Tracker Hook
 * Finds coordinates of nodes in the DOM to draw connection lines.
 */
function useTopologyLinks(scanResult: ScanResult | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<{ id: string; d: string }[]>([]);

  const updateLinks = useCallback(() => {
    if (!containerRef.current || !scanResult) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLinks: { id: string; d: string }[] = [];

    scanResult.devices.forEach(device => {
      if (!device.parentId) return;

      const childEl = containerRef.current?.querySelector(`[data-node-id="${device.id}"]`);
      const parentEl = containerRef.current?.querySelector(`[data-node-id="${device.parentId}"]`);

      if (childEl && parentEl) {
        const childRect = childEl.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();

        const x1 = (parentRect.left + parentRect.right) / 2 - containerRect.left;
        const y1 = parentRect.bottom - containerRect.top;
        const x2 = (childRect.left + childRect.right) / 2 - containerRect.left;
        const y2 = childRect.top - containerRect.top;

        // Bezier curve for organic look
        const midY = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
        
        newLinks.push({ id: `${device.parentId}-${device.id}`, d });
      }
    });

    setLinks(newLinks);
  }, [scanResult]);

  useEffect(() => {
    const timer = setTimeout(updateLinks, 1000); // Wait for nodes to mount/animate
    window.addEventListener('resize', updateLinks);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateLinks);
    };
  }, [updateLinks, scanResult]);

  return { containerRef, links, updateLinks };
}

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [diagnosis, setDiagnosis] = useState<AIDiagnosis | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scanRange, setScanRange] = useState('10.20.1.0-10.20.5.0');
  
  // New States
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'deepseek' | 'custom'>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Clear results when mode changes
  useEffect(() => {
    setScanResult(null);
    setDiagnosis(null);
    setSelectedDeviceId(null);
  }, [isDemoMode]);

  const { containerRef, links } = useTopologyLinks(scanResult);

  const selectedDevice = useMemo(() => 
    scanResult?.devices.find(d => d.id === selectedDeviceId),
  [scanResult, selectedDeviceId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    setDiagnosis(null);
    setScanProgress(0);

    // Simulate longer scan for ranges
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.floor(Math.random() * 8); // Slower for range
      });
    }, 300);

    try {
      let data: ScanResult;
      
      if (isDemoMode) {
        // Precanned Demo Data
        data = {
          timestamp: new Date().toISOString(),
          network: `DEMO-NET-${scanRange}`,
          scanDepth: 'Presimulated Discovery',
          devices: [
            { id: 'd1', ip: '10.20.1.1', mac: '00:1A:2B:3C:4D:5F', type: 'Gateway', status: 'online', name: 'DEMO-GW-01' },
            { id: 'ds1', ip: '10.20.1.2', mac: '00:1A:2B:3C:D1:01', type: 'Switch', status: 'online', name: 'DEMO-SW-01', parentId: 'd1' },
            { id: 'd2', ip: '10.20.1.45', mac: 'AA:BB:CC:DD:EE:FF', type: 'Server', status: 'online', name: 'DEMO-PACS-01', parentId: 'ds1' },
            { id: 'd3', ip: '10.20.2.12', mac: 'CC:BB:AA:11:22:33', type: 'IoT', status: 'warning', name: 'DEMO-ECG-04', parentId: 'ds1' }
          ],
          anomalies: [
            { type: 'ROGUE_DHCP', description: 'Simulated Rogue DHCP detected for training purposes.', sourceIp: '10.20.1.200' }
          ]
        };
      } else {
        const response = await fetch(`/api/scan?range=${encodeURIComponent(scanRange)}`);
        data = await response.json();
      }
      
      // Delay for dramatic effect/simulation
      setTimeout(() => {
        setScanResult(data);
        setIsScanning(false);
        runDiagnosis(data);
      }, 3000);
    } catch (error) {
      console.error("Scan failed", error);
      setIsScanning(false);
    }
  };

  const runDiagnosis = async (data: ScanResult) => {
    setIsDiagnosing(true);
    try {
      const report = await diagnoseNetwork({
        scanData: data,
        provider: selectedProvider,
        apiKey: customKey,
        model: selectedModel,
        apiUrl: customApiUrl,
      });
      setDiagnosis(report);
    } catch (error: any) {
      console.error("Diagnosis failed", error);
      setDiagnosis({
        severity: "Critical",
        rootCause: `AI Connection/Authentication Interrupted: ${error.message || error}`,
        impact: "Operational diagnostic visualizers are temporarily offline.",
        remediationCommands: [
          "Ensure your custom API key & endpoint configurations are correct inside the Settings Panel",
          selectedProvider === 'gemini' 
            ? "Confirm process.env.GEMINI_API_KEY is configured correctly on the container host" 
            : `Verify endpoint access to: ${customApiUrl || 'https://api.deepseek.com'}`
        ],
        summary: "AI SECURE HANDSHAKE FAILURE"
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-hospital-accent/20 bg-hospital-blue/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-hospital-accent flex items-center justify-center rounded-lg shadow-[0_0_15px_rgba(100,255,218,0.4)]">
              <Shield className="text-hospital-blue w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter text-hospital-accent">NETFYER <span className="text-xs font-mono opacity-50 ml-2">v2.4.0</span></h1>
              <p className="text-[10px] uppercase tracking-widest opacity-60">Autonomous Hospital IT Sentience</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end border-r border-hospital-accent/10 pr-6">
              <span className="text-[10px] text-hospital-accent uppercase font-mono tracking-tighter">Scan Range Scope</span>
              <input 
                type="text" 
                value={scanRange}
                onChange={(e) => setScanRange(e.target.value)}
                placeholder="e.g. 192.168.1.0-12.0"
                className="bg-black/40 border border-hospital-accent/20 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-hospital-accent transition-colors w-44"
              />
            </div>
            <div className="hidden md:flex flex-col items-end border-r border-hospital-accent/10 pr-6">
              <span className="text-[10px] text-hospital-accent uppercase font-mono tracking-tighter">Real-Time Sync</span>
              <span className="text-sm font-mono font-bold">{currentTime.toLocaleTimeString([], { hour12: false })}</span>
            </div>
            
            <div className="hidden md:flex flex-col items-end border-r border-hospital-accent/10 pr-6">
              <span className="text-[10px] text-hospital-accent uppercase font-mono tracking-tighter">Operation Mode</span>
              <div className="flex bg-black/40 rounded p-1 gap-1">
                <button 
                  onClick={() => setIsDemoMode(true)}
                  className={`px-2 py-0.5 text-[8px] font-bold rounded transition-colors ${isDemoMode ? 'bg-hospital-accent text-hospital-blue' : 'text-white/40'}`}
                >
                  DEMO
                </button>
                <button 
                  onClick={() => setIsDemoMode(false)}
                  className={`px-2 py-0.5 text-[8px] font-bold rounded transition-colors ${!isDemoMode ? 'bg-hospital-accent text-hospital-blue' : 'text-white/40'}`}
                >
                  LIVE
                </button>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 border border-hospital-accent/20 rounded-lg hover:bg-hospital-accent/10 transition-colors"
              title="AI Settings"
            >
              <Cpu className="w-4 h-4 text-hospital-accent" />
            </button>
            <div className="hidden lg:flex flex-col items-center border-r border-hospital-accent/10 pr-6 relative group/origin">
              <span className="text-[10px] text-hospital-accent uppercase font-mono tracking-tighter">Origin</span>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded animate-in fade-in zoom-in duration-300 ${isDemoMode ? 'bg-hospital-warning/20 text-hospital-warning border border-hospital-warning/30' : 'bg-hospital-accent/20 text-hospital-accent border border-hospital-accent/30'}`}>
                  {isDemoMode ? '模拟 SIMULATION' : '实时 LIVE PROBE'}
                </span>
                <Info className="w-3 h-3 opacity-30 cursor-help" />
              </div>
              
              {/* Tooltip */}
              <div className="absolute top-full mt-2 right-0 w-64 p-3 bg-hospital-blue border border-hospital-accent/30 rounded-xl opacity-0 group-hover/origin:opacity-100 transition-opacity pointer-events-none z-[60] shadow-2xl">
                <p className="text-[10px] leading-relaxed">
                  {isDemoMode 
                    ? "Local Browser Sandbox: Running pre-loaded scenarios without backend interaction. Perfect for offline testing." 
                    : "Cloud Runtime Probe: Communicating with the live Node.js backend to scan the actual cloud container network."}
                </p>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-hospital-accent uppercase font-mono">System Load</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`w-3 h-1 ${i < 4 ? 'bg-hospital-accent' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>
            <button 
              onClick={startScan}
              disabled={isScanning}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all ${
                isScanning 
                ? 'bg-white/5 text-white/40 cursor-not-allowed' 
                : 'bg-hospital-accent text-hospital-blue hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(100,255,218,0.2)]'
              }`}
            >
              {isScanning ? <RefreshCw className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
              {isScanning ? 'SCANNING...' : 'START DIAGNOSIS'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Network Map & Status */}
        <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6">
          
          {/* Status Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusCard icon={<Activity className="w-4 h-4" />} label="Network State" value="Operational" color="text-hospital-accent" />
            <StatusCard icon={<Server className="w-4 h-4" />} label="Devices Found" value={scanResult?.devices?.length.toString() || "--"} color="text-white" />
            <StatusCard icon={<AlertTriangle className="w-4 h-4" />} label="Anomalies" value={scanResult?.anomalies?.length.toString() || "0"} color={scanResult?.anomalies?.length ? "text-hospital-critical" : "text-hospital-accent"} />
            <StatusCard 
              icon={<Database className="w-4 h-4" />} 
              label={isDemoMode ? "Simulation" : "Cloud Probe"} 
              value={scanResult?.meta?.probeId.slice(0, 8) || (isDemoMode ? "HOSP-DEMO-01" : "CONNECTING...")} 
              color="text-white/60" 
            />
          </div>

          {/* Network Visualization Stage */}
          <div 
            ref={containerRef}
            className="relative border border-hospital-accent/20 bg-black/40 rounded-2xl overflow-hidden min-h-[500px] flex items-center justify-center"
          >
            {isScanning && (
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="scan-line" 
              />
            )}

            {!scanResult && !isScanning && (
              <div className="text-center px-12 group">
                <div className="w-20 h-20 border-2 border-hospital-accent/20 rounded-full mx-auto mb-6 flex items-center justify-center group-hover:border-hospital-accent transition-colors duration-500">
                  <Stethoscope className="w-10 h-10 text-hospital-accent/40 group-hover:text-hospital-accent transition-colors duration-500" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-2">
                  {isDemoMode ? 'Diagnostic Scan Required' : 'Remote Probe Ready'}
                </h3>
                <p className="text-white/60 max-w-sm mx-auto">
                  {isDemoMode 
                    ? 'Upload a real scan log or use the demo command to simulate hospital intranet vulnerabilities.'
                    : 'Backend Cloud Probe is connected. Start diagnosis to perform a live scan of the virtual hospital environment.'
                  }
                </p>
              </div>
            )}

            {isScanning && (
              <div className="flex flex-col items-center gap-6">
                <div className="relative w-48 h-48">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-2 border-dashed border-hospital-accent/30 rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-4xl font-mono font-bold text-hospital-accent">{scanProgress}%</span>
                    <span className="text-[10px] uppercase font-bold tracking-tighter opacity-70">Detecting Nodes</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="animate-pulse w-2 h-2 rounded-full bg-hospital-accent" />
                  <span className="animate-pulse w-2 h-2 rounded-full bg-hospital-accent delay-75" />
                  <span className="animate-pulse w-2 h-2 rounded-full bg-hospital-accent delay-150" />
                </div>
              </div>
            )}

            {scanResult && !isScanning && (
              <div className="w-full h-full p-8 relative flex flex-col gap-12 overflow-y-auto">
                {/* SVG Link Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                    <linearGradient id="linkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-hospital-accent)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--color-hospital-accent)" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  {links.map(link => {
                    const isRelated = selectedDeviceId && link.id.includes(selectedDeviceId);
                    return (
                      <motion.path
                        key={link.id}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ 
                          pathLength: 1, 
                          opacity: isRelated ? 0.8 : 0.3,
                          strokeWidth: isRelated ? 3 : 2
                        }}
                        transition={{ duration: isRelated ? 0.3 : 2, delay: isRelated ? 0 : 1 }}
                        d={link.d}
                        stroke={isRelated ? "var(--color-hospital-accent)" : "url(#linkGradient)"}
                        strokeWidth={isRelated ? "3" : "2"}
                        fill="none"
                        strokeDasharray={isRelated ? "0" : "4 4"}
                        className="transition-all duration-300"
                      />
                    );
                  })}
                </svg>

                {/* Layered Topology */}
                <div className="space-y-16">
                  {/* Layer 0: Core/Gateway */}
                  <div className="flex justify-center z-10">
                    {scanResult.devices.filter(d => d.type === 'Gateway').map(d => (
                      <DeviceNode 
                        key={d.id} 
                        device={d} 
                        delay={0} 
                        isSelected={selectedDeviceId === d.id}
                        onClick={() => setSelectedDeviceId(d.id === selectedDeviceId ? null : d.id)}
                      />
                    ))}
                  </div>

                  {/* Layer 1: Distribution/Switches */}
                  <div className="flex justify-center gap-12 z-10">
                    {scanResult.devices.filter(d => d.type === 'Switch').map((d, i) => (
                      <DeviceNode 
                        key={d.id} 
                        device={d} 
                        delay={0.2 + (i * 0.1)} 
                        isSelected={selectedDeviceId === d.id}
                        onClick={() => setSelectedDeviceId(d.id === selectedDeviceId ? null : d.id)}
                      />
                    ))}
                  </div>

                  {/* Layer 2: Endpoints */}
                  <div className="flex justify-center flex-wrap gap-8 z-10">
                    {scanResult.devices.filter(d => !['Gateway', 'Switch'].includes(d.type)).map((d, i) => (
                      <DeviceNode 
                        key={d.id} 
                        device={d} 
                        delay={0.4 + (i * 0.05)} 
                        isSelected={selectedDeviceId === d.id}
                        onClick={() => setSelectedDeviceId(d.id === selectedDeviceId ? null : d.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Device Inspector Overlay */}
                <AnimatePresence>
                  {selectedDevice && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="absolute bottom-4 left-4 bg-hospital-blue/90 border border-hospital-accent/30 p-4 rounded-xl backdrop-blur-md z-40 w-64 shadow-2xl"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-hospital-accent text-sm uppercase tracking-wider">Device Inspector</h3>
                        <button onClick={() => setSelectedDeviceId(null)} className="text-white/40 hover:text-white"><Activity className="w-3 h-3" /></button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[9px] uppercase opacity-40 font-bold">Information</p>
                          <p className="text-sm font-bold truncate">{selectedDevice.name}</p>
                          <p className="text-[10px] font-mono opacity-60 italic">{selectedDevice.type}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] uppercase opacity-40 font-bold">IP Address</p>
                            <p className="text-[10px] font-mono">{selectedDevice.ip}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase opacity-40 font-bold">MAC Address</p>
                            <p className="text-[10px] font-mono">{selectedDevice.mac}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase opacity-40 font-bold">Connectivity</span>
                            <span className={`text-[9px] font-bold ${selectedDevice.status === 'online' ? 'text-hospital-accent' : 'text-hospital-critical'}`}>
                              {selectedDevice.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="w-full bg-white/5 h-1 mt-1 rounded-full overflow-hidden">
                            <div className={`h-full ${selectedDevice.status === 'online' ? 'bg-hospital-accent' : 'bg-hospital-critical'} w-full`} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Floating Anomalies Layer */}
                <div className="absolute top-4 right-4 flex flex-col gap-3 w-64 pointer-events-none">
                  <AnimatePresence>
                    {scanResult.anomalies.map((anomaly, idx) => (
                      <AnomalyNode key={idx} anomaly={anomaly} delay={idx * 0.2} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
          
          {/* Detailed Log (Technical Visible Grid) */}
          {scanResult && (
            <div className="border border-hospital-accent/10 rounded-xl overflow-hidden bg-hospital-blue/40">
              <div className="bg-hospital-accent/5 px-4 py-2 border-b border-hospital-accent/10 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-hospital-accent">Raw Scan Protocol Log</span>
                <span className="text-[10px] font-mono text-white/40">{scanResult.timestamp}</span>
              </div>
              <div className="font-mono text-[11px] p-4 max-h-48 overflow-y-auto space-y-1">
                <div className="text-hospital-accent/60">[{new Date().toLocaleTimeString()}] INITIALIZING LAYER 2 DISCOVERY...</div>
                <div className="text-hospital-accent/60">[{new Date().toLocaleTimeString()}] BROADCASTING ARP REQUESTS ON 10.20.1.0/24</div>
                {scanResult.devices.map(d => (
                  <div key={d.id}>[{new Date().toLocaleTimeString()}] FOUND {d.type.toUpperCase()}: {d.name} @ {d.ip}</div>
                ))}
                {scanResult.anomalies.map((a, i) => (
                  <div key={i} className="text-hospital-critical font-bold">[{new Date().toLocaleTimeString()}] CRITICAL: ALERT_{a.type} DETECTED - {a.description}</div>
                ))}
                <div className="animate-pulse italic opacity-40">System awaiting command...</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Diagnosis */}
        <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-6">
          <div className="border border-hospital-accent/20 bg-hospital-blue p-6 rounded-2xl flex flex-col h-full shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-hospital-accent" />
                <h2 className="text-lg font-bold tracking-tight">AI Diagnostic Unit</h2>
              </div>
              {isDiagnosing && <span className="flex h-2 w-2 rounded-full bg-hospital-accent animate-ping" />}
            </div>

            <div className="flex-1 overflow-y-auto">
              {!diagnosis && !isDiagnosing && (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-40">
                  <Activity className="w-12 h-12 mb-4" />
                  <p className="text-sm">Initiate a network scan to activate Gemini Analysis.</p>
                </div>
              )}

              {isDiagnosing && (
                <div className="space-y-6">
                  <div className="h-4 bg-hospital-accent/10 rounded animate-pulse w-3/4" />
                  <div className="h-20 bg-hospital-accent/5 rounded animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-3 bg-hospital-accent/10 rounded animate-pulse w-full" />
                    <div className="h-3 bg-hospital-accent/10 rounded animate-pulse w-5/6" />
                    <div className="h-3 bg-hospital-accent/10 rounded animate-pulse w-4/6" />
                  </div>
                  <p className="text-xs text-hospital-accent animate-pulse font-mono flex items-center gap-2">
                    <Terminal className="w-3 h-3" /> Processing deep packets via Gemini-3-Flash...
                  </p>
                </div>
              )}

              {diagnosis && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 pb-4"
                >
                  <div className={`p-4 rounded-xl border ${
                    diagnosis.severity === 'Critical' ? 'border-hospital-critical bg-hospital-critical/10 text-hospital-critical' :
                    diagnosis.severity === 'High' ? 'border-hospital-warning bg-hospital-warning/10 text-hospital-warning' :
                    'border-hospital-accent/40 bg-hospital-accent/5 text-hospital-accent'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Severity: {diagnosis.severity}</span>
                    </div>
                    <p className="text-sm font-bold">{diagnosis.summary}</p>
                  </div>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-hospital-accent rounded-full" /> Root Cause Analysis
                    </h3>
                    <p className="text-sm text-white/80 leading-relaxed border-l border-hospital-accent/20 pl-4">
                      {diagnosis.rootCause}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-hospital-accent rounded-full" /> Infrastructure Impact
                    </h3>
                    <p className="text-sm text-white/80 leading-relaxed italic opacity-80 pl-4 border-l border-hospital-accent/20">
                      {diagnosis.impact}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-hospital-accent rounded-full" /> Terminal Remediation
                    </h3>
                    <div className="bg-black/60 rounded-lg p-3 font-mono text-[10px] text-hospital-accent/90 border border-white/5 space-y-1">
                      {diagnosis.remediationCommands.map((cmd, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="opacity-30">#</span>
                          <span>{cmd}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}
            </div>
            
            {diagnosis && (
              <button 
                onClick={() => setDiagnosis(null)}
                className="mt-6 w-full py-3 text-[10px] font-bold uppercase tracking-widest border border-hospital-accent/20 rounded-lg hover:bg-hospital-accent/10 transition-colors"
              >
                Clear Diagnosis Session
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info Rail */}
      <footer className="border-t border-hospital-accent/10 bg-black/40 py-3 px-6 overflow-hidden whitespace-nowrap">
        <div className="flex gap-12 animate-marquee items-center text-[9px] uppercase tracking-[0.3em] font-mono opacity-40">
          <span className="flex items-center gap-2 font-bold text-hospital-accent"><div className="w-1 h-1 bg-hospital-accent rounded-full" /> PACKET INSPECTION ACTIVE</span>
          <span>LATENCY: {isDemoMode ? '0ms' : '12ms'}</span>
          <span>LOCATION: {scanResult?.meta?.probeRegion.toUpperCase() || 'HOSPITAL_DC_01'}</span>
          <span>PROBE_ID: {scanResult?.meta?.probeId.slice(0, 12) || 'SIM-PROBE-01'}</span>
          <span>UPLINK: 10Gbps SYMMETRIC</span>
          <span>ENCRYPTION: AES-256-GCM</span>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-hospital-blue border border-hospital-accent/30 p-8 rounded-2xl max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6 border-b border-hospital-accent/10 pb-4">
                <div className="flex items-center gap-3">
                  <Cpu className="text-hospital-accent" />
                  <h2 className="text-lg font-bold">AI Deployment Hub</h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="text-white/40 hover:text-white font-bold text-xs"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-5">
                {/* AI Provider selector */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2">INTELLIGENCE PROVIDER</label>
                  <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg border border-hospital-accent/10">
                    {(['gemini', 'deepseek', 'custom'] as const).map(provider => (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => {
                          setSelectedProvider(provider);
                          if (provider === 'gemini') {
                            setSelectedModel('gemini-3.5-flash');
                            setCustomApiUrl('');
                          } else if (provider === 'deepseek') {
                            setSelectedModel('deepseek-chat');
                            setCustomApiUrl('https://api.deepseek.com');
                          } else {
                            setSelectedModel('gpt-4o-mini');
                            setCustomApiUrl('https://api.openai.com/v1');
                          }
                        }}
                        className={`py-1 text-[8px] font-bold rounded uppercase tracking-wider transition-all cursor-pointer ${
                          selectedProvider === provider 
                            ? 'bg-hospital-accent text-hospital-blue shadow-md font-extrabold' 
                            : 'text-white/40 hover:text-white/80'
                        }`}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom API Key input */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center justify-between">
                    <span>
                      {selectedProvider === 'gemini' && 'CUSTOM GEMINI API KEY'}
                      {selectedProvider === 'deepseek' && 'CUSTOM DEEPSEEK API KEY'}
                      {selectedProvider === 'custom' && 'BEARER AUTH TOKEN'}
                    </span>
                    <span className="text-[8px] font-bold text-hospital-accent opacity-60">OPTIONAL</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder={
                        selectedProvider === 'gemini' 
                          ? "Enter key to override system default"
                          : selectedProvider === 'deepseek'
                          ? "Enter deepseek authorization key"
                          : "Enter Bearer authentication token"
                      }
                      className="w-full bg-black/40 border border-hospital-accent/20 rounded-lg pl-9 pr-4 py-2.5 text-[11px] font-mono focus:border-hospital-accent focus:outline-none transition-all text-white"
                    />
                    <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-white/30" />
                  </div>
                </div>

                {/* API URL (for deepseek/custom) */}
                {selectedProvider !== 'gemini' && (
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2">TARGET BASE URL</label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={customApiUrl}
                        onChange={(e) => setCustomApiUrl(e.target.value)}
                        placeholder="e.g. https://api.openai.com/v1"
                        className="w-full bg-black/40 border border-hospital-accent/20 rounded-lg pl-9 pr-4 py-2.5 text-[11px] font-mono focus:border-hospital-accent focus:outline-none transition-all text-white"
                      />
                      <Globe className="w-3.5 h-3.5 absolute left-3 top-3 text-white/30" />
                    </div>
                  </div>
                )}

                {/* Target Neural Model Name */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2">NEURAL REASONING MODEL</label>
                  {selectedProvider === 'gemini' ? (
                    <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full bg-black/40 border border-hospital-accent/20 rounded-lg px-3 py-2.5 text-[11px] focus:border-hospital-accent focus:outline-none appearance-none cursor-pointer text-white"
                    >
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Balanced, Fast)</option>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Expert Diagnosis)</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultralight)</option>
                    </select>
                  ) : selectedProvider === 'deepseek' ? (
                    <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full bg-black/40 border border-hospital-accent/20 rounded-lg px-3 py-2.5 text-[11px] focus:border-hospital-accent focus:outline-none appearance-none cursor-pointer text-white"
                    >
                      <option value="deepseek-chat">deepseek-chat (DeepSeek V3 / R1 API)</option>
                      <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek R1 Deep)</option>
                    </select>
                  ) : (
                    <input 
                      type="text"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      placeholder="e.g. gpt-4o-mini, llama3"
                      className="w-full bg-black/40 border border-hospital-accent/20 rounded-lg px-3 py-2.5 text-[11px] font-mono focus:border-hospital-accent focus:outline-none text-white"
                    />
                  )}
                </div>

                <div className="pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="w-full bg-hospital-accent text-hospital-blue py-3 rounded-xl text-xs font-bold hover:scale-[1.01] active:scale-95 transition-all text-center tracking-wider uppercase cursor-pointer"
                  >
                    SAVE CONFIGURATION
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-hospital-blue/40 border border-hospital-accent/10 p-4 rounded-xl flex flex-col gap-1 shadow-inner">
      <div className="flex items-center gap-2 opacity-40">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-xl font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function DeviceNode({ device, delay, isSelected, onClick }: { device: Device, delay: number, isSelected?: boolean, onClick?: () => void }) {
  const Icon = device.type === 'Gateway' ? Shield : 
               device.type === 'Switch' ? Cpu : 
               device.type === 'Server' ? Server : 
               device.type === 'IoT' ? Activity : Database;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ 
        opacity: 1, 
        scale: isSelected ? 1.05 : 1, 
        y: 0,
        borderColor: isSelected ? 'var(--color-hospital-accent)' : 'inherit'
      }}
      transition={{ delay }}
      onClick={onClick}
      data-node-id={device.id}
      className={`p-4 border bg-white/5 rounded-xl hover:bg-hospital-accent/10 transition-all cursor-pointer group min-w-[140px] relative ${
        isSelected ? 'border-hospital-accent ring-1 ring-hospital-accent/20 shadow-[0_0_15px_rgba(100,255,218,0.2)]' :
        device.type === 'Gateway' ? 'border-hospital-accent/40 bg-hospital-accent/5' : 
        device.type === 'Switch' ? 'border-hospital-accent/20' : 'border-hospital-accent/10'
      }`}
    >
      {isSelected && (
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-hospital-accent rounded-full border-2 border-hospital-blue" />
      )}
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-5 h-5 ${device.status === 'online' ? 'text-hospital-accent' : 'text-white/20'}`} />
        <span className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-hospital-accent animate-pulse shadow-[0_0_8px_var(--color-hospital-accent)]' : 'bg-white/20'}`} />
      </div>
      <div className="space-y-0.5">
        <h4 className="text-xs font-bold truncate group-hover:text-hospital-accent transition-colors">{device.name}</h4>
        <p className="text-[10px] font-mono opacity-50">{device.ip}</p>
        <div className="flex justify-between items-center mt-1">
          <p className="text-[8px] font-mono opacity-30 uppercase">{device.type}</p>
          {device.status === 'offline' && <span className="text-[8px] text-hospital-critical font-bold">OFFLINE</span>}
        </div>
      </div>
    </motion.div>
  );
}

function AnomalyNode({ anomaly, delay }: { anomaly: any, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        delay,
        type: "spring",
        stiffness: 260,
        damping: 20 
      }}
      className="p-4 border border-hospital-critical/40 bg-hospital-critical/5 rounded-xl border-dashed relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 py-1 px-2 bg-hospital-critical text-[8px] font-bold uppercase animate-pulse">ALERT</div>
      <AlertTriangle className="w-6 h-6 text-hospital-critical mb-3" />
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-hospital-critical">{anomaly.type.replace('_', ' ')}</h4>
        <p className="text-[9px] opacity-70 leading-tight">{anomaly.description}</p>
        {anomaly.sourceIp && <p className="text-[9px] font-mono text-hospital-critical/70 mt-1">Source: {anomaly.sourceIp}</p>}
      </div>
    </motion.div>
  );
}

