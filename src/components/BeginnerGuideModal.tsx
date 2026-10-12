import React, { useState } from 'react';
import { X, BookOpen, Cpu, Layers, GitBranch, Zap, Sparkles, ChevronRight } from 'lucide-react';

interface BeginnerGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BeginnerGuideModal: React.FC<BeginnerGuideModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: '1. 自作64bit RISC-V SoC の全体像',
      icon: Cpu,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            このエディタは、<strong>自作の64ビット RISC-V (RV64I) CPU と SoC (System on Chip)</strong> を設計し、
            最終的に半導体工場に送る <strong>GDSII (回路配置データ)</strong> までを一貫して作成できるプロフェッショナルEDAツールです。
          </p>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
            <span className="font-bold text-white block mb-1">なぜ「64ビット」なのか？</span>
            RV32I (32ビット) が扱えるメモリは最大4GBですが、RV64I (64ビット) は最大 <strong>16エクサバイト (160億GB)</strong> のアドレス空間を扱えます。
            将来 Linux をブートさせたり、本格的な64ビットOSを走らせるための必須アーキテクチャです。
          </div>
        </div>
      ),
    },
    {
      title: '2. CPUコアの5つの心臓部 (IF / ID / EX / MEM / WB)',
      icon: GitBranch,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            CPUは1つの命令を以下の5つのステージに分解して、ベルトコンベア式に並列実行します（パイプライン処理）：
          </p>
          <ul className="space-y-2 text-slate-300">
            <li className="p-2 bg-slate-900 rounded border border-slate-800">
              <strong className="text-cyan-400">1. Fetch (IF):</strong> プログラムカウンタ(PC)が指す番地から32bitの機械語命令をメモリから読み出します。
            </li>
            <li className="p-2 bg-slate-900 rounded border border-slate-800">
              <strong className="text-cyan-400">2. Decode (ID):</strong> 命令を解読し、32本のレジスタファイル(x0〜x31)からデータを取り出し、数値を64ビットへ符号拡張します。
            </li>
            <li className="p-2 bg-slate-900 rounded border border-slate-800">
              <strong className="text-cyan-400">3. Execute (EX):</strong> 64ビットALUが足し算・引き算・論理演算・シフトを行い、分岐成立を判定します。
            </li>
            <li className="p-2 bg-slate-900 rounded border border-slate-800">
              <strong className="text-cyan-400">4. Memory (MEM):</strong> ロード(LD)やストア(SD)命令のとき、Wishboneバス経由でRAMや周辺回路へアクセスします。
            </li>
            <li className="p-2 bg-slate-900 rounded border border-slate-800">
              <strong className="text-cyan-400">5. Writeback (WB):</strong> 計算結果をレジスタへ書き戻します（x0は常に0のまま不変）。
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: '3. ハザード対策とフォワーディングの魔法',
      icon: Zap,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            パイプラインでは「前の命令が計算した値を、直後の命令がすぐに使いたい」という場面が頻発します（データハザード）。
          </p>
          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg">
            <strong className="text-cyan-300 block mb-1">フォワーディング回路の仕組み:</strong>
            前の命令の計算結果が「レジスタへ書き戻される(WB)」のを待たずに、
            EXステージやMEMステージから直ちに次の命令の入力へ<strong>バイパス線で手渡し</strong>します。
            これによりCPUが立ち止まる(Stall)ことなく、理論上の限界である <strong>CPI = 1.0 (毎サイクル1命令完了)</strong> を達成できます！
          </div>
        </div>
      ),
    },
    {
      title: '4. SoC化の要「Wishboneバス」と周辺回路',
      icon: Layers,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            CPU単体ではただの電卓ですが、外の世界と結ぶことで「コンピュータ」になります：
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
              <strong className="text-amber-400 block">UART (0x30000000)</strong>
              iPadの画面にシリアル文字（"Hello World"など）を出力するチップの「声」です。
            </div>
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
              <strong className="text-emerald-400 block">CLINT (0x20000000)</strong>
              毎秒時を刻むタイマ。OSのマルチタスク切り替えや時間計測の土台です。
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            これらを繋ぐオープン規格が <strong>Wishbone B4 バス</strong> です。アドレスの上位ビットで宛先の回路を自動選択します。
          </p>
        </div>
      ),
    },
    {
      title: '5. 半導体製造への架け橋 (OpenLane & GDSII)',
      icon: Sparkles,
      content: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p>
            論理回路(RTL)ができたら、物理的なシリコンウェハーの上にトランジスタと金属配線を焼き付ける作業（物理配置配線: P&R）を行います。
          </p>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
            <strong className="text-white block mb-1">SkyWater sky130 と ASAP7:</strong>
            SkyWater 130nm PDK は世界中でオープンに半導体を製造できる標準PDKです。
            本エディタは OpenLane 2 用の <code>config.json</code> と synthesizable Verilog を自動生成するため、そのままオープンシリコン製造フローへ流し込めます！
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">初心者向けガイド: 自作64bit RISC-V SoC 設計読本</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex gap-2 overflow-x-auto">
          {steps.map((st, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                currentStep === i
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Step {i + 1}
            </button>
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          <h4 className="text-base font-bold text-white mb-4">
            {steps[currentStep].title}
          </h4>
          {steps[currentStep].content}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
          >
            前へ
          </button>

          <span className="text-xs text-slate-400">
            {currentStep + 1} / {steps.length}
          </span>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
              className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <span>次へ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
            >
              ガイドを閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
