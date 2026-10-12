import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CpuConfig } from './types/chip';
import { AxralSoCSimulator, assembleRiscv } from './sim/riscv64';
import { SAMPLE_PROGRAMS, SampleProgram } from './sim/samples';
import { Header } from './components/Header';
import { SchematicView } from './components/SchematicView';
import { SimulationView } from './components/SimulationView';
import { WaveformView } from './components/WaveformView';
import { UartTerminal } from './components/UartTerminal';
import { FloorplanView } from './components/FloorplanView';
import { RtlCodeView } from './components/RtlCodeView';
import { MilestoneTracker } from './components/MilestoneTracker';
import { BeginnerGuideModal } from './components/BeginnerGuideModal';
import { DrcModal } from './components/DrcModal';

export function App() {
  // Current view tab
  const [activeTab, setActiveTab] = useState<string>('schematic');

  // Architecture Configuration State
  const [config, setConfig] = useState<CpuConfig>({
    name: 'Axral 64-bit SoC',
    isa: 'RV64I',
    pipelineMode: '5-stage',
    enableForwarding: true,
    branchPredictor: '1bit_bimodal',
    ramSizeBytes: 65536,
    uartBaudRate: 115200,
    hasClintTimer: true,
    hasGpio: true,
    busType: 'Wishbone-B4',
    targetNode: 'sky130',
  });

  // Modals state
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDrcOpen, setIsDrcOpen] = useState(false);

  // Simulation execution state
  const [assemblyCode, setAssemblyCode] = useState<string>(SAMPLE_PROGRAMS[0].assembly);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runSpeedMs, setRunSpeedMs] = useState<number>(50);

  // Instantiated simulator
  const simRef = useRef<AxralSoCSimulator>(new AxralSoCSimulator(config));

  // Assemble source code
  const { instructions, errors: assembleErrors } = useMemo(() => {
    return assembleRiscv(assemblyCode);
  }, [assemblyCode]);

  // Reactive state synced from simulator
  const [pc, setPc] = useState<bigint>(0n);
  const [cycleCount, setCycleCount] = useState<number>(0);
  const [instructionsRetired, setInstructionsRetired] = useState<number>(0);
  const [isHalted, setIsHalted] = useState<boolean>(false);
  const [haltReason, setHaltReason] = useState<string>('');
  const [registers, setRegisters] = useState(simRef.current.getRegisters());
  const [stages, setStages] = useState(simRef.current.stages);
  const [currentBusTx, setCurrentBusTx] = useState(simRef.current.currentBusTx);
  const [waveforms, setWaveforms] = useState(simRef.current.waveforms);
  const [uartOutput, setUartOutput] = useState<string>('');

  // Sync state from sim instance
  const syncFromSim = useCallback(() => {
    const sim = simRef.current;
    setPc(sim.pc);
    setCycleCount(sim.cycleCount);
    setInstructionsRetired(sim.instructionsRetired);
    setIsHalted(sim.isHalted);
    setHaltReason(sim.haltReason);
    setRegisters([...sim.getRegisters()]);
    setStages([...sim.stages]);
    setCurrentBusTx({ ...sim.currentBusTx });
    setWaveforms([...sim.waveforms]);
    setUartOutput(sim.uartTxBuffer);
  }, []);

  // Reload program into simulator when instructions change or config changes
  useEffect(() => {
    simRef.current.config = config;
    simRef.current.initStages();
    simRef.current.loadProgram(instructions);
    syncFromSim();
  }, [instructions, config, syncFromSim]);

  // Step 1 cycle
  const handleStep = useCallback(() => {
    if (simRef.current.isHalted) return;
    simRef.current.stepCycle();
    syncFromSim();
  }, [syncFromSim]);

  // Step 10 cycles
  const handleStep10 = useCallback(() => {
    for (let i = 0; i < 10; i++) {
      if (simRef.current.isHalted) break;
      simRef.current.stepCycle();
    }
    syncFromSim();
  }, [syncFromSim]);

  // Reset simulation
  const handleReset = useCallback(() => {
    setIsRunning(false);
    simRef.current.loadProgram(instructions);
    syncFromSim();
  }, [instructions, syncFromSim]);

  // Toggle Run
  const handleToggleRun = () => {
    if (isHalted) {
      handleReset();
    }
    setIsRunning((prev) => !prev);
  };

  // Continuous run timer
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (simRef.current.isHalted) {
        setIsRunning(false);
        syncFromSim();
        return;
      }
      simRef.current.stepCycle();
      syncFromSim();
    }, runSpeedMs);

    return () => clearInterval(interval);
  }, [isRunning, runSpeedMs, syncFromSim]);

  // Update Config
  const handleUpdateConfig = (newConfig: Partial<CpuConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  // Load sample program
  const handleLoadSample = (sample: SampleProgram) => {
    setIsRunning(false);
    setAssemblyCode(sample.assembly);
  };

  // Run M3 Hello World program
  const handleRunM3Sample = () => {
    handleLoadSample(SAMPLE_PROGRAMS[0]);
    setIsRunning(true);
    setActiveTab('terminal');
  };

  // Clear UART buffer
  const handleClearUart = () => {
    simRef.current.uartTxBuffer = '';
    simRef.current.uartTxFifo = [];
    setUartOutput('');
  };

  // Calculate DRC warning count
  const drcWarningCount =
    (config.pipelineMode === '5-stage' && !config.enableForwarding ? 1 : 0) +
    (config.targetNode === 'asap7' ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Universal Top Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRunning={isRunning}
        onToggleRun={handleToggleRun}
        onStep={handleStep}
        onReset={handleReset}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenDrc={() => setIsDrcOpen(true)}
        drcWarningCount={drcWarningCount}
      />

      {/* Main View Area */}
      <main className="flex-1 p-6 flex flex-col max-w-[1720px] w-full mx-auto">
        {activeTab === 'schematic' && (
          <SchematicView
            config={config}
            onUpdateConfig={handleUpdateConfig}
            currentBusTx={currentBusTx}
            pc={pc}
            cycleCount={cycleCount}
          />
        )}

        {activeTab === 'simulation' && (
          <SimulationView
            assemblyCode={assemblyCode}
            onChangeAssembly={setAssemblyCode}
            onLoadSample={handleLoadSample}
            instructions={instructions}
            assembleErrors={assembleErrors}
            registers={registers}
            stages={stages}
            pc={pc}
            cycleCount={cycleCount}
            instructionsRetired={instructionsRetired}
            isHalted={isHalted}
            haltReason={haltReason}
            isRunning={isRunning}
            onToggleRun={handleToggleRun}
            onStep={handleStep}
            onStep10={handleStep10}
            onReset={handleReset}
            runSpeedMs={runSpeedMs}
            onChangeSpeed={setRunSpeedMs}
          />
        )}

        {activeTab === 'waveform' && (
          <WaveformView waveforms={waveforms} currentCycle={cycleCount} />
        )}

        {activeTab === 'terminal' && (
          <UartTerminal
            outputBuffer={uartOutput}
            onClearBuffer={handleClearUart}
            onRunM3Sample={handleRunM3Sample}
            cycleCount={cycleCount}
          />
        )}

        {activeTab === 'floorplan' && (
          <FloorplanView config={config} onUpdateConfig={handleUpdateConfig} />
        )}

        {activeTab === 'rtl' && <RtlCodeView config={config} />}

        {activeTab === 'milestones' && (
          <MilestoneTracker
            config={config}
            cycleCount={cycleCount}
            instructionsRetired={instructionsRetired}
            hasWaveforms={waveforms.length > 0}
            uartOutput={uartOutput}
            onRunM3Test={handleRunM3Sample}
            onOpenWaveform={() => setActiveTab('waveform')}
            onOpenFloorplan={() => setActiveTab('floorplan')}
          />
        )}
      </main>

      {/* Modals */}
      <BeginnerGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <DrcModal
        isOpen={isDrcOpen}
        onClose={() => setIsDrcOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
      />
    </div>
  );
}
