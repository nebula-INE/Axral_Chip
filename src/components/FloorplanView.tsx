import React, { useState } from 'react';
import { CpuConfig, MacroBlock } from '../types/chip';
import { generateOpenLaneConfig } from '../sim/rtlGenerator';
import { Layers, Download, CheckCircle, Sliders, Maximize2, ShieldCheck, Box } from 'lucide-react';

interface FloorplanViewProps {
  config: CpuConfig;
  onUpdateConfig: (newConfig: Partial<CpuConfig>) => void;
}

export const FloorplanView: React.FC<FloorplanViewProps> = ({ config, onUpdateConfig }) => {
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    substrate: true,
    nwell: true,
    poly: true,
    met1: true,
    met2: true,
    met3: true,
    met4_power: true,
    pads: true,
  });

  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);

  const isSky130 = config.targetNode === 'sky130';
  const dieSizeUm = isSky130 ? 1200 : 150;
  const coreMarginUm = isSky130 ? 60 : 10;

  const toggleLayer = (layer: string) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Physical macros placed on chip
  const macros: MacroBlock[] = [
    {
      id: 'core_stdcell',
      name: 'RV64I CPU Core (標準セル配置領域)',
      x: 12,
      y: 12,
      width: 44,
      height: 54,
      color: '#0284c7',
      type: 'core',
      description: 'RV64I 5段パイプライン、32x64bレジスタ、ALU、デコーダ (~41,200 standard cells)',
    },
    {
      id: 'sram_macro',
      name: 'OpenRAM 64KB SRAM Macro',
      x: 60,
      y: 12,
      width: 28,
      height: 40,
      color: '#10b981',
      type: 'sram',
      description: 'コンパイル済み密高集積SRAMメモリブロック (データ & コードキャッシュ兼用)',
    },
    {
      id: 'uart_macro',
      name: 'UART 16550 IP Block',
      x: 60,
      y: 56,
      width: 28,
      height: 18,
      color: '#f59e0b',
      type: 'uart',
      description: 'シリアル通信インターフェース、FIFOバッファ、ボーレート分周回路',
    },
    {
      id: 'clint_macro',
      name: 'CLINT Timer Block',
      x: 12,
      y: 70,
      width: 44,
      height: 16,
      color: '#8b5cf6',
      type: 'clint',
      description: 'リアルタイムタイマ mtime & 比較レジスタ mtimecmp 回路',
    },
  ];

  const downloadOpenLaneConfig = () => {
    const jsonStr = generateOpenLaneConfig(config);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openlane_${config.targetNode}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
      {/* Left 8 Columns: Interactive Silicon Canvas */}
      <div className="xl:col-span-8 flex flex-col gap-4">
        {/* Top Control Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">
                GDSII シリコンフロアプラン & 配置配線 (P&R)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              (Plan.md Phase 4 & M4: OpenLane 2 / PDK レイアウト鑑賞)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* PDK switch */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => onUpdateConfig({ targetNode: 'sky130' })}
                className={`px-3 py-1 rounded cursor-pointer ${
                  isSky130 ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
                }`}
              >
                SkyWater sky130 (130nm)
              </button>
              <button
                onClick={() => onUpdateConfig({ targetNode: 'asap7' })}
                className={`px-3 py-1 rounded cursor-pointer ${
                  !isSky130 ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
                }`}
              >
                ASAP7 (7nm FinFET)
              </button>
            </div>

            <button
              onClick={downloadOpenLaneConfig}
              className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>OpenLane config.json 保存</span>
            </button>
          </div>
        </div>

        {/* Physical Silicon Die Viewport */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center relative min-h-[480px] overflow-hidden select-none">
          {/* Die Area Container */}
          <div className="w-[360px] sm:w-[460px] aspect-square rounded-2xl border-4 border-slate-700 bg-slate-900 relative shadow-2xl p-6 flex flex-col justify-between overflow-hidden">
            {/* IO Pad Ring around boundary */}
            {activeLayers.pads && (
              <>
                {/* Top IO Pads */}
                <div className="absolute top-1 left-8 right-8 flex justify-between">
                  {['VDD', 'VSS', 'CLK', 'RST_N', 'UART_TX', 'UART_RX', 'VDD', 'VSS'].map((p, i) => (
                    <div
                      key={i}
                      className="w-4 h-3 bg-amber-400/90 border border-amber-600 rounded-xs flex items-center justify-center text-[7px] text-slate-950 font-bold"
                      title={`Pad: ${p}`}
                    >
                      {p.slice(0, 3)}
                    </div>
                  ))}
                </div>
                {/* Bottom IO Pads */}
                <div className="absolute bottom-1 left-8 right-8 flex justify-between">
                  {['GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5', 'GPIO6', 'GPIO7'].map((p, i) => (
                    <div
                      key={i}
                      className="w-4 h-3 bg-amber-400/90 border border-amber-600 rounded-xs flex items-center justify-center text-[7px] text-slate-950 font-bold"
                      title={`Pad: ${p}`}
                    >
                      {p.slice(0, 3)}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Core Boundary Box */}
            <div className="w-full h-full border-2 border-dashed border-cyan-500/40 rounded-xl relative p-3 bg-slate-950/80">
              {/* Power Stripes Mesh Overlay (Metal 4 & 5) */}
              {activeLayers.met4_power && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #38bdf8 2px, transparent 2px),
                      linear-gradient(to bottom, #f59e0b 2px, transparent 2px)
                    `,
                    backgroundSize: '36px 36px',
                  }}
                />
              )}

              {/* Standard cell rows fine texture */}
              {activeLayers.met1 && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-10"
                  style={{
                    backgroundImage: 'linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
                    backgroundSize: '100% 8px',
                  }}
                />
              )}

              {/* Placed Hard Macros & Core Standard Cell block */}
              {macros.map((m) => {
                const isSelected = selectedMacro === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMacro(m.id)}
                    style={{
                      left: `${m.x}%`,
                      top: `${m.y}%`,
                      width: `${m.width}%`,
                      height: `${m.height}%`,
                      borderColor: m.color,
                      backgroundColor: `${m.color}20`,
                    }}
                    className={`absolute rounded-lg border-2 p-2 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] ${
                      isSelected ? 'ring-2 ring-white shadow-lg' : ''
                    }`}
                  >
                    <div className="text-[10px] font-bold truncate text-white">
                      {m.name}
                    </div>
                    <div
                      className="text-[9px] font-mono truncate"
                      style={{ color: m.color }}
                    >
                      {m.type.toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scale Bar Indicator */}
            <div className="absolute bottom-2 right-3 flex items-center gap-1.5 text-[9px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
              <span className="w-6 h-0.5 bg-cyan-400 inline-block" />
              <span>{isSky130 ? '200 μm' : '25 μm'}</span>
            </div>
          </div>

          {/* Real Silicon Wafer Reference Card */}
          <div className="w-[360px] sm:w-[460px] mt-4 p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3">
            <img
              src="/src/assets/images/silicon_wafer_macro_1791788103423.jpg"
              alt="Silicon Wafer Fabrication Reference"
              className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="text-xs">
              <div className="font-bold text-slate-200">実製造ウェハー・ダイ配置イメージ</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                300mmウェハー上に約45,000個のAxral 64-bit SoCダイがタイリング配置されます。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right 4 Columns: Silicon Inspector & Layer Controls */}
      <div className="xl:col-span-4 flex flex-col gap-4">
        {/* Layer Visibility Stack */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white">レイヤー表示フィルター</h3>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            {[
              { id: 'pads', label: 'IO Pads & Seal Ring', color: '#f59e0b' },
              { id: 'met4_power', label: 'Metal 4/5 電源メッシュ (VDD/VSS)', color: '#38bdf8' },
              { id: 'met3', label: 'Metal 3 グローバル配線', color: '#a855f7' },
              { id: 'met2', label: 'Metal 2 垂直配線', color: '#ec4899' },
              { id: 'met1', label: 'Metal 1 セル内配線', color: '#10b981' },
              { id: 'poly', label: 'Polysilicon ゲート層', color: '#ef4444' },
              { id: 'nwell', label: 'N-Well / P-Well 拡散層', color: '#64748b' },
            ].map((layer) => (
              <label
                key={layer.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:bg-slate-950 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span className="text-slate-300 text-xs">{layer.label}</span>
                </div>
                <input
                  type="checkbox"
                  checked={activeLayers[layer.id] ?? true}
                  onChange={() => toggleLayer(layer.id)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Silicon Physical Parameters & DRC Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white">物理設計メトリクス (OpenROAD / Magic)</h3>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>DRC / LVS 合格</span>
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">PDK プロセスノード</span>
              <span className="text-cyan-300 font-semibold">{isSky130 ? 'SkyWater 130nm' : 'ASAP7 7nm FinFET'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">ダイ面積 (Die Size)</span>
              <span className="text-white">{isSky130 ? '1.20 mm x 1.20 mm' : '0.15 mm x 0.15 mm'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">コア利用率 (Core Util)</span>
              <span className="text-white">56.4 %</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">標準セル数 (Std Cells)</span>
              <span className="text-white">44,820 ゲート</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">動作周波数 (Fmax)</span>
              <span className="text-emerald-400 font-semibold">{isSky130 ? '50 MHz (20ns)' : '400 MHz (2.5ns)'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Setup Slack (WNS)</span>
              <span className="text-emerald-400 font-semibold">+ 1.84 ns (Timing Met)</span>
            </div>
          </div>

          {/* Selected Macro Inspector info */}
          {selectedMacro && (
            <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <div className="font-bold text-cyan-300 mb-1">
                選択マクロ: {macros.find((m) => m.id === selectedMacro)?.name}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {macros.find((m) => m.id === selectedMacro)?.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
