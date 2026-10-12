import React, { useState } from 'react';
import { CpuConfig } from '../types/chip';
import { generateAxralCoreRtl, generateAxralSocRtl, generateOpenLaneConfig } from '../sim/rtlGenerator';
import { FileCode, Copy, Check, Download } from 'lucide-react';

interface RtlCodeViewProps {
  config: CpuConfig;
}

export const RtlCodeView: React.FC<RtlCodeViewProps> = ({ config }) => {
  const [selectedFile, setSelectedFile] = useState<string>('axral_core.sv');
  const [copied, setCopied] = useState<boolean>(false);

  const testbenchCode = `//=============================================================================
// Testbench: tb_axral_soc
// Verified against Verilator & Icarus Verilog (Plan.md Phase 1 / Phase 2)
//=============================================================================
\`timescale 1ns/1ps

module tb_axral_soc;
    reg clk;
    reg rst_n;
    wire uart_tx;
    wire [7:0] leds;

    // DUT instantiation
    axral_soc_top dut (
        .clk_i(clk),
        .rst_ni(rst_n),
        .uart_rx_i(1'b1),
        .uart_tx_o(uart_tx),
        .gpio_leds_o(leds),
        .gpio_switches_i(8'h00)
    );

    // 50MHz Clock Generation
    always #10 clk = ~clk;

    initial begin
        $dumpfile("axral_sim.vcd");
        $dumpvars(0, tb_axral_soc);

        clk = 0;
        rst_n = 0;
        #100;
        rst_n = 1;
        #50000;
        $finish;
    end
endmodule
`;

  const files: Record<string, { content: string; language: string; desc: string }> = {
    'axral_core.sv': {
      content: generateAxralCoreRtl(config),
      language: 'systemverilog',
      desc: '64-bit RISC-V RV64I CPU コア本体 (ALU, 32x64bレジスタ, デコーダ, パイプライン)',
    },
    'axral_soc.sv': {
      content: generateAxralSocRtl(config),
      language: 'systemverilog',
      desc: 'Wishbone バス、RAM、UART、CLINT タイマ、GPIO を統合した SoC トップモジュール',
    },
    'openlane_config.json': {
      content: generateOpenLaneConfig(config),
      language: 'json',
      desc: 'OpenLane 2 / sky130 / ASAP7 自動配置配線・GDSII生成用設定ファイル',
    },
    'tb_axral_soc.sv': {
      content: testbenchCode,
      language: 'systemverilog',
      desc: 'Verilator / Icarus Verilog 用のシミュレーション検証テストベンチ',
    },
  };

  const currentFile = files[selectedFile] || files['axral_core.sv'];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile;
    a.click;
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top File Switcher Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Object.keys(files).map((fileName) => (
            <button
              key={fileName}
              onClick={() => setSelectedFile(fileName)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedFile === fileName
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{fileName}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'コピー完了' : 'コードをコピー'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ファイルをダウンロード</span>
          </button>
        </div>
      </div>

      {/* File Description Banner */}
      <div className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400">
        <span className="font-semibold text-slate-200">{selectedFile}:</span> {currentFile.desc}
      </div>

      {/* Code Display Canvas */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed">
        <pre className="whitespace-pre">
          <code>{currentFile.content}</code>
        </pre>
      </div>
    </div>
  );
};
