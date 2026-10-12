import React, { useState } from 'react';
import { Terminal, Trash2, Copy, Check, Radio, Send, Play } from 'lucide-react';

interface UartTerminalProps {
  outputBuffer: string;
  onClearBuffer: () => void;
  onRunM3Sample: () => void;
  cycleCount: number;
}

export const UartTerminal: React.FC<UartTerminalProps> = ({
  outputBuffer,
  onClearBuffer,
  onRunM3Sample,
  cycleCount,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'ascii' | 'hex'>('ascii');

  const handleCopy = () => {
    navigator.clipboard.writeText(outputBuffer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert buffer to hex dump
  const getHexDump = () => {
    return Array.from(outputBuffer)
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Controls & Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">
              UART 16550 シリアル端末 (仮想 iPad コンソール)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Base: 0x3000_0000 · 115,200 Baud · 8N1
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('ascii')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                viewMode === 'ascii' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
              }`}
            >
              ASCII 文字列
            </button>
            <button
              onClick={() => setViewMode('hex')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                viewMode === 'hex' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'
              }`}
            >
              HEX ダンプ
            </button>
          </div>

          <button
            onClick={onRunM3Sample}
            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Hello World テスト実行 (M3)</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-2.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'コピー完了' : 'コピー'}</span>
          </button>

          <button
            onClick={onClearBuffer}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="端末をクリア"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Screen Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl flex-1 flex flex-col overflow-hidden relative shadow-inner">
        {/* Terminal Header Bar */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="text-slate-300 font-semibold">/dev/ttyUSB0 (Connected via Tailscale / Remote Tunnel)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>受信バイト数: {outputBuffer.length} Bytes</span>
            <span>Clock: {cycleCount} cyc</span>
          </div>
        </div>

        {/* Terminal Screen Content */}
        <div className="flex-1 p-5 font-mono text-xs overflow-y-auto leading-relaxed select-text">
          {outputBuffer.length === 0 ? (
            <div className="text-slate-600 italic">
              -- シリアル出力待機中 --<br />
              CPUコアがWishboneバス経由で 0x30000000 へ書き込むと、ここに文字が表示されます。<br />
              上部の「Hello World テスト実行 (M3)」ボタンをクリックして送信テストを試してください。
            </div>
          ) : viewMode === 'ascii' ? (
            <pre className="text-emerald-400 whitespace-pre-wrap font-mono">
              {outputBuffer}
              <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 animate-pulse" />
            </pre>
          ) : (
            <pre className="text-cyan-400 whitespace-pre-wrap font-mono">
              {getHexDump()}
            </pre>
          )}
        </div>
      </div>

      {/* Architectural Context Card from plan.md */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs flex items-center justify-between">
        <div className="text-slate-300">
          <span className="font-semibold text-white">Plan.md Milestone M3 の達成要件:</span>
          <span className="ml-2 text-slate-400">
            自作SoC (RV64I コア + Wishboneバス + UART コントローラ) 上で "Hello World" が出力されること。
          </span>
        </div>
        <div className="text-emerald-400 font-mono font-bold text-xs">
          {outputBuffer.includes('Hello') ? '✓ M3 条件達成' : '未検証'}
        </div>
      </div>
    </div>
  );
};
