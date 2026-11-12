# 自作64bit RISC-V SoC 開発計画書 (plan.md) v3

## 📌 最終目標
* **アーキテクチャ**: RISC-V RV64I + Zicsr + Zifencei（段階的に RV64IMA → Linux 最低ライン。C拡張は後回し）/ 5段パイプライン
* **システム形態**: Wishbone 内部バス + UART(16550互換) + CLINT + RAM を統合した 64bit SoC
* **開発・運用環境**: 自宅PCをバックエンドとした、iPadからの完全リモート開発
* **ロマン枠 (ゴール)**:
  1. オープンPDK (sky130 → ASAP7) を用いた物理レイアウト (GDSII) の生成
  2. (将来) FPGA実装と物理動作、そして Linux ブート

### 🧭 全体方針
- **動くものを最速で1つ通す**（垂直スライス優先）
- **後戻りコストが高い項目（HDL言語、バス、CSR、メモリマップ、検証IF）は早期に決める**
- **Spike と常に突き合わせる**（RVFI トレース経由）
- **CI で回帰テストを自動化**し、iPad からの push だけで品質を維持する
- **各フェーズに目安期間を置き、超過したらスコープを削る**

---

## 🔒 早期決定事項（フェーズ1で確定させる）

| 項目 | 決定内容 | 備考 |
|------|----------|------|
| RTL記述言語 | **[ ] 要決定**（推奨: SystemVerilog。Verilator/Icarus/Yosys で十分扱える範囲に限定） | Chisel/Amaranth/SpinalHDL は iPad 運用ではビルド環境が重くなるため非推奨寄り |
| 検証インタフェース | **RVFI** をコアに実装 | Spike 突き合わせと riscv-formal の両方に使う |
| メモリマップ | **Spike / QEMU virt 互換** | 下表参照 |
| UART | **16550 互換** | OpenSBI / Linux がそのまま使える |
| バス | Wishbone（将来 AXI4-Lite ブリッジ） | |

### メモリマップ案（QEMU virt 互換）
| 領域 | ベースアドレス |
|------|----------------|
| CLINT | `0x0200_0000` |
| PLIC（将来） | `0x0C00_0000` |
| UART (16550) | `0x1000_0000` |
| RAM | `0x8000_0000` |

---

## 🛠️ 開発環境の構築 (フェーズ1) ― 目安: 1週間

### 1.1 リモート接続基盤
- [ ] **PC側**
  - [ ] Linux環境 (Ubuntu 22.04 LTS 以降 / WSL2)
  - [ ] OpenSSH サーバー + 鍵認証
  - [ ] Tailscale 導入（ポート開放不要・推奨）
  - [ ] VS Code Remote - Tunnels（補助）
- [ ] **iPad側**
  - [ ] 物理キーボード・トラックパッド
  - [ ] Blink Shell / Termius
  - [ ] VS Code for the Web
  - [ ] **作業ファイルは必ず Linux 側 FS に置く**（WSL2 の `/mnt/c/...` は激遅）

### 1.2 EDA・ツールチェーン
- [ ] **シミュレータ**
  - [ ] Icarus Verilog（4-state、初期デバッグ）
  - [ ] Verilator（高速、回帰・最終検証）
  - [ ] cocotb（回帰テストの主力）
- [ ] **波形ビューア**
  - [ ] **Surfer**（WASM版、iPad Safari で VCD/FST 閲覧）★本命
  - [ ] ❌ X11 forwarding + GTKWave は非推奨
- [ ] **RISC-V ツールチェーン**
  - [ ] `riscv64-unknown-elf-gcc`
  - [ ] `riscv64-linux-gnu-gcc`（将来）
  - [ ] **Spike (riscv-isa-sim)**
- [ ] **形式的検証**
  - [ ] Yosys + SymbiYosys
  - [ ] riscv-formal（RVFI 採用後に導入）

### 1.3 開発基盤
- [ ] Git リポジトリ作成
- [ ] GitHub Actions CI（Verilator lint → シミュレーション → riscv-tests）
- [ ] 上記「早期決定事項」の確定とリポジトリ README への記載

### ✅ M1 完了条件
> **iPad から Verilator の Hello World を回し、VCD を Surfer で iPad に表示できる**

---

## 💻 64bit CPUコア単体の設計 (フェーズ2) ― 目安: 2〜3ヶ月

### 2.1 ステップ1：単一サイクル実行モデル（1〜2週）
- [ ] **RISC-V仕様書の読解**
  - [ ] RV64I の命令セットと命令フォーマット (R/I/S/B/U/J)
  - [ ] RV64I 追加分の整理:
    - 64bit ロード/ストア: `LWU` / `LD` / `SD`
    - 32bit 演算（W系）: `ADDIW` / `SLLIW` / `SRLIW` / `SRAIW` / `ADDW` / `SUBW` / `SLLW` / `SRLW` / `SRAW`
    - シフト量 6bit 化（`SLL/SRL/SRA/SLLI/SRLI/SRAI`）
- [ ] **各回路の実装**
  - [ ] PC制御、フェッチ、デコード + 制御信号生成
  - [ ] レジスタファイル（64bit × 32本、x0 は常に0）
  - [ ] ALU（W系の符号拡張に注意）
  - [ ] 即値生成器
- [ ] **最初の1命令の検証**
  - [ ] `addi x1, x0, 42` → `x1 == 42` を cocotb で自動検証

### 2.2 ステップ2：全基本命令 + RVFI + Spike協調（2〜3週）
- [ ] ロード/ストア（符号/ゼロ拡張）、分岐、JAL/JALR、シフト・論理・算術の全網羅
- [ ] `FENCE` / `FENCE.I`（Zifencei）は当面 NOP 相当で可
- [ ] **RVFI トレース出力をコアに実装**
- [ ] **Spike と retire 単位で突き合わせる仕組み**

### 2.3 ステップ3：最小CSR / M-modeトラップ（★v3で追加、1〜2週）
riscv-tests / riscv-arch-test のハーネスが必要とするため、フェーズ2で入れる。
- [ ] Zicsr（`CSRRW/CSRRS/CSRRC` と即値版）
- [ ] CSR: `mstatus` `mtvec` `mepc` `mcause` `mtval` `mscratch` `misa` `mhartid` `mie` `mip`
- [ ] `ecall` / `ebreak` / `mret`
- [ ] 例外: 不正命令、ミスアライン、ecall、ebreak
- [ ] M-mode のみ（S/U と MMU はフェーズ5）

### 2.4 ステップ4：パイプライン化（3〜4週）
- [ ] 単一サイクルから **直接5段 (IF/ID/EX/MEM/WB)** へ（3段経由は手戻りが増えやすいため省略可）
- [ ] フォワーディング、ロード使用ハザードの stall、分岐ハザード（早期分岐解決 or 静的予測）
- [ ] **パイプライン化後も RVFI 出力と Spike 一致を維持**（回帰テストが保証）

### 2.5 形式検証（並行）
- [ ] **riscv-formal** で命令単位の検証（RVFI）
- [ ] 補助として ALU / デコーダを SymbiYosys で個別証明

### 2.6 回帰テスト基盤
- [ ] riscv-tests（`rv64ui` / `rv64mi`）全パス
- [ ] riscv-arch-test（RV64I + Zicsr 範囲）全パス
- [ ] C言語の簡単な計算プログラムが単体で動作

### ✅ M2 完了条件
> **riscv-tests と riscv-arch-test（RV64I + Zicsr）を全パスし、Spike と retire 単位で一致する RV64I パイプラインCPU**

---

## 🚌 周辺回路の統合とSoC化 (フェーズ3) ― 目安: 1〜1.5ヶ月

### 3.1 内部バス
- [ ] Wishbone（マスタ: CPU、スレーブ: RAM/UART/GPIO/CLINT）
- [ ] アドレスデコーダ（共有バスで開始、メモリマップは上表に準拠）
- [ ] 将来の AXI4-Lite 移行を見据えた抽象化

### 3.2 メモリおよび周辺
- [ ] チップ内RAMコントローラ
- [ ] **UART（16550 互換の最小サブセット）**
- [ ] GPIO
- [ ] **CLINT**（`mtime` / `mtimecmp` / `msip`、タイマ割り込み）

### 3.3 SoC 統合テスト
- [ ] C言語 → コンパイル → RAM 配置 → UART から "Hello World"
- [ ] タイマ割り込みのテスト（割り込みハンドラで tick カウント）
- [ ] Spike（virt 互換マップ）と出力を比較
- [ ] CI に組み込み

### ✅ M3 完了条件
> **自作SoC上で "Hello World" が UART から出力され、タイマ割り込みも動作し、CI で自動検証される**

---

## 🚀 物理設計と実装 (フェーズ4) ― 目安: 1〜2ヶ月

### 4.1 アプローチA：オープンPDKでの配置配線 (GDSII生成)
> ⚠️ オープンな先端ノードは **ASAP7 (7nm予測PDK)** が上限。まず sky130 で一周する。

- [ ] **ステップ1：sky130 でフローを一周**
  - [ ] OpenLane 2 + SkyWater sky130 PDK
  - [ ] **対象は CPUコア単体 + 極小RAM**
  - [ ] **RAM方針**: フリップフロップ合成は面積が爆発するため、OpenRAM マクロ利用 or 数百バイト〜数KBに限定
  - [ ] GDSII 生成
  - [ ] **iPad での鑑賞手順**: サーバー側で KLayout を headless 実行して PNG/SVG に書き出す（または Web 版ビューア）
- [ ] **ステップ2：ASAP7（上級・失敗許容）**
  - [ ] 対象を ALU 単体などに絞る
  - [ ] フローが壊れる前提で挑戦

### 4.2 アプローチB：FPGA 実機動作（将来オプション）
- [ ] Artix-7 搭載ボード（Linux を見据えるなら DDR 必須）
- [ ] Vivado（無料版）、UART から iPad へシリアル出力

### ✅ M4 完了条件
> **CPUコアの GDSII が生成され、iPad でレイアウト画像を鑑賞できる**

---

## 📈 将来の拡張 (フェーズ5：Linux への道)
**Linux 最低ライン: RV64IMA + Zicsr + Zifencei + Sv39**

- [ ] **M拡張**（乗算・除算）
- [ ] **A拡張**（LR/SC と AMO）
- [ ] **特権モード**: Supervisor / User と関連 CSR（`satp` `sstatus` `stvec` 等）、委譲 (`medeleg` / `mideleg`)
- [ ] **PLIC**（外部割り込み）
- [ ] **MMU**: Sv39 + TLB（ページテーブルウォーカ、`sfence.vma`）
- [ ] **十分な RAM**: FPGA なら DDR、シミュレーションなら数百MBのメモリモデル
- [ ] **ブート**: OpenSBI → Linux カーネル → BusyBox
- [ ] **C拡張**: 後回し（必要になってから）
- [ ] 参考実装（Rocket / BOOM / VexRiscv）は CSR 周りの作法を学ぶために読む

---

## 🗓️ マイルストーン一覧

| ID | 内容 | フェーズ | 目安 |
|----|------|----------|------|
| M1 | iPad から Verilator + Surfer で波形閲覧 | 1 | 1週 |
| M2 | RV64I + Zicsr パイプラインCPUが riscv-tests/arch-test 全パス + Spike 一致 | 2 | 2〜3ヶ月 |
| M3 | SoC で "Hello World" + タイマ割り込み、CI 自動検証 | 3 | 1〜1.5ヶ月 |
| M4 | sky130 で GDSII 生成、iPad で鑑賞 | 4 | 1〜2ヶ月 |
| M5 | (将来) FPGA 実機動作 | 4B | - |
| M6 | (将来) RV64IMA + Sv39 で Linux ブート | 5 | - |

> 目安の1.5倍を超えたら停滞とみなし、スコープ縮小（拡張の先送り、対象の絞り込み）を検討する。

---

## 🎯 直近の着手点

1. **Tailscale + VS Code Tunnels** で iPad から PC へ接続
2. **Verilator + Icarus + Surfer + riscv64-unknown-elf-gcc + Spike** をインストール
3. **Git + GitHub Actions** の CI 雛形を作成
4. **RTL記述言語を決定**し README に明記

---

## 📝 改訂履歴
- v3: 最小CSR/M-modeトラップをフェーズ2へ前倒し、RV64I の W系命令を補完、RVFI + riscv-formal 採用、RTL言語の決定項目を追加、メモリマップを Spike/QEMU virt 互換に、UARTを16550互換に、RAM合成方針とGDSII鑑賞手順を追記、各フェーズに目安期間を追加、Linux最低ライン（RV64IMA + Zicsr + Zifencei + Sv39）を明記
- v2: フィードバック反映（RV64I 命令数修正、Surfer 採用、CLINT 追加、CI 追加、OpenLane 2 / sky130 推奨、形式検証・Spike協調追加）
- v1: 初版
