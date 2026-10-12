import React from 'react';
import { Cpu, Play, Pause, RotateCcw, ShieldCheck, HelpCircle, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onReset: () => void;
  onOpenGuide: () => void;
  onOpenDrc: () => void;
  drcWarningCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isRunning,
  onToggleRun,
  onStep,
  onReset,
  onOpenGuide,
  onOpenDrc,
  drcWarningCount,
}) => {
  const tabs = [
    { id: 'schematic', label: 'アーキテクチャ回路図' },
    { id: 'simulation', label: 'シミュレータ & レジスタ' },
    { id: 'waveform', label: 'Surfer 波形ビューア' },
    { id: 'terminal', label: 'UART ターミナル' },
    { id: 'floorplan', label: 'GDSII 物理レイアウト' },
    { id: 'rtl', label: 'RTL コード生成' },
    { id: 'milestones', label: '計画書進捗 (M1-M4)' },
  ];

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Cpu className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <a href="#" className="text-base font-bold tracking-tight text-white whitespace-nowrap hover:text-cyan-400 transition-colors">
            Axral Chip Studio
          </a>
          <span className="text-[11px] text-slate-400 tracking-wide">
            64-bit RISC-V SoC EDA
          </span>
        </div>
      </div>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-400">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`transition-colors whitespace-nowrap py-1 relative cursor-pointer ${
                isActive ? 'text-cyan-400 font-semibold' : 'hover:text-slate-200'
              }`}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Functional Actions & Simulator Bar */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Step & Run controls */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={onStep}
            disabled={isRunning}
            title="1クロックサイクル進む"
            className="px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-40"
          >
            Step
          </button>
          <button
            onClick={onToggleRun}
            className={`px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3 h-3 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run</span>
              </>
            )}
          </button>
          <button
            onClick={onReset}
            title="シミュレーションをリセット"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* DRC Rule Check Button */}
        <button
          onClick={onOpenDrc}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
            drcWarningCount > 0
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {drcWarningCount > 0 ? (
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="tabular-nums">DRC {drcWarningCount > 0 ? `(${drcWarningCount})` : 'OK'}</span>
        </button>

        {/* Beginner Guide */}
        <button
          onClick={onOpenGuide}
          className="px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 rounded-lg hover:bg-cyan-900/60 transition-colors flex items-center gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>初心者ガイド</span>
        </button>
      </div>
    </header>
  );
};
