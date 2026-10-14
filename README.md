# uniVRc

<p align="center">
  <img src="icon.png" width="128" height="128" alt="uniVRc Logo" />
  <br>
  <b>The official, comprehensive developer extension for the uniVRc (.vr) Synthesizable HLS Language</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-uniVRc%20%2F%20uniVRc--HLS-orange.svg" alt="uniVRc" />
  <img src="https://img.shields.io/badge/Grammar-univrc--hls-blue.svg" alt="Grammar" />
  <img src="https://img.shields.io/badge/VS%20Code-1.60%2B-007ACC.svg" alt="VS Code" />
  <img src="https://img.shields.io/badge/Snippets-45%20Hardware%20Templates-success.svg" alt="Snippets" />
</p>

---

## About uniVRc

**uniVRc** (pronounced *Universe* / *Uni-VR-C*, with the `.vr` file extension) is a unified, high-level hardware description and High-Level Synthesis (HLS) language engineered for modern algorithmic hardware design and C/Hardware co-design.

uniVRc bridges the gap between algorithmic expressive power and efficient RTL synthesis, providing software developers and hardware engineers with high-productivity abstractions without sacrificing low-level cycle-by-cycle hardware control:

- **Synthesizable High-Level Synthesis (HLS)**: Write expressive algorithmic kernels (DSP filters, 2D matrix transformations, systolic arrays) with automated conversion to scheduled and bound hardware architectures.
- **Bit-Exact Hardware Primitives**: Native support for arbitrary bit-width integers (`unsigned<W>`, `signed<W>`), fixed-point numerics (`fxp<W,F>`), standard RTL signals (`wire`, `reg`), and hardware streaming channels (`stream<T>`, `fifo<T>`).
- **Pipelining & Scheduling Directives**: Algorithmic pragmas (`@PIPE(II=1)`, `@UNROLL`, `@TRIPCOUNT`, `@LOOP_FLATTEN`, `@DEPENDENCE`) that directly drive Force-Directed Scheduling (FDS) and SDC scheduling algorithms.
- **Conflict-Free Memory Banking**: High-level memory partitioning directives (`@PARTITION(type="cyclic|block|complete")`, `@RESHAPE`, `@BIND_STORAGE(type="ram_2p", impl="bram")`) enabling maximum parallel throughput for multi-dimensional arrays.
- **Resource Binding & Interface Protocols**: Explicit binding of arithmetic operations to dedicated hardware units (`@BIND_OP(op="mul", impl="dsp")`), and automatic generation of standard bus interfaces (`@INTERFACE(mode="axis|s_axilite|ap_none")`).
- **Co-Design Concurrency**: Support for synchronous sequential processes (`@THREAD` with `@RESET` and `@TRIG(posedge clk)`), combinational logic, and structured finite state machines (FSM).

The current active grammar enforced by this extension is **`univrc-hls`**, the pure synthesizable subset designed to guarantee clean RTL generation and hardware synthesis.

---

## Features

### Real-Time Syntax Diagnostics & Linter
- **Live Parser Integration**: Directly interfaces with the native `Lark` parser engine configured for the `univrc-hls` grammar (`anti-HLS/frontend/univrc-hls.lark`).
- **Inline Error Squiggles**: Instant red squiggly underlines on syntax errors (unexpected tokens, invalid characters, unclosed blocks, missing semicolons) with line and column precision.
- **Synthesizability Enforcement**: Restricts constructs strictly to synthesizable hardware code, immediately alerting you to non-synthesizable patterns.
- **VS Code Problems Panel (`Ctrl + Shift + M`)**: Full diagnostic reporting in the Problems view with one-click navigation to error locations.
- **Status Bar Indicator**:
  - `$(check) uniVRc: Valid` when error-free.
  - `$(error) uniVRc: N error(s)` when errors are detected (click to open Problems panel).
- **Manual Trigger**: Run `Ctrl + Shift + P` -> `uniVRc: Check Syntax of Active File`.

### Dedicated "VR" File Icon Theme
- Authentic geometric orange **VR** logo for all `*.vr` and `*.VR` files.
- **How to enable**: Press `Ctrl + Shift + P` -> type `Preferences: File Icon Theme` -> select **`uniVRc File Icons`**.

### Interactive CDFG & Schedule Visualizer
- **Interactive Multi-View Dashboard**: Inspect Control Data Flow Graphs (CDFG), Control Flow Graphs (CFG), AST trees, memory hazard edges, and cycle-by-cycle schedules directly inside VS Code.
- **How to open**:
  - Click the **Graph Icon** in the top-right editor title bar.
  - Right-click anywhere in a `.vr` file -> **uniVRc: Show CDFG & Schedule Visualization**.
  - Or press `Ctrl + Shift + P` -> **uniVRc: Show CDFG & Schedule Visualization**.

### Hover Tooltips & Documentation
- Hover over any HLS pragma (`@PIPE`, `@PARTITION`, `@MODULE`, `@BIND_OP`, etc.), bit-exact type (`unsigned<W>`, `fxp<W,F>`, `wire`), or operator (`:=`, `+:`, `<&`) to view instant Markdown documentation, explanations, and usage examples.

### Document Symbols & Outline
- Full integration with VS Code's **Outline** view and **Breadcrumbs**.
- Instantly browse and jump to Modules, Threads, Functions, Structs, and Enums.

### Auto-Formatter
- Automatically formats and cleans up `.vr` code using `Shift + Alt + F` or Format Document:
  - Smart indentation for `{}` blocks and `switch/case` statements.
  - Standardizes spacing around operators (`:=`, `=`, `==`, `!=`, `<=`, `>=`).
  - Cleans up trailing whitespace and collapses redundant empty lines.

### Go to Definition (F12)
- Instantly jump to declarations of variables, ports, state registers, parameters, functions, structs, and enums using `F12` or `Ctrl + Click`.

### Rename Symbol (F2)
- Safely and atomically rename symbols across the entire document using `F2`, with full support for undo (`Ctrl + Z`).

### Code Snippets
Catalog of 45 production-ready boilerplate templates triggered by typing the prefix and hitting `Tab`:
- **Architecture**: `mod` (Hardware Module), `mod_axis` (AXI-Stream Interface), `mod_axilite` (AXI-Lite Slave), `inst` (Submodule Instantiation), `param` (Generics/Parameters).
- **Sequential Logic & FSM**: `thread_sync` (Clocked Process with Reset), `thread_comb` (Combinational Process), `fsm_3state` (3-State Moore/Mealy FSM), `shift_reg` (Pipelined Shift Register), `counter` (Hardware Up-Counter).
- **HLS Optimization Pragmas**: `pipe` (`@PIPE(II=1)`), `unroll`, `tripcount`, `flatten`, `dependence`, `part_cyclic`, `part_block`, `part_complete`, `mem_bram`, `bind_dsp`, `bind_storage`, `dataflow`, `inline`.
- **Loops & Branches**: `for_pipe`, `for_c`, `for_range`, `for_set`, `for_2d`, `while`, `repeat`, `switch_case`, `if_elif`.
- **Types & Channels**: `wire`, `reg`, `fxp`, `stream`, `fifo`, `struct`, `enum`, `typedef`.
- **DSP Kernels**: `fir_filter` (FIR Filter Kernel with MAC), `matmul_kernel` (2D Matrix Multiply with Banking), `func`, `func_inline`.
- **Bit Operations & Slicing**: `concat`, `rep`, `slice_plus`, `slice_minus`, `cast`.

---

## Coming Soon

The following capabilities are actively planned and will be introduced as the language and tooling evolve:

### Full Language Grammar Integration (uniVRc Full)
- **Simulation Testbench Blocks**: Native `@TESTBENCH` syntax for stimulus generation and golden-model verification without leaving the language.
- **Hardware Assertion Engine**: Built-in `assert(...)` statements for static and dynamic invariant checks during simulation.
- **Cycle Timing & Delays**: Simulation-only timing controls (`delay(N)`, `wait_cycles(N)`) and waveform tracing.
- **Debug Print Support**: High-level `$display` and `println` debugging functions for rapid verification.

### Multi-File Project Indexing & Import Resolution
- Cross-file symbol resolution and Go to Definition spanning across multi-file uniVRc libraries.
- Deep `@IMPORT` semantic checking and module namespace resolution.

### Dynamic Dialect Selector
- VS Code workspace setting (`univrc.dialect`: `hls` vs `full`) allowing developers to toggle between strict hardware-synthesizable linting and complete simulation-capable analysis on the fly.

---

## Installation

### Installing from VSIX Package
Pre-packaged standalone release:
```text
vscode-univrc/univrc-0.3.1.vsix
```

1. In VS Code, open the Extensions view (`Ctrl + Shift + X`).
2. Click the `...` menu at the top right of the Extensions panel.
3. Select **Install from VSIX...** and choose `univrc-0.3.1.vsix`.
*(Alternatively run via command line: `code --install-extension univrc-0.3.1.vsix`)*
