import React, { useState } from 'react';
import { CpuConfig, WishboneTransaction } from '../types/chip';
import { Cpu, Zap, ArrowRight, Settings2, Info, ChevronRight, Layers, Database, Radio, Clock, ToggleLeft } from 'lucide-react';

interface SchematicViewProps {
  config: CpuConfig;
  onUpdateConfig: (newConfig: Partial<CpuConfig>) => void;
  currentBusTx: WishboneTransaction;
  pc: bigint;
  cycleCount: number;
}

interface BlockDetail {
  id: string;
  title: string;
  subtitle: string;
  purpose: string;
  beginnerNote: string;
  inputs: string[];
  outputs: string[];
  verilogSample: string;
}

const BLOCK_DETAILS: Record<string, BlockDetail> = {
  pc: {
    id: 'pc',
    title: 'プログラムカウンタ (PC)',
    subtitle: '64-bit Program Counter Register',
    purpose: 'CPUが次にメモリから読み出して実行すべき命令のメモリ番地(アドレス)を保持する64ビットのレジスタです。通常はクロックごとに +4 ずつ進みますが、分岐命令(BEQ等)やジャンプ命令(JAL)で任意のアドレスへ切り替わります。',
    beginnerNote: '本のように「今読んでいるページ数」を示すしおりのような部品です。RISC-V 64bitでは64ビットの巨大なアドレス空間(16EB)を指し示すことができます。',
    inputs: ['clk (クロック)', 'rst_n (リセット)', 'pc_next[63:0] (次アドレス)', 'stall (ハザード停止信号)'],
    outputs: ['pc_q[63:0] (現在のアドレス)', 'fetch_valid (フェッチ要求)'],
    verilogSample: `always @(posedge clk or negedge rst_n) begin
  if (!rst_n)      pc_q <= 64'h0000_0000;
  else if (!stall) pc_q <= pc_next;
end`,
  },
  decoder: {
    id: 'decoder',
    title: '命令デコーダ & 即値生成器 (ID & ImmGen)',
    subtitle: 'Instruction Decoder & Sign Extension',
    purpose: '32ビットの機械語命令を分解し、opcode(種類)、rd(書き込みレジスタ番号)、rs1/rs2(読み出しレジスタ番号)、funct3/funct7、および即値(数値リテラル)を抽出・64ビット符号拡張します。',
    beginnerNote: '暗号のような「0と1の並び」を解読し、「どの計算機を動かすか」「どのレジスタから値を読むか」という命令書を各回路へ配る司令塔です。',
    inputs: ['instr[31:0] (命令データ)'],
    outputs: ['opcode[6:0]', 'rd[4:0]', 'rs1[4:0]', 'rs2[4:0]', 'imm_64[63:0] (64bit符号拡張値)', 'alu_ctrl[3:0]'],
    verilogSample: `// RV64I 即値生成 (I-type, S-type, B-type, U-type, J-type)
always @(*) begin
  case (opcode)
    7'b0010011: imm_64 = {{52{instr[31]}}, instr[31:20]}; // ADDI
    7'b0100011: imm_64 = {{52{instr[31]}}, instr[31:25], instr[11:7]}; // SD
    default:    imm_64 = 64'b0;
  endcase
end`,
  },
  regfile: {
    id: 'regfile',
    title: '64ビット レジスタファイル (RegFile)',
    subtitle: '32 x 64-bit Dual-Read Single-Write SRAM/DFF Array',
    purpose: 'x0 から x31 までの32本の64ビット超高速記憶領域です。x0 は常に 0 (ハードワイヤードゼロ) に固定されています。1クロック内に2つのレジスタを同時読み出し、1つのレジスタに書き込むことが可能です。',
    beginnerNote: 'CPUの作業机の上にある32個の引き出しです。計算に必要な数値はメモリからこの引き出しに持ってきて、超高速で出し入れして計算します。',
    inputs: ['raddr1[4:0]', 'raddr2[4:0]', 'waddr[4:0]', 'wdata[63:0]', 'we (書き込み許可)'],
    outputs: ['rdata1[63:0] (rs1の値)', 'rdata2[63:0] (rs2の値)'],
    verilogSample: `// x0 は常に 0 を出力
assign rdata1 = (raddr1 == 5'd0) ? 64'd0 : regfile[raddr1];
assign rdata2 = (raddr2 == 5'd0) ? 64'd0 : regfile[raddr2];
always @(posedge clk) begin
  if (we && waddr != 5'd0) regfile[waddr] <= wdata;
end`,
  },
  alu: {
    id: 'alu',
    title: '64ビット 算術論理演算器 (ALU) & シフタ',
    subtitle: '64-bit Arithmetic Logic Unit & 6-bit Barrel Shifter',
    purpose: '加算(ADD)、減算(SUB)、ビット演算(AND/OR/XOR)、大小比較(SLT/SLTU)、および64ビットシフタ(SLL/SRL/SRA)を実行します。RV64Iではシフト量が最大63 (6bit shamt) に拡張されています。',
    beginnerNote: 'CPUの心臓部となる高速計算機です。64ビットの足し算やシフト演算を数ナノ秒で完了させます。',
    inputs: ['op_a[63:0]', 'op_b[63:0]', 'alu_op[3:0]', 'shamt[5:0]'],
    outputs: ['alu_result[63:0]', 'zero_flag (結果ゼロ判定)', 'overflow_flag'],
    verilogSample: `always @(*) begin
  case (alu_op)
    4'b0000: alu_result = op_a + op_b;
    4'b0001: alu_result = op_a - op_b;
    4'b0010: alu_result = op_a << shamt;
    4'b0100: alu_result = op_a ^ op_b;
    default: alu_result = 64'd0;
  endcase
end`,
  },
  hazard: {
    id: 'hazard',
    title: 'ハザード検出 & フォワーディングユニット',
    subtitle: 'Hazard Detection & Forwarding Multiplexer',
    purpose: 'パイプライン処理において、前の命令の計算結果がレジスタに書き戻される前に次の命令がその値を必要とする「データハザード(RAW)」を検知し、バイパス線を通じて直ちに最新データを供給します。',
    beginnerNote: '料理のリレーで、前のシェフが切った具材を棚に戻すのを待たずに、次のシェフの手元へ直接手渡しするショートカット回路です。これによりCPUが立ち止まる時間(Stall)を劇的に削減します。',
    inputs: ['rs1_ex[4:0]', 'rs2_ex[4:0]', 'rd_mem[4:0]', 'rd_wb[4:0]', 'reg_we_mem', 'reg_we_wb'],
    outputs: ['forward_a[1:0]', 'forward_b[1:0]', 'pipeline_stall', 'pipeline_flush'],
    verilogSample: `// EXフォワーディング条件の判定
wire fwd_a_from_mem = reg_we_mem && (rd_mem != 0) && (rd_mem == rs1_ex);
wire fwd_a_from_wb  = reg_we_wb  && (rd_wb  != 0) && (rd_wb  == rs1_ex);
assign forward_a = fwd_a_from_mem ? 2'b10 : (fwd_a_from_wb ? 2'b01 : 2'b00);`,
  },
  wishbone: {
    id: 'wishbone',
    title: 'Wishbone B4 内部インターコネクト (Bus)',
    subtitle: 'Wishbone Master/Slave Interconnect & Address Decoder',
    purpose: 'CPUコア(Master)と、RAM・UART・タイマ・GPIOなどの周辺回路(Slave)を結ぶオープン標準バス規格です。アドレスデコーダが0x30000000(UART)や0x80000000(RAM)などのアドレスを判別してチップセレクト信号を振り分けます。',
    beginnerNote: 'チップ内の「高速道路網」です。CPUが「0x30000000番地に文字 A を送りたい！」と荷物を積むと、バスがUARTの部屋へと確実に配送します。',
    inputs: ['wb_cyc (バスサイクル有効)', 'wb_stb (ストローブ)', 'wb_we (書込フラグ)', 'wb_adr[63:0]', 'wb_dat_w[63:0]'],
    outputs: ['wb_ack (スレーブ応答)', 'wb_dat_r[63:0]', 's_ram_sel', 's_uart_sel', 's_clint_sel'],
    verilogSample: `// アドレスデコーダによるスレーブ選択
assign s_ram_sel   = (wb_adr >= 64'h8000_0000 && wb_adr <= 64'h8000_FFFF);
assign s_uart_sel  = (wb_adr >= 64'h3000_0000 && wb_adr <= 64'h3000_000F);
assign s_clint_sel = (wb_adr >= 64'h2000_0000 && wb_adr <= 64'h2000_001F);`,
  },
  uart: {
    id: 'uart',
    title: 'UART シリアル通信コントローラ (0x30000000)',
    subtitle: 'Universal Asynchronous Receiver/Transmitter',
    purpose: 'CPUのデータを1ビットずつシリアル信号に変換し、PCやiPadのターミナル画面へ文字を出力します。送信FIFO、ボーレートジェネレータ、ステータスレジスタ(LSR)を内蔵しています。',
    beginnerNote: 'チップが外の世界(iPadやPCの画面)にお喋りするための「口」です。plan.mdの「iPadから文字を出す」目標の中核回路です。',
    inputs: ['wb_cyc', 'wb_stb', 'wb_we', 'wb_dat_w[7:0]', 'baud_div[15:0]'],
    outputs: ['uart_tx (シリアル出力ピン)', 'tx_busy', 'wb_ack'],
    verilogSample: `// UART 送信ロジック
always @(posedge clk) begin
  if (wb_cyc && wb_stb && wb_we) begin
    tx_shift_reg <= {1'b1, wb_dat_w[7:0], 1'b0}; // Stop, Data, Start
    tx_busy <= 1'b1;
  end
end`,
  },
  clint: {
    id: 'clint',
    title: 'CLINT タイマ & 割り込みコントローラ (0x20000000)',
    subtitle: 'Core Local Interruptor & Real-Time Counter',
    purpose: '毎クロックインクリメントされる64ビットカウンタ `mtime` と、目標時刻を設定する `mtimecmp` を管理します。`mtime >= mtimecmp` になるとタイマ割り込みを発生させ、OS(Linux等)のタスク切り替えの基準となります。',
    beginnerNote: 'チップの「目覚まし時計」です。LinuxなどのOSを起動するためには絶対に欠かせない必須パーツです。',
    inputs: ['wb_cyc', 'wb_stb', 'wb_we', 'wb_adr', 'wb_dat_w[63:0]'],
    outputs: ['mtime[63:0]', 'mtimecmp[63:0]', 'timer_irq (割り込み信号)'],
    verilogSample: `always @(posedge clk) begin
  mtime <= mtime + 1'b1;
  timer_irq <= (mtime >= mtimecmp);
end`,
  },
};

export const SchematicView: React.FC<SchematicViewProps> = ({
  config,
  onUpdateConfig,
  currentBusTx,
  pc,
  cycleCount,
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string>('pc');
  const selectedBlock = BLOCK_DETAILS[selectedBlockId] || BLOCK_DETAILS['pc'];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      {/* Left 2 Columns: Visual Interactive SoC Schematic */}
      <div className="xl:col-span-2 flex flex-col gap-4">
        {/* Architecture Configuration Toolbar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              パイプライン構造:
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {(['single', '3-stage', '5-stage'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onUpdateConfig({ pipelineMode: mode })}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    config.pipelineMode === mode
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode === 'single' ? '単一サイクル (1段)' : mode === '3-stage' ? '3段パイプライン' : '5段パイプライン (本命)'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={config.enableForwarding}
                onChange={(e) => onUpdateConfig({ enableForwarding: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
              />
              <span>フォワーディング回路有効</span>
            </label>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-2 text-slate-400">
              <span>半導体PDK:</span>
              <button
                onClick={() => onUpdateConfig({ targetNode: config.targetNode === 'sky130' ? 'asap7' : 'sky130' })}
                className="px-2 py-0.5 font-mono text-[11px] bg-slate-800 text-cyan-300 rounded border border-slate-700 hover:bg-slate-700 cursor-pointer"
              >
                {config.targetNode === 'sky130' ? 'SkyWater sky130 (130nm)' : 'ASAP7 (7nm FinFET)'}
              </button>
            </div>
          </div>
        </div>

        {/* Visual Circuit Canvas */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col gap-6 relative overflow-hidden">
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Section 1: 64-bit CPU Core Block */}
          <div className="relative border border-cyan-500/30 rounded-xl p-5 bg-gradient-to-b from-cyan-950/20 to-slate-900/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white tracking-wide">
                  Axral RV64I CPU Core (Master)
                </span>
                <span className="text-[11px] font-mono text-cyan-300/80">
                  {config.pipelineMode.toUpperCase()} · 64-bit Data Path
                </span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                PC: <span className="text-cyan-400 font-semibold">{`0x${pc.toString(16).padStart(8, '0')}`}</span>
              </div>
            </div>

            {/* Pipeline Stage Blocks Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* 1. Fetch (IF) & PC */}
              <button
                onClick={() => setSelectedBlockId('pc')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedBlockId === 'pc'
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  1. IF (Fetch)
                </div>
                <div className="text-xs font-bold text-slate-100">64b PC & I-Mem</div>
                <div className="text-[11px] text-slate-400 mt-2 truncate">PC + 4 / Branch</div>
              </button>

              {/* 2. Decode (ID) */}
              <button
                onClick={() => setSelectedBlockId('decoder')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedBlockId === 'decoder'
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  2. ID (Decode)
                </div>
                <div className="text-xs font-bold text-slate-100">デコーダ & 即値</div>
                <div className="text-[11px] text-slate-400 mt-2 truncate">R/I/S/B/U/J 形式</div>
              </button>

              {/* 3. RegFile & ALU (EX) */}
              <button
                onClick={() => setSelectedBlockId('regfile')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedBlockId === 'regfile'
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  RegFile
                </div>
                <div className="text-xs font-bold text-slate-100">32x 64b レジスタ</div>
                <div className="text-[11px] text-slate-400 mt-2 truncate">x0(zero) ~ x31</div>
              </button>

              {/* 4. Execute (ALU) */}
              <button
                onClick={() => setSelectedBlockId('alu')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedBlockId === 'alu'
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  3. EX (ALU)
                </div>
                <div className="text-xs font-bold text-slate-100">64-bit ALU & シフト</div>
                <div className="text-[11px] text-slate-400 mt-2 truncate">ADD/SUB/SLL 64b</div>
              </button>

              {/* 5. Memory & WB */}
              <button
                onClick={() => setSelectedBlockId('hazard')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedBlockId === 'hazard'
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1">
                  4/5. MEM / WB
                </div>
                <div className="text-xs font-bold text-slate-100">フォワーディング</div>
                <div className="text-[11px] text-slate-400 mt-2 truncate">ハザードバイパス</div>
              </button>
            </div>
          </div>

          {/* Bus Interconnect Link Wire with Animated Indicator */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/70 border border-slate-800 rounded-lg">
            <button
              onClick={() => setSelectedBlockId('wishbone')}
              className="flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:underline cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>Wishbone B4 内部インターコネクト (64-bit Address & Data Bus)</span>
            </button>
            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
              <span className={currentBusTx.cyc ? 'text-emerald-400 font-semibold' : 'text-slate-600'}>
                CYC:{currentBusTx.cyc ? '1' : '0'}
              </span>
              <span className={currentBusTx.stb ? 'text-emerald-400 font-semibold' : 'text-slate-600'}>
                STB:{currentBusTx.stb ? '1' : '0'}
              </span>
              <span className={currentBusTx.we ? 'text-amber-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                {currentBusTx.we ? 'WRITE' : 'READ'}
              </span>
              <span className="text-slate-300">
                ADDR: {`0x${currentBusTx.adr.toString(16).padStart(8, '0')}`}
              </span>
            </div>
          </div>

          {/* Section 2: Wishbone Slaves & SoC Peripherals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Peripheral 1: SRAM */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-mono text-slate-500">Slave 0</span>
                </div>
                <div className="text-xs font-bold text-white">メイン SRAM (64KB)</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  0x8000_0000 - 0x8000_FFFF
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-cyan-400 flex items-center justify-between">
                <span>Access: 1 cycle</span>
                {currentBusTx.target === 'RAM' && (
                  <span className="text-emerald-400 font-bold animate-pulse">ACTIVE</span>
                )}
              </div>
            </div>

            {/* Peripheral 2: UART Serial */}
            <button
              onClick={() => setSelectedBlockId('uart')}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                selectedBlockId === 'uart'
                  ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-mono text-slate-500">Slave 1</span>
                </div>
                <div className="text-xs font-bold text-white">UART シリアル (TX/RX)</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  0x3000_0000 (iPad画面出力)
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-amber-300 flex items-center justify-between">
                <span>115,200 Baud</span>
                {currentBusTx.target === 'UART' && (
                  <span className="text-amber-400 font-bold animate-pulse">TX ACTIVE</span>
                )}
              </div>
            </button>

            {/* Peripheral 3: CLINT Timer */}
            <button
              onClick={() => setSelectedBlockId('clint')}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                selectedBlockId === 'clint'
                  ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-mono text-slate-500">Slave 2</span>
                </div>
                <div className="text-xs font-bold text-white">CLINT リアルタイムタイマ</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  0x2000_0000 (mtime/mtimecmp)
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                <span>Interrupt Gen</span>
                {currentBusTx.target === 'CLINT' && (
                  <span className="text-emerald-400 font-bold animate-pulse">ACTIVE</span>
                )}
              </div>
            </button>

            {/* Peripheral 4: GPIO */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <ToggleLeft className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-mono text-slate-500">Slave 3</span>
                </div>
                <div className="text-xs font-bold text-white">GPIO (LEDs & SW)</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  0x4000_0000 (8-bit IO)
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-purple-300 flex items-center justify-between">
                <span>External Pins</span>
                {currentBusTx.target === 'GPIO' && (
                  <span className="text-purple-400 font-bold animate-pulse">ACTIVE</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Architectural Block Inspector & Beginner Tutor */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-full overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Info className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">回路ブロック・インスペクター</h2>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <div className="text-base font-bold text-slate-100">{selectedBlock.title}</div>
            <div className="text-xs font-mono text-cyan-400 mt-0.5">{selectedBlock.subtitle}</div>
          </div>

          {/* Beginner friendly tutorial box */}
          <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/40 rounded-lg">
            <div className="text-xs font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
              <span>初心者向けワンポイント解説</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {selectedBlock.beginnerNote}
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1">ハードウェア機能と役割</div>
            <p className="text-xs leading-relaxed text-slate-300">
              {selectedBlock.purpose}
            </p>
          </div>

          {/* Pinout lists */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">入力ピン (Inputs)</span>
              <ul className="space-y-1 font-mono text-[11px] text-slate-300">
                {selectedBlock.inputs.map((pin, i) => (
                  <li key={i} className="truncate">• {pin}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">出力ピン (Outputs)</span>
              <ul className="space-y-1 font-mono text-[11px] text-slate-300">
                {selectedBlock.outputs.map((pin, i) => (
                  <li key={i} className="truncate">• {pin}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Verilog RTL Snippet */}
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1.5">
              対応する SystemVerilog RTL 実装
            </span>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300/90 overflow-x-auto">
              <code>{selectedBlock.verilogSample}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
