// Types for Axral 64-bit RISC-V SoC Studio

export type PipelineMode = 'single' | '3-stage' | '5-stage';

export interface CpuConfig {
  name: string;
  isa: 'RV64I' | 'RV64IM' | 'RV64IMAC';
  pipelineMode: PipelineMode;
  enableForwarding: boolean;
  branchPredictor: 'always_not_taken' | 'always_taken' | '1bit_bimodal';
  ramSizeBytes: number; // e.g. 64KB (65536)
  uartBaudRate: number; // e.g. 115200
  hasClintTimer: boolean;
  hasGpio: boolean;
  busType: 'Wishbone-B4' | 'AXI4-Lite';
  targetNode: 'sky130' | 'asap7';
}

export interface RegisterState {
  index: number;
  name: string;
  abi: string;
  value: bigint;
  description: string;
}

export interface PipelineStageInfo {
  name: string;
  active: boolean;
  pc: bigint;
  instrRaw: number;
  instrDisasm: string;
  hazardStatus: 'normal' | 'stalled' | 'forwarded' | 'flushed';
  details: string;
}

export interface WishboneTransaction {
  cycle: number;
  cyc: boolean;
  stb: boolean;
  we: boolean;
  adr: bigint;
  dat_w: bigint;
  dat_r: bigint;
  ack: boolean;
  target: 'RAM' | 'UART' | 'CLINT' | 'GPIO' | 'NONE';
}

export interface WaveformSample {
  cycle: number;
  clk: 0 | 1;
  rst_n: 0 | 1;
  pc: bigint;
  instr: number;
  alu_res: bigint;
  reg_we: boolean;
  dmem_we: boolean;
  wb_cyc: boolean;
  wb_stb: boolean;
  wb_we: boolean;
  wb_adr: bigint;
  wb_dat: bigint;
  wb_ack: boolean;
  uart_tx: 0 | 1;
  hazard_stall: boolean;
  hazard_forward: boolean;
}

export interface AssembledInstruction {
  address: bigint;
  raw: number;
  asm: string;
  sourceLine: number;
  comment?: string;
}

export interface LinterWarning {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  autoFixAvailable: boolean;
  fixAction?: () => void;
}

export interface MacroBlock {
  id: string;
  name: string;
  x: number; // um or relative percentage
  y: number;
  width: number;
  height: number;
  color: string;
  type: 'core' | 'sram' | 'uart' | 'clint' | 'io' | 'power';
  description: string;
}
