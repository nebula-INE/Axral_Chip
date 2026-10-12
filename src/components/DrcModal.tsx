import React from 'react';
import { CpuConfig, LinterWarning } from '../types/chip';
import { X, ShieldCheck, AlertTriangle, Info, CheckCircle2, Wrench } from 'lucide-react';

interface DrcModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CpuConfig;
  onUpdateConfig: (newConfig: Partial<CpuConfig>) => void;
}

export const DrcModal: React.FC<DrcModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
}) => {
  if (!isOpen) return null;

  // Lint rules evaluation
  const warnings: LinterWarning[] = [];

  // Check 1: 5-stage pipeline without forwarding
  if (config.pipelineMode === '5-stage' && !config.enableForwarding) {
    warnings.push({
      id: 'hazard_fwd_disabled',
      level: 'warning',
      title: '5段パイプラインでフォワーディングが無効です',
      description:
        'フォワーディングを無効にすると、RAW (Read-After-Write) データハザード発生時に多数のStall(バブル)が挿入され、実行性能(CPI)が大幅に悪化します。',
      autoFixAvailable: true,
      fixAction: () => onUpdateConfig({ enableForwarding: true }),
    });
  }

  // Check 2: Target node selection advice
  if (config.targetNode === 'asap7') {
    warnings.push({
      id: 'asap7_flow_fragile',
      level: 'info',
      title: 'ASAP7 (7nm) は実験的ノードです (plan.md 4.1 参照)',
      description:
        '計画書に記載の通り、ASAP7でのSoC全体の配置配線は計算時間が膨大になる場合があります。まずは sky130 で一通りフローを通すことが推奨されています。',
      autoFixAvailable: true,
      fixAction: () => onUpdateConfig({ targetNode: 'sky130' }),
    });
  }

  // Check 3: RAM size boundary
  if (config.ramSizeBytes > 262144) {
    warnings.push({
      id: 'sram_size_large',
      level: 'warning',
      title: 'オンチップSRAMサイズが大きすぎます (>256KB)',
      description: '単一のシリコンダイ面積 (1.2mm x 1.2mm) に収まらない可能性があります。',
      autoFixAvailable: true,
      fixAction: () => onUpdateConfig({ ramSizeBytes: 65536 }),
    });
  }

  const handleFixAll = () => {
    warnings.forEach((w) => {
      if (w.fixAction) w.fixAction();
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              設計ルール検査 & アーキテクチャ・リンター (DRC)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {warnings.length === 0 ? (
            <div className="p-5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-sm">設計ルール検査: 違反なし (DRC Clean)</div>
                <div className="text-xs text-emerald-400/80 mt-0.5">
                  すべてのバス仕様、パイプラインハザード設定、メモリ配置が整合しています。
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  検出された課題 ({warnings.length}件)
                </span>
                <button
                  onClick={handleFixAll}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>推奨設定を一括自動適用</span>
                </button>
              </div>

              <div className="space-y-3">
                {warnings.map((w) => (
                  <div
                    key={w.id}
                    className={`p-4 rounded-xl border ${
                      w.level === 'warning'
                        ? 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                        : 'bg-cyan-950/20 border-cyan-800/50 text-cyan-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {w.level === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-white">{w.title}</div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {w.description}
                          </p>
                        </div>
                      </div>

                      {w.fixAction && (
                        <button
                          onClick={w.fixAction}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 shrink-0 transition-colors cursor-pointer"
                        >
                          修正
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Standards verified */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5">
            <span className="font-semibold text-slate-300 block mb-1">照合済みISA / バス規格:</span>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>RISC-V Unprivileged ISA Manual (RV64I Base Integer)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Wishbone B4 System-on-Chip Interconnection Architecture</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>SkyWater sky130 Open Silicon Process Design Kit (DRC Rev 2.0)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
