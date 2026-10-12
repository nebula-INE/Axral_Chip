// 64-bit RISC-V SoC Simulation Engine & Assembler (RV64I)
import { CpuConfig, RegisterState, PipelineStageInfo, WishboneTransaction, WaveformSample, AssembledInstruction } from '../types/chip';

export const ABI_NAMES: string[] = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
  's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
  'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
  's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6',
];

export const REG_DESCRIPTIONS: string[] = [
  'Hard-wired zero', 'Return address', 'Stack pointer', 'Global pointer',
  'Thread pointer', 'Temporary 0', 'Temporary 1', 'Temporary 2',
  'Saved / Frame ptr', 'Saved register 1', 'Function arg / Return 0', 'Function arg / Return 1',
  'Function arg 2', 'Function arg 3', 'Function arg 4', 'Function arg 5',
  'Function arg 6', 'Function arg 7', 'Saved register 2', 'Saved register 3',
  'Saved register 4', 'Saved register 5', 'Saved register 6', 'Saved register 7',
  'Saved register 8', 'Saved register 9', 'Saved register 10', 'Saved register 11',
  'Temporary 3', 'Temporary 4', 'Temporary 5', 'Temporary 6',
];

// 64-bit mask & sign helpers
const MASK_64 = 0xFFFFFFFFFFFFFFFFn;
const MASK_32 = 0xFFFFFFFFn;

export function toSigned64(val: bigint): bigint {
  const v = val & MASK_64;
  return (v >= 0x8000000000000000n) ? v - 0x10000000000000000n : v;
}

export function toUnsigned64(val: bigint): bigint {
  return val & MASK_64;
}

export function formatHex64(val: bigint): string {
  const hex = (val & MASK_64).toString(16).padStart(16, '0');
  return `0x${hex.slice(0, 8)}_${hex.slice(8)}`;
}

export function parseRegisterIndex(regStr: string): number {
  const clean = regStr.trim().toLowerCase().replace(',', '');
  if (clean.startsWith('x') && !isNaN(Number(clean.slice(1)))) {
    const idx = parseInt(clean.slice(1), 10);
    if (idx >= 0 && idx <= 31) return idx;
  }
  const abiIdx = ABI_NAMES.indexOf(clean);
  if (abiIdx !== -1) return abiIdx;
  if (clean === 'fp') return 8;
  return -1;
}

// Simple RV64I Assembler
export function assembleRiscv(source: string): { instructions: AssembledInstruction[]; errors: string[]; labels: Record<string, bigint> } {
  const lines = source.split('\n');
  const instructions: AssembledInstruction[] = [];
  const errors: string[] = [];
  const labels: Record<string, bigint> = {};

  let currentAddr = 0x00000000n;

  // Pass 1: Label collection
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    
    // Check if label
    const labelMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
    if (labelMatch) {
      labels[labelMatch[1]] = currentAddr;
      const rest = line.substring(labelMatch[0].length).trim();
      if (!rest || rest.startsWith('#') || rest.startsWith('//')) {
        continue;
      }
    }
    // Has instruction
    currentAddr += 4n;
  }

  // Pass 2: Encoding
  currentAddr = 0x00000000n;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const labelMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
    if (labelMatch) {
      line = line.substring(labelMatch[0].length).trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }
    }

    // Strip inline comment
    const commentIdx = line.search(/[#\/]/);
    let comment = '';
    if (commentIdx !== -1) {
      comment = line.substring(commentIdx).trim();
      line = line.substring(0, commentIdx).trim();
    }

    const tokens = line.split(/[\s,]+/).filter(t => t.length > 0);
    if (tokens.length === 0) continue;

    const op = tokens[0].toLowerCase();
    let raw = 0;

    try {
      if (op === 'nop') {
        raw = 0x00000013; // addi x0, x0, 0
      } else if (op === 'ebreak') {
        raw = 0x00100073;
      } else if (op === 'ecall') {
        raw = 0x00000073;
      } else if (op === 'lui') {
        const rd = parseRegisterIndex(tokens[1]);
        const imm = parseImm(tokens[2], labels, currentAddr);
        raw = ((imm & 0xFFFFF) << 12) | (rd << 7) | 0x37;
      } else if (op === 'auipc') {
        const rd = parseRegisterIndex(tokens[1]);
        const imm = parseImm(tokens[2], labels, currentAddr);
        raw = ((imm & 0xFFFFF) << 12) | (rd << 7) | 0x17;
      } else if (op === 'jal') {
        let rd = 1;
        let targetStr = '';
        if (tokens.length === 2) {
          targetStr = tokens[1];
        } else {
          rd = parseRegisterIndex(tokens[1]);
          targetStr = tokens[2];
        }
        let imm = parseImm(targetStr, labels, currentAddr);
        if (labels[targetStr] !== undefined) {
          imm = Number(labels[targetStr] - currentAddr);
        }
        const imm20 = (imm >> 20) & 1;
        const imm10_1 = (imm >> 1) & 0x3FF;
        const imm11 = (imm >> 11) & 1;
        const imm19_12 = (imm >> 12) & 0xFF;
        raw = (imm20 << 31) | (imm10_1 << 21) | (imm11 << 20) | (imm19_12 << 12) | (rd << 7) | 0x6F;
      } else if (['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu'].includes(op)) {
        const rs1 = parseRegisterIndex(tokens[1]);
        const rs2 = parseRegisterIndex(tokens[2]);
        const targetStr = tokens[3];
        let imm = parseImm(targetStr, labels, currentAddr);
        if (labels[targetStr] !== undefined) {
          imm = Number(labels[targetStr] - currentAddr);
        }
        let funct3 = 0;
        if (op === 'beq') funct3 = 0;
        else if (op === 'bne') funct3 = 1;
        else if (op === 'blt') funct3 = 4;
        else if (op === 'bge') funct3 = 5;
        else if (op === 'bltu') funct3 = 6;
        else if (op === 'bgeu') funct3 = 7;

        const imm12 = (imm >> 12) & 1;
        const imm10_5 = (imm >> 5) & 0x3F;
        const imm4_1 = (imm >> 1) & 0xF;
        const imm11 = (imm >> 11) & 1;
        raw = (imm12 << 31) | (imm10_5 << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | (imm4_1 << 8) | (imm11 << 7) | 0x63;
      } else if (['lb', 'lh', 'lw', 'ld', 'lbu', 'lhu', 'lwu'].includes(op)) {
        const rd = parseRegisterIndex(tokens[1]);
        const { imm, rs1 } = parseMemOperand(tokens[2]);
        let funct3 = 0;
        if (op === 'lb') funct3 = 0;
        else if (op === 'lh') funct3 = 1;
        else if (op === 'lw') funct3 = 2;
        else if (op === 'ld') funct3 = 3;
        else if (op === 'lbu') funct3 = 4;
        else if (op === 'lhu') funct3 = 5;
        else if (op === 'lwu') funct3 = 6;
        raw = ((imm & 0xFFF) << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x03;
      } else if (['sb', 'sh', 'sw', 'sd'].includes(op)) {
        const rs2 = parseRegisterIndex(tokens[1]);
        const { imm, rs1 } = parseMemOperand(tokens[2]);
        let funct3 = 0;
        if (op === 'sb') funct3 = 0;
        else if (op === 'sh') funct3 = 1;
        else if (op === 'sw') funct3 = 2;
        else if (op === 'sd') funct3 = 3;
        const imm11_5 = (imm >> 5) & 0x7F;
        const imm4_0 = imm & 0x1F;
        raw = (imm11_5 << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | (imm4_0 << 7) | 0x23;
      } else if (['addi', 'slti', 'sltiu', 'xori', 'ori', 'andi', 'slli', 'srli', 'srai'].includes(op)) {
        const rd = parseRegisterIndex(tokens[1]);
        const rs1 = parseRegisterIndex(tokens[2]);
        let imm = parseImm(tokens[3], labels, currentAddr);
        let funct3 = 0;
        let funct7 = 0;
        if (op === 'addi') funct3 = 0;
        else if (op === 'slli') { funct3 = 1; funct7 = 0; }
        else if (op === 'slti') funct3 = 2;
        else if (op === 'sltiu') funct3 = 3;
        else if (op === 'xori') funct3 = 4;
        else if (op === 'srli') { funct3 = 5; funct7 = 0; }
        else if (op === 'srai') { funct3 = 5; funct7 = 0x20; }
        else if (op === 'ori') funct3 = 6;
        else if (op === 'andi') funct3 = 7;

        if (['slli', 'srli', 'srai'].includes(op)) {
          // RV64 shift has 6-bit shamt
          const shamt = imm & 0x3F;
          raw = ((funct7 | ((imm >> 6) & 0x3F)) << 26) | (shamt << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x13;
        } else {
          raw = ((imm & 0xFFF) << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x13;
        }
      } else if (['add', 'sub', 'sll', 'slt', 'sltu', 'xor', 'srl', 'sra', 'or', 'and'].includes(op)) {
        const rd = parseRegisterIndex(tokens[1]);
        const rs1 = parseRegisterIndex(tokens[2]);
        const rs2 = parseRegisterIndex(tokens[3]);
        let funct3 = 0;
        let funct7 = 0;
        if (op === 'add') { funct3 = 0; funct7 = 0; }
        else if (op === 'sub') { funct3 = 0; funct7 = 0x20; }
        else if (op === 'sll') { funct3 = 1; funct7 = 0; }
        else if (op === 'slt') { funct3 = 2; funct7 = 0; }
        else if (op === 'sltu') { funct3 = 3; funct7 = 0; }
        else if (op === 'xor') { funct3 = 4; funct7 = 0; }
        else if (op === 'srl') { funct3 = 5; funct7 = 0; }
        else if (op === 'sra') { funct3 = 5; funct7 = 0x20; }
        else if (op === 'or') { funct3 = 6; funct7 = 0; }
        else if (op === 'and') { funct3 = 7; funct7 = 0; }
        raw = (funct7 << 25) | (rs2 << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | 0x33;
      } else {
        // Fallback placeholder
        raw = 0x00000013;
      }

      instructions.push({
        address: currentAddr,
        raw,
        asm: line,
        sourceLine: i + 1,
        comment,
      });
      currentAddr += 4n;
    } catch (e: any) {
      errors.push(`Line ${i + 1}: ${e.message || 'Syntax error'}`);
    }
  }

  return { instructions, errors, labels };
}

function parseImm(token: string, labels: Record<string, bigint>, currentPc: bigint): number {
  if (labels[token] !== undefined) {
    return Number(labels[token]);
  }
  let clean = token.trim();
  if (clean.startsWith('0x') || clean.startsWith('0X')) {
    return parseInt(clean, 16);
  }
  return parseInt(clean, 10);
}

function parseMemOperand(token: string): { imm: number; rs1: number } {
  // e.g. 0(x1) or -8(s0)
  const match = token.trim().match(/^(-?[0-9a-fA-FxX]+)?\(([a-zA-Z0-9_]+)\)$/);
  if (match) {
    const immStr = match[1] || '0';
    const imm = immStr.startsWith('0x') ? parseInt(immStr, 16) : parseInt(immStr, 10);
    const rs1 = parseRegisterIndex(match[2]);
    return { imm, rs1 };
  }
  return { imm: 0, rs1: 0 };
}

// Disassembler for display
export function disassembleInstruction(raw: number): string {
  const opcode = raw & 0x7F;
  const rd = (raw >> 7) & 0x1F;
  const funct3 = (raw >> 12) & 0x7;
  const rs1 = (raw >> 15) & 0x1F;
  const rs2 = (raw >> 20) & 0x1F;
  const funct7 = (raw >> 25) & 0x7F;

  if (raw === 0x00000013) return 'nop';
  if (raw === 0x00100073) return 'ebreak';
  if (raw === 0x00000073) return 'ecall';

  if (opcode === 0x37) {
    const imm = (raw >>> 12);
    return `lui ${ABI_NAMES[rd]}, 0x${imm.toString(16)}`;
  }
  if (opcode === 0x17) {
    const imm = (raw >>> 12);
    return `auipc ${ABI_NAMES[rd]}, 0x${imm.toString(16)}`;
  }
  if (opcode === 0x6F) {
    // JAL
    return `jal ${ABI_NAMES[rd]}, offset`;
  }
  if (opcode === 0x67) {
    const imm = (raw >> 20);
    return `jalr ${ABI_NAMES[rd]}, ${imm}(${ABI_NAMES[rs1]})`;
  }
  if (opcode === 0x63) {
    // Branch
    const branches = ['beq', 'bne', '???', '???', 'blt', 'bge', 'bltu', 'bgeu'];
    return `${branches[funct3]} ${ABI_NAMES[rs1]}, ${ABI_NAMES[rs2]}`;
  }
  if (opcode === 0x03) {
    const loads = ['lb', 'lh', 'lw', 'ld', 'lbu', 'lhu', 'lwu'];
    const imm = (raw >> 20);
    return `${loads[funct3] || 'ld'} ${ABI_NAMES[rd]}, ${imm}(${ABI_NAMES[rs1]})`;
  }
  if (opcode === 0x23) {
    const stores = ['sb', 'sh', 'sw', 'sd'];
    const imm = ((funct7 << 5) | rd);
    return `${stores[funct3] || 'sd'} ${ABI_NAMES[rs2]}, ${imm}(${ABI_NAMES[rs1]})`;
  }
  if (opcode === 0x13) {
    const ops = ['addi', 'slli', 'slti', 'sltiu', 'xori', 'srli/srai', 'ori', 'andi'];
    const imm = (raw >> 20);
    if (funct3 === 5) {
      return (funct7 & 0x20) ? `srai ${ABI_NAMES[rd]}, ${ABI_NAMES[rs1]}, ${imm & 0x3F}` : `srli ${ABI_NAMES[rd]}, ${ABI_NAMES[rs1]}, ${imm & 0x3F}`;
    }
    return `${ops[funct3]} ${ABI_NAMES[rd]}, ${ABI_NAMES[rs1]}, ${imm}`;
  }
  if (opcode === 0x33) {
    const ops: Record<string, string> = {
      '0_0': 'add', '0_32': 'sub', '1_0': 'sll', '2_0': 'slt', '3_0': 'sltu',
      '4_0': 'xor', '5_0': 'srl', '5_32': 'sra', '6_0': 'or', '7_0': 'and'
    };
    const key = `${funct3}_${funct7}`;
    return `${ops[key] || 'alu_op'} ${ABI_NAMES[rd]}, ${ABI_NAMES[rs1]}, ${ABI_NAMES[rs2]}`;
  }

  return `inst[0x${raw.toString(16).padStart(8, '0')}]`;
}

// SoC Simulation State
export class AxralSoCSimulator {
  config: CpuConfig;
  pc: bigint = 0n;
  nextPc: bigint = 0n;
  registers: bigint[] = new Array(32).fill(0n);
  
  // Memory hierarchy (Wishbone slaves)
  ram: Map<bigint, number> = new Map(); // byte addressed
  instructions: Map<bigint, AssembledInstruction> = new Map();
  
  // Peripherals
  uartTxBuffer: string = '';
  uartTxFifo: number[] = [];
  uartLsr: number = 0x60; // Transmitter empty & ready
  mtime: bigint = 0n;
  mtimecmp: bigint = 0xFFFFFFFFFFFFFFFFn;
  gpioLeds: number = 0;
  
  // Telemetry & metrics
  cycleCount: number = 0;
  instructionsRetired: number = 0;
  isHalted: boolean = false;
  haltReason: string = '';
  
  // Pipeline state (for 3-stage / 5-stage)
  stages: PipelineStageInfo[] = [];
  hazardStall: boolean = false;
  hazardForward: boolean = false;
  
  // Wishbone bus transaction
  currentBusTx: WishboneTransaction = {
    cycle: 0,
    cyc: false,
    stb: false,
    we: false,
    adr: 0n,
    dat_w: 0n,
    dat_r: 0n,
    ack: false,
    target: 'NONE'
  };
  
  // Waveform history (last 100 samples)
  waveforms: WaveformSample[] = [];

  constructor(config: CpuConfig) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.pc = 0n;
    this.nextPc = 4n;
    this.registers = new Array(32).fill(0n);
    this.ram.clear();
    this.uartTxBuffer = '';
    this.uartTxFifo = [];
    this.mtime = 0n;
    this.mtimecmp = 0xFFFFFFFFFFFFFFFFn;
    this.gpioLeds = 0;
    this.cycleCount = 0;
    this.instructionsRetired = 0;
    this.isHalted = false;
    this.haltReason = '';
    this.waveforms = [];
    this.initStages();
  }

  loadProgram(assembled: AssembledInstruction[]) {
    this.reset();
    this.instructions.clear();
    for (const inst of assembled) {
      this.instructions.set(inst.address, inst);
      // Also write raw 32-bit into RAM at address
      for (let b = 0; b < 4; b++) {
        const byteVal = (inst.raw >> (b * 8)) & 0xFF;
        this.ram.set(inst.address + BigInt(b), byteVal);
      }
    }
  }

  initStages() {
    if (this.config.pipelineMode === 'single') {
      this.stages = [
        { name: 'Core (Single-Cycle)', active: true, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'RV64I 1-cycle execute' }
      ];
    } else if (this.config.pipelineMode === '3-stage') {
      this.stages = [
        { name: '1. Fetch (IF)', active: true, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'PC & I-Mem' },
        { name: '2. Decode/Execute (ID/EX)', active: false, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'RegFile & 64b ALU' },
        { name: '3. Writeback (WB)', active: false, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'RegFile Write' },
      ];
    } else {
      this.stages = [
        { name: '1. Fetch (IF)', active: true, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'PC -> I-Mem' },
        { name: '2. Decode (ID)', active: false, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'Register Read & ImmGen' },
        { name: '3. Execute (EX)', active: false, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: '64-bit ALU & Branch' },
        { name: '4. Memory (MEM)', active: false, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'Wishbone D-Mem' },
        { name: '5. Writeback (WB)', active: false, pc: 0n, instrRaw: 0, instrDisasm: 'IDLE', hazardStatus: 'normal', details: 'Register Commit' },
      ];
    }
  }

  // Memory byte read/write with Wishbone Bus target routing
  readMemoryByte(addr: bigint): number {
    return this.ram.get(addr) || 0;
  }

  writeMemoryByte(addr: bigint, byteVal: number) {
    this.ram.set(addr, byteVal & 0xFF);
  }

  // Wishbone Master write transaction
  wishboneWrite(addr: bigint, data: bigint, widthBytes: number) {
    this.currentBusTx = {
      cycle: this.cycleCount,
      cyc: true,
      stb: true,
      we: true,
      adr: addr,
      dat_w: data,
      dat_r: 0n,
      ack: true,
      target: 'NONE'
    };

    // UART Slave: 0x30000000 - 0x3000000F
    if (addr >= 0x30000000n && addr <= 0x3000000Fn) {
      this.currentBusTx.target = 'UART';
      const charCode = Number(data & 0xFFn);
      this.uartTxFifo.push(charCode);
      this.uartTxBuffer += String.fromCharCode(charCode);
      return;
    }

    // CLINT Timer: 0x20000000 - 0x2000001F
    if (addr >= 0x20000000n && addr <= 0x2000001Fn) {
      this.currentBusTx.target = 'CLINT';
      if (addr === 0x20000000n) this.mtime = data;
      else if (addr === 0x20000008n) this.mtimecmp = data;
      return;
    }

    // GPIO: 0x40000000 - 0x40000007
    if (addr >= 0x40000000n && addr <= 0x40000007n) {
      this.currentBusTx.target = 'GPIO';
      this.gpioLeds = Number(data & 0xFFn);
      return;
    }

    // RAM: 0x80000000 or ROM 0x00000000
    this.currentBusTx.target = 'RAM';
    for (let b = 0; b < widthBytes; b++) {
      const byteVal = Number((data >> BigInt(b * 8)) & 0xFFn);
      this.writeMemoryByte(addr + BigInt(b), byteVal);
    }
  }

  // Wishbone Master read transaction
  wishboneRead(addr: bigint, widthBytes: number, isSigned: boolean): bigint {
    let result = 0n;
    this.currentBusTx = {
      cycle: this.cycleCount,
      cyc: true,
      stb: true,
      we: false,
      adr: addr,
      dat_w: 0n,
      dat_r: 0n,
      ack: true,
      target: 'NONE'
    };

    // UART
    if (addr >= 0x30000000n && addr <= 0x3000000Fn) {
      this.currentBusTx.target = 'UART';
      if (addr === 0x30000004n) result = BigInt(this.uartLsr); // LSR
      else result = 0n;
      this.currentBusTx.dat_r = result;
      return result;
    }

    // CLINT
    if (addr >= 0x20000000n && addr <= 0x2000001Fn) {
      this.currentBusTx.target = 'CLINT';
      if (addr === 0x20000000n) result = this.mtime;
      else if (addr === 0x20000008n) result = this.mtimecmp;
      this.currentBusTx.dat_r = result;
      return result;
    }

    // GPIO
    if (addr >= 0x40000000n && addr <= 0x40000007n) {
      this.currentBusTx.target = 'GPIO';
      result = BigInt(this.gpioLeds);
      this.currentBusTx.dat_r = result;
      return result;
    }

    // RAM
    this.currentBusTx.target = 'RAM';
    for (let b = 0; b < widthBytes; b++) {
      const byteVal = BigInt(this.readMemoryByte(addr + BigInt(b)));
      result |= (byteVal << BigInt(b * 8));
    }

    if (isSigned) {
      const bitWidth = widthBytes * 8;
      const signBit = 1n << BigInt(bitWidth - 1);
      if ((result & signBit) !== 0n) {
        // Sign extend to 64-bit
        const mask = (1n << BigInt(bitWidth)) - 1n;
        result = result | (~mask & MASK_64);
      }
    }
    this.currentBusTx.dat_r = result;
    return result;
  }

  // Execute a single clock cycle
  stepCycle(): boolean {
    if (this.isHalted) return false;

    this.cycleCount++;
    this.mtime++; // Increment CLINT timer counter every cycle

    let currentInst = this.instructions.get(this.pc);
    let raw = currentInst ? currentInst.raw : 0;
    if (!currentInst && this.ram.has(this.pc)) {
      // Reconstruct raw from RAM
      let r = 0;
      for (let b = 0; b < 4; b++) {
        r |= (this.readMemoryByte(this.pc + BigInt(b)) << (b * 8));
      }
      raw = r;
    }

    if (raw === 0 && !currentInst) {
      this.isHalted = true;
      this.haltReason = `PC ${formatHex64(this.pc)} reached unmapped or zero memory (Execution finished)`;
      return false;
    }

    this.hazardStall = false;
    this.hazardForward = false;

    // Decode & Execute
    const opcode = raw & 0x7F;
    const rd = (raw >> 7) & 0x1F;
    const funct3 = (raw >> 12) & 0x7;
    const rs1 = (raw >> 15) & 0x1F;
    const rs2 = (raw >> 20) & 0x1F;
    const funct7 = (raw >> 25) & 0x7F;

    let aluRes = 0n;
    let regWe = false;
    let dmemWe = false;
    this.nextPc = this.pc + 4n;

    // Read register operands
    const valRs1 = this.registers[rs1];
    const valRs2 = this.registers[rs2];

    // Detect hazards if in 5-stage pipeline
    if (this.config.pipelineMode === '5-stage') {
      const prevWbReg = this.stages.length > 2 ? ((this.stages[2].instrRaw >> 7) & 0x1F) : 0;
      if (prevWbReg !== 0 && (rs1 === prevWbReg || rs2 === prevWbReg)) {
        if (this.config.enableForwarding) {
          this.hazardForward = true;
        } else {
          this.hazardStall = true;
        }
      }
    }

    if (raw === 0x00100073) {
      // EBREAK
      this.isHalted = true;
      this.haltReason = 'EBREAK reached - Program terminated successfully';
      return false;
    }

    if (opcode === 0x37) {
      // LUI
      const imm = BigInt(raw & 0xFFFFF000);
      aluRes = toSigned64(imm);
      regWe = true;
    } else if (opcode === 0x17) {
      // AUIPC
      const imm = BigInt(raw & 0xFFFFF000);
      aluRes = toSigned64(this.pc + imm);
      regWe = true;
    } else if (opcode === 0x6F) {
      // JAL
      const imm20 = (raw >> 31) & 1;
      const imm10_1 = (raw >> 21) & 0x3FF;
      const imm11 = (raw >> 20) & 1;
      const imm19_12 = (raw >> 12) & 0xFF;
      let imm = (imm20 << 20) | (imm19_12 << 12) | (imm11 << 11) | (imm10_1 << 1);
      if (imm20) imm |= ~0x1FFFFF; // sign extend
      aluRes = this.pc + 4n;
      regWe = true;
      this.nextPc = this.pc + BigInt(imm);
    } else if (opcode === 0x67) {
      // JALR
      let imm = raw >> 20;
      aluRes = this.pc + 4n;
      regWe = true;
      this.nextPc = (valRs1 + BigInt(imm)) & ~1n;
    } else if (opcode === 0x63) {
      // Branch (BEQ, BNE, BLT, BGE, BLTU, BGEU)
      const imm12 = (raw >> 31) & 1;
      const imm10_5 = (raw >> 25) & 0x3F;
      const imm4_1 = (raw >> 8) & 0xF;
      const imm11 = (raw >> 7) & 1;
      let imm = (imm12 << 12) | (imm11 << 11) | (imm10_5 << 5) | (imm4_1 << 1);
      if (imm12) imm |= ~0x1FFF;

      let taken = false;
      const s1 = toSigned64(valRs1);
      const s2 = toSigned64(valRs2);
      const u1 = toUnsigned64(valRs1);
      const u2 = toUnsigned64(valRs2);

      if (funct3 === 0) taken = (valRs1 === valRs2); // BEQ
      else if (funct3 === 1) taken = (valRs1 !== valRs2); // BNE
      else if (funct3 === 4) taken = (s1 < s2); // BLT
      else if (funct3 === 5) taken = (s1 >= s2); // BGE
      else if (funct3 === 6) taken = (u1 < u2); // BLTU
      else if (funct3 === 7) taken = (u1 >= u2); // BGEU

      if (taken) {
        this.nextPc = this.pc + BigInt(imm);
      }
    } else if (opcode === 0x03) {
      // Load (LB, LH, LW, LD, LBU, LHU, LWU)
      const imm = BigInt(raw >> 20);
      const addr = toUnsigned64(valRs1 + imm);
      regWe = true;

      if (funct3 === 0) aluRes = this.wishboneRead(addr, 1, true); // LB
      else if (funct3 === 1) aluRes = this.wishboneRead(addr, 2, true); // LH
      else if (funct3 === 2) aluRes = this.wishboneRead(addr, 4, true); // LW
      else if (funct3 === 3) aluRes = this.wishboneRead(addr, 8, false); // LD (64-bit doubleword)
      else if (funct3 === 4) aluRes = this.wishboneRead(addr, 1, false); // LBU
      else if (funct3 === 5) aluRes = this.wishboneRead(addr, 2, false); // LHU
      else if (funct3 === 6) aluRes = this.wishboneRead(addr, 4, false); // LWU
    } else if (opcode === 0x23) {
      // Store (SB, SH, SW, SD)
      const imm11_5 = (raw >> 25) & 0x7F;
      const imm4_0 = (raw >> 7) & 0x1F;
      let imm = (imm11_5 << 5) | imm4_0;
      if (imm11_5 & 0x40) imm |= ~0xFFF;
      const addr = toUnsigned64(valRs1 + BigInt(imm));
      dmemWe = true;

      if (funct3 === 0) this.wishboneWrite(addr, valRs2 & 0xFFn, 1); // SB
      else if (funct3 === 1) this.wishboneWrite(addr, valRs2 & 0xFFFFn, 2); // SH
      else if (funct3 === 2) this.wishboneWrite(addr, valRs2 & 0xFFFFFFFFn, 4); // SW
      else if (funct3 === 3) this.wishboneWrite(addr, valRs2, 8); // SD (64-bit doubleword)
    } else if (opcode === 0x13) {
      // OP-IMM (ADDI, SLTI, SLTIU, XORI, ORI, ANDI, SLLI, SRLI, SRAI)
      const imm = BigInt(raw >> 20);
      const shamt = Number((raw >> 20) & 0x3F); // 6-bit shift amount for RV64
      regWe = true;

      if (funct3 === 0) aluRes = toSigned64(valRs1 + imm); // ADDI
      else if (funct3 === 1) aluRes = toUnsigned64(valRs1 << BigInt(shamt)); // SLLI
      else if (funct3 === 2) aluRes = toSigned64(valRs1) < toSigned64(imm) ? 1n : 0n; // SLTI
      else if (funct3 === 3) aluRes = toUnsigned64(valRs1) < toUnsigned64(imm) ? 1n : 0n; // SLTIU
      else if (funct3 === 4) aluRes = valRs1 ^ imm; // XORI
      else if (funct3 === 5) {
        if ((funct7 & 0x20) !== 0) {
          // SRAI (arithmetic shift right)
          aluRes = toSigned64(valRs1) >> BigInt(shamt);
        } else {
          // SRLI (logical shift right)
          aluRes = toUnsigned64(valRs1) >> BigInt(shamt);
        }
      } else if (funct3 === 6) aluRes = valRs1 | imm; // ORI
      else if (funct3 === 7) aluRes = valRs1 & imm; // ANDI
    } else if (opcode === 0x33) {
      // OP (ADD, SUB, SLL, SLT, SLTU, XOR, SRL, SRA, OR, AND)
      const shamt = Number(valRs2 & 0x3Fn);
      regWe = true;

      if (funct3 === 0) {
        aluRes = (funct7 & 0x20) ? toSigned64(valRs1 - valRs2) : toSigned64(valRs1 + valRs2);
      } else if (funct3 === 1) {
        aluRes = toUnsigned64(valRs1 << BigInt(shamt));
      } else if (funct3 === 2) {
        aluRes = toSigned64(valRs1) < toSigned64(valRs2) ? 1n : 0n;
      } else if (funct3 === 3) {
        aluRes = toUnsigned64(valRs1) < toUnsigned64(valRs2) ? 1n : 0n;
      } else if (funct3 === 4) {
        aluRes = valRs1 ^ valRs2;
      } else if (funct3 === 5) {
        if ((funct7 & 0x20) !== 0) {
          aluRes = toSigned64(valRs1) >> BigInt(shamt);
        } else {
          aluRes = toUnsigned64(valRs1) >> BigInt(shamt);
        }
      } else if (funct3 === 6) {
        aluRes = valRs1 | valRs2;
      } else if (funct3 === 7) {
        aluRes = valRs1 & valRs2;
      }
    }

    // Writeback to Register File (x0 is hardwired to 0)
    if (regWe && rd !== 0) {
      this.registers[rd] = toUnsigned64(aluRes);
    }
    this.registers[0] = 0n;

    this.instructionsRetired++;

    // Update Pipeline Stages display
    this.updateStages(this.pc, raw, aluRes);

    // Record waveform sample
    this.waveforms.push({
      cycle: this.cycleCount,
      clk: (this.cycleCount % 2 === 0 ? 1 : 0) as 0 | 1,
      rst_n: 1,
      pc: this.pc,
      instr: raw,
      alu_res: aluRes,
      reg_we: regWe,
      dmem_we: dmemWe,
      wb_cyc: this.currentBusTx.cyc,
      wb_stb: this.currentBusTx.stb,
      wb_we: this.currentBusTx.we,
      wb_adr: this.currentBusTx.adr,
      wb_dat: this.currentBusTx.we ? this.currentBusTx.dat_w : this.currentBusTx.dat_r,
      wb_ack: this.currentBusTx.ack,
      uart_tx: (this.currentBusTx.target === 'UART' ? 0 : 1) as 0 | 1,
      hazard_stall: this.hazardStall,
      hazard_forward: this.hazardForward,
    });

    if (this.waveforms.length > 200) {
      this.waveforms.shift();
    }

    // Advance PC
    this.pc = this.nextPc;
    return true;
  }

  updateStages(pc: bigint, raw: number, aluRes: bigint) {
    const disasm = disassembleInstruction(raw);
    if (this.config.pipelineMode === 'single') {
      this.stages[0].pc = pc;
      this.stages[0].instrRaw = raw;
      this.stages[0].instrDisasm = disasm;
      this.stages[0].details = `ALU: ${formatHex64(aluRes)}`;
    } else if (this.config.pipelineMode === '3-stage') {
      // Shift pipeline stages
      this.stages[2].pc = this.stages[1].pc;
      this.stages[2].instrRaw = this.stages[1].instrRaw;
      this.stages[2].instrDisasm = this.stages[1].instrDisasm;
      this.stages[2].active = this.stages[1].active;
      this.stages[2].details = `Commit: ${formatHex64(aluRes)}`;

      this.stages[1].pc = this.stages[0].pc;
      this.stages[1].instrRaw = this.stages[0].instrRaw;
      this.stages[1].instrDisasm = this.stages[0].instrDisasm;
      this.stages[1].active = true;
      this.stages[1].details = `Exec: ${formatHex64(aluRes)}`;

      this.stages[0].pc = this.nextPc;
      this.stages[0].instrRaw = 0;
      this.stages[0].instrDisasm = 'Fetching...';
      this.stages[0].details = `PC: ${formatHex64(this.nextPc)}`;
    } else {
      // 5-stage: IF -> ID -> EX -> MEM -> WB
      for (let s = 4; s > 0; s--) {
        this.stages[s].pc = this.stages[s - 1].pc;
        this.stages[s].instrRaw = this.stages[s - 1].instrRaw;
        this.stages[s].instrDisasm = this.stages[s - 1].instrDisasm;
        this.stages[s].active = this.stages[s - 1].active;
        this.stages[s].hazardStatus = this.hazardStall ? 'stalled' : this.hazardForward ? 'forwarded' : 'normal';
      }
      this.stages[4].details = `WB rd commit`;
      this.stages[3].details = `Wishbone D-Mem`;
      this.stages[2].details = `ALU: ${formatHex64(aluRes)}`;
      this.stages[1].details = `Decoded: ${disasm}`;
      this.stages[0].pc = this.nextPc;
      this.stages[0].instrRaw = 0;
      this.stages[0].instrDisasm = 'Fetch PC';
      this.stages[0].details = `PC: ${formatHex64(this.nextPc)}`;
    }
  }

  getRegisters(): RegisterState[] {
    return this.registers.map((val, idx) => ({
      index: idx,
      name: `x${idx}`,
      abi: ABI_NAMES[idx],
      value: val,
      description: REG_DESCRIPTIONS[idx],
    }));
  }
}
