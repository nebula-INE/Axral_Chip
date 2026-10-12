import React, { useState } from 'react';
import { RegisterState, PipelineStageInfo, AssembledInstruction } from '../types/chip';
import { formatHex64, toSigned64 } from '../sim/riscv64';
import { SAMPLE_PROGRAMS, SampleProgram } from '../sim/samples';
import { Play, Pause, RotateCcw, FastForward, FileCode2, Search, AlertCircle, CheckCircle } from 'lucide-react';

interface SimulationViewProps {
  assemblyCode: string;
  onChangeAssembly: (code: string) => void;
  onLoadSample: (sample: SampleProgram) => void;
  instructions: AssembledInstruction[];
  assembleErrors: string[];
  registers: RegisterState[];
  stages: PipelineStageInfo[];
  pc: bigint;
  cycleCount: number;
  instructionsRetired: number;
  isHalted: boolean;
  haltReason: string;
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onStep10: () => void;
  onReset: () => void;
  runSpeedMs: number;
  onChangeSpeed: (ms: number) => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({
  assemblyCode,
  onChangeAssembly,
  onLoadSample,
  instructions,
  assembleErrors,
  registers,
  stages,
  pc,
  cycleCount,
  instructionsRetired,
  isHalted,
  haltReason,
  isRunning,
  onToggleRun,
  onStep,
  onStep10,
  onReset,
  runSpeedMs,
  onChangeSpeed,
}) => {
  const [regSearch, setRegSearch] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'hex' | 'dec'>('hex');

  // Filter registers
  const filteredRegisters = registers.filter(
    (r) =>
      r.name.toLowerCase().includes(regSearch.toLowerCase()) ||
      r.abi.toLowerCase().includes(regSearch.toLowerCase())
  );

  const cpi = instructionsRetired > 0 ? (cycleCount / instructionsRetired).toFixed(2) : '1.00';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Left 7 Columns: Assembly Editor & Program Controls */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Editor Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">サンプルプログラム:</span>
            <select
              onChange={(e) => {
                const sample = SAMPLE_PROGRAMS.find((s) => s.id === e.target.value);
                if (sample) onLoadSample(sample);
              }}
              defaultValue={SAMPLE_PROGRAMS[0].id}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              {SAMPLE_PROGRAMS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stepping and Execution Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onStep}
              disabled={isRunning || isHalted}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Step (1cyc)
            </button>
            <button
              onClick={onStep10}
              disabled={isRunning || isHalted}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
            >
              +10 cyc
            </button>
            <button
              onClick={onToggleRun}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isRunning ? 'Pause' : 'Run'}</span>
            </button>
            <button
              onClick={onReset}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="リセット"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Execution Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 font-medium">現在 PC (64b)</div>
            <div className="text-sm font-mono font-bold text-cyan-400 tabular-nums mt-0.5">
              {formatHex64(pc)}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 font-medium">サイクル数 (Clock)</div>
            <div className="text-sm font-mono font-bold text-slate-200 tabular-nums mt-0.5">
              {cycleCount} cyc
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 font-medium">完了命令数 (Retired)</div>
            <div className="text-sm font-mono font-bold text-slate-200 tabular-nums mt-0.5">
              {instructionsRetired} inst
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 font-medium">CPI (Cycles/Inst)</div>
            <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
              {cpi}
            </div>
          </div>
        </div>

        {/* Halt notification banner */}
        {isHalted && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{haltReason}</span>
            </div>
            <button
              onClick={onReset}
              className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-semibold rounded hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              最初から再実行
            </button>
          </div>
        )}

        {/* Assembler Error alert */}
        {assembleErrors.length > 0 && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>アセンブラエラー: {assembleErrors[0]}</span>
          </div>
        )}

        {/* Assembly Code Editor & Disassembly synchronized view */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl flex flex-col flex-1 overflow-hidden min-h-[360px]">
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>RISC-V 64bit アセンブリソース (RV64I)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">速度:</span>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={runSpeedMs}
                onChange={(e) => onChangeSpeed(Number(e.target.value))}
                className="w-20 accent-cyan-500"
              />
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">{runSpeedMs}ms</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 flex-1">
            {/* Left: Raw Assembly Textarea */}
            <div className="flex flex-col h-full">
              <div className="px-3 py-1.5 bg-slate-950/60 text-[11px] text-slate-500 border-b border-slate-800/60">
                編集可能テキストエディタ
              </div>
              <textarea
                value={assemblyCode}
                onChange={(e) => onChangeAssembly(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-slate-950 p-3 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 leading-relaxed"
                placeholder="# RISC-V RV64I assembly here..."
              />
            </div>

            {/* Right: Compiled Binary & Memory Map with Active PC Cursor */}
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="px-3 py-1.5 bg-slate-950/60 text-[11px] text-slate-500 border-b border-slate-800/60">
                メモリ配置 & 機械語 (Spike ISA 照合対応)
              </div>
              <div className="p-2 space-y-1">
                {instructions.map((inst, idx) => {
                  const isCurrentPc = inst.address === pc;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                        isCurrentPc
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-semibold'
                          : 'text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{`0x${inst.address.toString(16).padStart(4, '0')}:`}</span>
                        <span className="text-amber-400/90">{`0x${inst.raw.toString(16).padStart(8, '0')}`}</span>
                        <span className={isCurrentPc ? 'text-cyan-300' : 'text-slate-300'}>{inst.asm}</span>
                      </div>
                      {isCurrentPc && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-cyan-400 text-slate-950 rounded font-bold">
                          EXEC
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right 5 Columns: 64-bit Register File & Pipeline Stages */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Pipeline Stages Active Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              パイプライン段の状態
            </h3>
            <span className="text-[11px] font-mono text-cyan-400">
              {stages.length}段構成
            </span>
          </div>

          <div className="space-y-2">
            {stages.map((stg, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-mono transition-colors ${
                  stg.hazardStatus === 'stalled'
                    ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                    : stg.hazardStatus === 'forwarded'
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-200">{stg.name}</div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {stg.instrDisasm}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-cyan-400">{stg.details}</div>
                  {stg.hazardStatus !== 'normal' && (
                    <span className="text-[10px] uppercase font-bold text-amber-400">
                      {stg.hazardStatus}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 64-bit Register File Inspector */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col flex-1 overflow-hidden min-h-[420px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">64-bit レジスタファイル (x0-x31)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5 text-[11px]">
                <button
                  onClick={() => setSelectedFormat('hex')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedFormat === 'hex' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
                  }`}
                >
                  HEX
                </button>
                <button
                  onClick={() => setSelectedFormat('dec')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    selectedFormat === 'dec' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
                  }`}
                >
                  DEC
                </button>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative my-2.5">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={regSearch}
              onChange={(e) => setRegSearch(e.target.value)}
              placeholder="レジスタ検索 (例: ra, a0, x10)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
            />
          </div>

          {/* High-density registers list */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredRegisters.map((reg) => {
              const isNonZero = reg.value !== 0n;
              const formattedVal =
                selectedFormat === 'hex'
                  ? formatHex64(reg.value)
                  : toSigned64(reg.value).toString();

              return (
                <div
                  key={reg.index}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                    isNonZero
                      ? 'bg-slate-950 border-cyan-500/30 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-8 font-semibold text-slate-300">{reg.name}</span>
                    <span className="w-10 text-[11px] text-slate-500">{reg.abi}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`tabular-nums ${isNonZero ? 'text-cyan-300 font-bold' : 'text-slate-500'}`}>
                      {formattedVal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
