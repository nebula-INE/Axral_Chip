import React, { useState } from 'react';
import { WaveformSample } from '../types/chip';
import { formatHex64 } from '../sim/riscv64';
import { Activity, ZoomIn, ZoomOut, RotateCcw, Download, Info } from 'lucide-react';

interface WaveformViewProps {
  waveforms: WaveformSample[];
  currentCycle: number;
}

export const WaveformView: React.FC<WaveformViewProps> = ({ waveforms, currentCycle }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(36); // px per cycle
  const [selectedCycle, setSelectedCycle] = useState<number | null>(null);

  // Fallback to recent sample or default
  const samples = waveforms.length > 0 ? waveforms : [];
  const activeCycle = selectedCycle !== null ? selectedCycle : currentCycle;
  const activeSample = samples.find((s) => s.cycle === activeCycle) || samples[samples.length - 1];

  const signals = [
    { name: 'clk', type: 'bit', getVal: (s: WaveformSample) => s.clk, color: '#38bdf8' },
    { name: 'rst_n', type: 'bit', getVal: (s: WaveformSample) => s.rst_n, color: '#34d399' },
    { name: 'pc[63:0]', type: 'bus', getVal: (s: WaveformSample) => `0x${s.pc.toString(16).slice(-6)}`, color: '#67e8f9' },
    { name: 'instr[31:0]', type: 'bus', getVal: (s: WaveformSample) => `0x${s.instr.toString(16).padStart(8, '0')}`, color: '#fbbf24' },
    { name: 'alu_res[63:0]', type: 'bus', getVal: (s: WaveformSample) => `0x${s.alu_res.toString(16).slice(-6)}`, color: '#f472b6' },
    { name: 'reg_we', type: 'bit', getVal: (s: WaveformSample) => s.reg_we ? 1 : 0, color: '#a78bfa' },
    { name: 'wb_cyc', type: 'bit', getVal: (s: WaveformSample) => s.wb_cyc ? 1 : 0, color: '#38bdf8' },
    { name: 'wb_stb', type: 'bit', getVal: (s: WaveformSample) => s.wb_stb ? 1 : 0, color: '#38bdf8' },
    { name: 'wb_we', type: 'bit', getVal: (s: WaveformSample) => s.wb_we ? 1 : 0, color: '#f59e0b' },
    { name: 'wb_adr[63:0]', type: 'bus', getVal: (s: WaveformSample) => `0x${s.wb_adr.toString(16).slice(-8)}`, color: '#6ee7b7' },
    { name: 'wb_dat[63:0]', type: 'bus', getVal: (s: WaveformSample) => `0x${s.wb_dat.toString(16).slice(-8)}`, color: '#6ee7b7' },
    { name: 'wb_ack', type: 'bit', getVal: (s: WaveformSample) => s.wb_ack ? 1 : 0, color: '#10b981' },
    { name: 'uart_tx', type: 'bit', getVal: (s: WaveformSample) => s.uart_tx, color: '#fb923c' },
    { name: 'hazard_stall', type: 'bit', getVal: (s: WaveformSample) => s.hazard_stall ? 1 : 0, color: '#ef4444' },
    { name: 'hazard_forward', type: 'bit', getVal: (s: WaveformSample) => s.hazard_forward ? 1 : 0, color: '#10b981' },
  ];

  // Generate standard VCD file content
  const exportVcd = () => {
    let vcd = `$date\n  ${new Date().toISOString()}\n$end\n`;
    vcd += `$version\n  Axral Chip Studio VCD Generator v1.0 (Surfer Compatible)\n$end\n`;
    vcd += `$timescale 1ns $end\n`;
    vcd += `$scope module axral_soc_top $end\n`;
    vcd += `$var wire 1 ! clk $end\n`;
    vcd += `$var wire 1 " rst_n $end\n`;
    vcd += `$var wire 64 # pc [63:0] $end\n`;
    vcd += `$var wire 32 $ instr [31:0] $end\n`;
    vcd += `$var wire 64 % alu_res [63:0] $end\n`;
    vcd += `$var wire 1 & reg_we $end\n`;
    vcd += `$var wire 1 ' wb_cyc $end\n`;
    vcd += `$var wire 1 ( wb_stb $end\n`;
    vcd += `$var wire 1 ) wb_we $end\n`;
    vcd += `$var wire 64 * wb_adr [63:0] $end\n`;
    vcd += `$var wire 1 + uart_tx $end\n`;
    vcd += `$upscope $end\n`;
    vcd += `$enddefinitions $end\n#0\n$dumpvars\n`;

    samples.forEach((s) => {
      const timeNs = s.cycle * 10;
      vcd += `#${timeNs}\n`;
      vcd += `${s.clk}!\n`;
      vcd += `${s.rst_n}"\n`;
      vcd += `b${s.pc.toString(2).padStart(64, '0')} #\n`;
      vcd += `b${s.instr.toString(2).padStart(32, '0')} $\n`;
      vcd += `b${s.alu_res.toString(2).padStart(64, '0')} %\n`;
      vcd += `${s.reg_we ? 1 : 0}&\n`;
      vcd += `${s.wb_cyc ? 1 : 0}'\n`;
      vcd += `${s.wb_stb ? 1 : 0}(\n`;
      vcd += `${s.wb_we ? 1 : 0})\n`;
      vcd += `b${s.wb_adr.toString(2).padStart(64, '0')} *\n`;
      vcd += `${s.uart_tx}+\n`;
    });

    const blob = new Blob([vcd], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `axral_soc_trace_cycle${currentCycle}.vcd`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Waveform Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Surfer 準拠 デジタル波形ビューア (VCD/FST)</h2>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            (Plan.md 1.2 & M1: iPad Safari 最適化 / WASM Surfer 連携)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(16, z - 8))}
              className="p-1.5 text-slate-400 hover:text-white rounded cursor-pointer"
              title="縮小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-2 text-slate-400 tabular-nums">
              {zoomLevel}px/cyc
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(80, z + 8))}
              className="p-1.5 text-slate-400 hover:text-white rounded cursor-pointer"
              title="拡大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setSelectedCycle(null)}
            className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>最新へ追従</span>
          </button>

          <button
            onClick={exportVcd}
            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>VCDファイル保存</span>
          </button>
        </div>
      </div>

      {/* Selected Time Marker Inspector */}
      {activeSample && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <span>カーソル位置:</span>
            <span className="text-white bg-slate-800 px-2 py-0.5 rounded tabular-nums">
              Cycle {activeSample.cycle}
            </span>
          </div>
          <div className="text-slate-400">
            PC: <span className="text-cyan-400">{formatHex64(activeSample.pc)}</span>
          </div>
          <div className="text-slate-400">
            ALU: <span className="text-pink-400">{formatHex64(activeSample.alu_res)}</span>
          </div>
          <div className="text-slate-400">
            Wishbone:{' '}
            <span className={activeSample.wb_cyc ? 'text-emerald-400' : 'text-slate-600'}>
              {activeSample.wb_cyc ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>
          {activeSample.hazard_stall && (
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded text-[10px] uppercase font-bold">
              PIPELINE STALL
            </span>
          )}
        </div>
      )}

      {/* Main Waveform Canvas */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl flex-1 flex flex-col overflow-hidden">
        {/* Timing Ruler Header */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10">
          <div className="w-48 shrink-0 px-4 py-2 text-xs font-semibold text-slate-400 border-r border-slate-800">
            信号名 (Signals)
          </div>
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center h-8">
            <div
              className="flex relative h-full items-center"
              style={{ width: `${Math.max(1, samples.length) * zoomLevel}px` }}
            >
              {samples.map((s, idx) => (
                <div
                  key={s.cycle}
                  onClick={() => setSelectedCycle(s.cycle)}
                  style={{ width: `${zoomLevel}px` }}
                  className={`h-full border-r border-slate-800/80 flex items-center justify-center text-[10px] font-mono select-none cursor-pointer hover:bg-slate-800/40 ${
                    s.cycle === activeCycle ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-500'
                  }`}
                >
                  {s.cycle % 2 === 0 || zoomLevel >= 40 ? s.cycle : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Signals Traces Rows */}
        <div className="flex-1 overflow-y-auto overflow-x-auto divide-y divide-slate-900">
          {signals.map((sig) => (
            <div key={sig.name} className="flex h-11 items-center hover:bg-slate-900/40 group">
              {/* Signal Name Label */}
              <div className="w-48 shrink-0 px-4 flex items-center justify-between text-xs font-mono text-slate-300 border-r border-slate-800 bg-slate-950/80 group-hover:bg-slate-900/80 h-full">
                <span className="truncate">{sig.name}</span>
                <span className="text-[10px] text-slate-500 uppercase">{sig.type}</span>
              </div>

              {/* Signal Waveform Visual Track */}
              <div
                className="flex relative h-full items-center shrink-0"
                style={{ width: `${Math.max(1, samples.length) * zoomLevel}px` }}
              >
                {samples.map((s, idx) => {
                  const val = sig.getVal(s);
                  const isSelected = s.cycle === activeCycle;

                  return (
                    <div
                      key={s.cycle}
                      onClick={() => setSelectedCycle(s.cycle)}
                      style={{ width: `${zoomLevel}px` }}
                      className={`h-full border-r border-slate-900/50 relative flex items-center justify-center px-1 cursor-pointer ${
                        isSelected ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      {sig.type === 'bit' ? (
                        // 1-bit Square Wave Track
                        <div className="w-full h-6 relative flex items-center">
                          {val === 1 ? (
                            <div
                              className="w-full h-4 border-t-2 border-l border-r rounded-t-sm"
                              style={{ borderColor: sig.color, backgroundColor: `${sig.color}15` }}
                            />
                          ) : (
                            <div
                              className="w-full h-1 border-b-2"
                              style={{ borderColor: sig.color, opacity: 0.6 }}
                            />
                          )}
                        </div>
                      ) : (
                        // Multi-bit Bus Transition Box
                        <div
                          className="w-full h-5 rounded border flex items-center justify-center px-1 overflow-hidden"
                          style={{
                            borderColor: `${sig.color}60`,
                            backgroundColor: `${sig.color}10`,
                          }}
                        >
                          <span
                            className="text-[10px] font-mono truncate"
                            style={{ color: sig.color }}
                          >
                            {String(val)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
