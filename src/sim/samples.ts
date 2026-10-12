// Preloaded RISC-V assembly programs for Axral 64-bit SoC

export interface SampleProgram {
  id: string;
  name: string;
  description: string;
  category: 'beginner' | 'soc' | 'pipeline' | 'pro';
  assembly: string;
}

export const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: 'uart_hello',
    name: '01. UART Hello World (Plan.md M3)',
    description: 'UARTメモリマップレジスタ (0x30000000) へ文字を送信し、シリアル端末(iPad画面)に "Hello, Axral!" を出力するSoC検証プログラム',
    category: 'soc',
    assembly: `# Axral SoC - UART "Hello, Axral!" Output (Plan.md Milestone M3)
# UART Base: 0x30000000 (Data TX)
# RAM Base:  0x80000000

        lui   x1, 0x30000      # x1 = 0x30000000 (UART Base Address)
        lui   x2, 0x80000      # x2 = 0x80000000 (String buffer address in RAM)

# RAMに文字列 "Hello, Axral!\\n" を配置
        addi  x3, x0, 72       # 'H' (ASCII 72)
        sb    x3, 0(x2)
        addi  x3, x0, 101      # 'e' (ASCII 101)
        sb    x3, 1(x2)
        addi  x3, x0, 108      # 'l' (ASCII 108)
        sb    x3, 2(x2)
        addi  x3, x0, 108      # 'l' (ASCII 108)
        sb    x3, 3(x2)
        addi  x3, x0, 111      # 'o' (ASCII 111)
        sb    x3, 4(x2)
        addi  x3, x0, 44       # ',' (ASCII 44)
        sb    x3, 5(x2)
        addi  x3, x0, 32       # ' ' (ASCII 32)
        sb    x3, 6(x2)
        addi  x3, x0, 65       # 'A' (ASCII 65)
        sb    x3, 7(x2)
        addi  x3, x0, 120      # 'x' (ASCII 120)
        sb    x3, 8(x2)
        addi  x3, x0, 114      # 'r' (ASCII 114)
        sb    x3, 9(x2)
        addi  x3, x0, 97       # 'a' (ASCII 97)
        sb    x3, 10(x2)
        addi  x3, x0, 108      # 'l' (ASCII 108)
        sb    x3, 11(x2)
        addi  x3, x0, 33       # '!' (ASCII 33)
        sb    x3, 12(x2)
        addi  x3, x0, 10       # '\\n' (ASCII 10)
        sb    x3, 13(x2)
        addi  x3, x0, 0        # NULL terminator (0)
        sb    x3, 14(x2)

# ループで1文字ずつUARTへ書き込み
        addi  x4, x0, 0        # x4 = 文字インデックス i = 0

tx_loop:
        add   x5, x2, x4       # x5 = &buffer[i]
        lbu   x6, 0(x5)        # x6 = buffer[i]
        beq   x6, x0, done     # NULL終端なら終了

# Wishboneバス経由でUART送信レジスタ(0x30000000)に書き込み
        sb    x6, 0(x1)        # UART TX <- x6

        addi  x4, x4, 1        # i++
        jal   x0, tx_loop      # 次の文字へ

done:
        addi  x10, x0, 1       # 終了コード 1 (Success)
        ebreak                 # シミュレーション停止
`,
  },
  {
    id: 'fib_64bit',
    name: '02. 64-bit フィボナッチ & 64bit RAM保存',
    description: 'RV64Iの真価を発揮する64ビット演算。64bitレジスタ(x10, x11)で巨大数列を計算し、SD/LDでRAMへ64bit幅書き込み・読み出しテスト',
    category: 'beginner',
    assembly: `# 64-bit Fibonacci & Doubleword Memory Store (RV64I)
# RAM Base: 0x80000000
        lui   x1, 0x80000      # RAM Base 0x80000000
        addi  x10, x0, 0       # F(0) = 0
        addi  x11, x0, 1       # F(1) = 1
        addi  x5, x0, 15       # 計算回数 N = 15

# 初期値を64bitメモリに保存 (SD: Store Doubleword)
        sd    x10, 0(x1)       # RAM[0] = 0
        sd    x11, 8(x1)       # RAM[8] = 1

        addi  x6, x0, 2        # ループカウンタ i = 2
        addi  x7, x1, 16       # RAMポインタ = 0x80000010

fib_loop:
        bge   x6, x5, fib_done # if i >= N break
        add   x12, x10, x11    # x12 = F(i-2) + F(i-1) (64-bit ADD)
        sd    x12, 0(x7)       # RAMに64bit値を保存

        add   x10, x0, x11     # x10 = x11
        add   x11, x0, x12     # x11 = x12

        addi  x7, x7, 8        # ポインタ +8バイト (64bit)
        addi  x6, x6, 1        # i++
        jal   x0, fib_loop

fib_done:
        # メモリから最後の値を64bitで読み出して検証 (LD)
        ld    x20, -8(x7)      # x20 に最終結果をロード
        ebreak
`,
  },
  {
    id: 'hazard_forwarding',
    name: '03. パイプライン・データハザード & フォワーディング',
    description: '連続依存命令 (RAWハザード) とロード使用ハザード (Stall) の動作を検証。フォワーディング回路のON/OFFによるサイクルの変化を確認可能',
    category: 'pipeline',
    assembly: `# 5段パイプライン ハザード & フォワーディング検証
# x1 を直後に参照する RAW (Read-After-Write) ハザード

        addi  x1, x0, 100      # [IF] -> [ID] -> [EX: x1=100]
        addi  x2, x1, 50       # EXフォワーディングが機能すればstallなしで x2=150
        add   x3, x2, x1       # EX/MEM両方からのフォワーディングテスト (x3=250)

# ロード使用ハザード (Load-Use Hazard):
# ld命令の直後はデータがMEMステージまで来ないため、1サイクルのStall(バブル)が必要
        lui   x8, 0x80000
        sd    x3, 0(x8)        # RAMに書き込み
        ld    x4, 0(x8)        # x4 をメモリからロード
        add   x5, x4, x1       # ロード使用ハザード！(Stall発生を波形で観察)

# 条件分岐ハザード
        beq   x5, x0, fail_branch
        addi  x6, x0, 42       # 分岐不成立で実行される
        jal   x0, pass_test

fail_branch:
        addi  x6, x0, 999

pass_test:
        ebreak
`,
  },
  {
    id: 'clint_timer_gpio',
    name: '04. CLINT タイマ & GPIO LED制御 (Plan.md Phase 3)',
    description: 'タイマレジスタ (mtime: 0x20000000, mtimecmp: 0x20000008) をポーリングし、一定時間ごとにGPIO(0x40000000)のLEDをインクリメント',
    category: 'pro',
    assembly: `# CLINT Timer & GPIO LED Blinker
# CLINT Base: 0x20000000 (mtime: +0, mtimecmp: +8)
# GPIO Base:  0x40000000 (LEDs: +0)

        lui   x1, 0x20000      # CLINT Base
        lui   x2, 0x40000      # GPIO Base

        addi  x10, x0, 0       # LED値 = 0
        sb    x10, 0(x2)       # 初期LED出力

        addi  x20, x0, 0       # ループ回数
        addi  x21, x0, 5       # 最大5回点滅

timer_loop:
        bge   x20, x21, timer_done
        # mtime (現在時刻カウンタ) を読み取る
        ld    x11, 0(x1)       # x11 = current mtime

        # 一定カウント進めるディレイループ
        addi  x12, x0, 8
delay:
        addi  x12, x12, -1
        bne   x12, x0, delay

        # LED値をインクリメントして出力
        addi  x10, x10, 1
        sb    x10, 0(x2)       # GPIO LED <- x10

        addi  x20, x20, 1
        jal   x0, timer_loop

timer_done:
        ebreak
`,
  },
];
