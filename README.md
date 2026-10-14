# uniVRc Language Support for Visual Studio Code

<p align="center">
  <img src="icon.png" width="128" height="128" alt="uniVRc Logo" />
  <br>
  <b>The official, comprehensive developer extension for the uniVRc (.vr) Synthesizable HLS Language</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-uniVRc%20%2F%20pseudo--uniVRc-orange.svg" alt="uniVRc" />
  <img src="https://img.shields.io/badge/Parser-Lark-blue.svg" alt="Lark" />
  <img src="https://img.shields.io/badge/VS%20Code-1.60%2B-007ACC.svg" alt="VS Code" />
  <img src="https://img.shields.io/badge/Snippets-48%20Hardware%20Templates-success.svg" alt="Snippets" />
</p>

---

## Features

### Real-Time Syntax Diagnostics & Linter
- **Live Parser Integration**: Directly interfaces with the native `Lark` parser engine (`anti-HLS/frontend/parser.py`).
- **Inline Error Squiggles**: Instant red squiggly underlines on syntax errors (unexpected tokens, invalid characters, unclosed blocks, missing semicolons) with line and column precision.
- **VS Code Problems Panel (`Ctrl + Shift + M`)**: Full diagnostic reporting in the Problems view with one-click navigation to error locations.
- **Status Bar Indicator**:
  - `$(check) uniVRc: Valid` when error-free.
  - `$(error) uniVRc: N error(s)` when errors are detected (click to open Problems panel).
- **Manual Trigger**: Run `Ctrl + Shift + P` -> `uniVRc: Check Syntax of Active File`.

### Dedicated "VR" File Icon Theme
- Authentic geometric orange **VR** logo for all `*.vr` and `*.VR` files.
- **How to enable**: Press `Ctrl + Shift + P` -> type `Preferences: File Icon Theme` -> select **`uniVRc File Icons`**.


### Code Snippets
Complete catalog of production-ready boilerplate templates triggered by typing the prefix and hitting `Tab`:
- **Architecture**: `mod` (Hardware Module), `mod_axis` (AXI-Stream Interface), `mod_axilite` (AXI-Lite Slave), `inst` (Submodule Instantiation), `param` (Generics/Parameters).
- **Sequential Logic & FSM**: `thread_sync` (Clocked Process with Reset), `thread_comb` (Combinational Process), `fsm_3state` (3-State Moore/Mealy FSM), `shift_reg` (Pipelined Shift Register), `counter` (Hardware Up-Counter).
- **HLS Optimization Pragmas**: `pipe` (`@PIPE(II=1)`), `unroll`, `tripcount`, `flatten`, `dependence`, `part_cyclic`, `part_block`, `part_complete`, `mem_bram`, `bind_dsp`, `bind_storage`, `dataflow`, `inline`.
- **Loops & Branches**: `for_pipe`, `for_c`, `for_range`, `for_set`, `for_2d`, `while`, `repeat`, `switch_case`, `if_elif`.
- **Types & Channels**: `wire`, `reg`, `fxp`, `stream`, `fifo`, `struct`, `enum`, `typedef`.
- **DSP Kernels**: `fir_filter` (FIR Filter Kernel with MAC), `matmul_kernel` (2D Matrix Multiply with Banking), `func`, `func_inline`.
- **Verification & Bit Operations**: `tb` (Simulation Testbench), `assert`, `println`, `concat`, `rep`, `slice_plus`, `slice_minus`, `cast`.

---

## Installation

### Installing from VSIX Package
Pre-packaged standalone release:
```text
vscode-univrc/univrc-syntax-0.2.1.vsix
```

1. In VS Code, open the Extensions view (`Ctrl + Shift + X`).
2. Click the `...` menu at the top right of the Extensions panel.
3. Select **Install from VSIX...** and choose `univrc-syntax-0.2.1.vsix`.
*(Alternatively run via command line: `code --install-extension univrc-syntax-0.2.1.vsix`)*
