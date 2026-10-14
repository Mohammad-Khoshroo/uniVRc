const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');

let diagnosticCollection;
let statusBarItem;
let debounceTimer;
let currentVisualizerPanel = null;

// ============================================================================
// 1. Hover Documentation Knowledge Base
// ============================================================================
const HOVER_DOCS = {
    // --- Pragmas & Directives ---
    '@MODULE': {
        title: '📦 @MODULE — Hardware Entity / Top-Level IP',
        desc: 'Defines a synthesizable hardware entity or submodule with ports and generics. Corresponds to a Verilog/SystemVerilog `module`.',
        example: '@MODULE\n@PARAM(DATA_WIDTH = 32)\nMyFilter(in unsigned<32> clk, in bool rst_n, out unsigned<32> data_out) { ... }'
    },
    '@PARAM': {
        title: '⚙️ @PARAM — Hardware Generics & Parameters',
        desc: 'Declares synthesis-time hardware parameters (bit-widths, buffer depths, tap counts). Can have default values.',
        example: '@PARAM(DATA_WIDTH = 32, FIFO_DEPTH = 16, TAPS = 8)'
    },
    '@THREAD': {
        title: '⚡ @THREAD — Concurrent Process / Process Kernel',
        desc: 'Declares a concurrent hardware execution block. When combined with `@WHEN` and `@RESET`, synthesizes to a clocked synchronous process.',
        example: '@WHEN(posedge clk) @RESET(rst_n) @THREAD\nvoid state_update() { ... }'
    },
    '@WHEN': {
        title: '⏱️ @WHEN — Sensitivity & Clock Edge Causality',
        desc: 'Specifies the triggering event / clock sensitivity for a thread. Supports `posedge` and `negedge` qualifiers.',
        example: '@WHEN(posedge clk) @RESET(rst_n) @THREAD'
    },
    '@RESET': {
        title: '🔄 @RESET — Hardware Reset Signal',
        desc: 'Defines the reset line and polarity for sequential state registers in a `@THREAD`.',
        example: '@RESET(rst_n) // Evaluates !rst_n as active-low reset'
    },
    '@FUNC': {
        title: '🧩 @FUNC — Pure Algorithmic Function',
        desc: 'Defines a synthesizable algorithmic function. Can be synthesized into a scheduled datapath or inlined into caller logic.',
        example: '@FUNC\nunsigned<32> mac(unsigned<32> a, unsigned<32> b, unsigned<32> c) {\n    return a * b + c;\n}'
    },
    '@PIPE': {
        title: '🚀 @PIPE — Loop Pipelining Pragma',
        desc: 'Enables fine-grained loop pipelining with target Initiation Interval (`II`). `II=1` means a new loop iteration starts every single clock cycle.',
        example: 'for (int i = 0; i < N; i++) {\n    @PIPE(II=1)\n    sum = sum + arr[i];\n}'
    },
    '@UNROLL': {
        title: '🔀 @UNROLL — Loop Unrolling Pragma',
        desc: 'Unrolls loop iterations into parallel spatial hardware compute units. `factor=N` replicates datapath hardware N times.',
        example: '@UNROLL(factor=4)\nfor (int i = 0; i < 16; i++) { ... }'
    },
    '@TRIPCOUNT': {
        title: '📊 @TRIPCOUNT — Loop Iteration Bounds',
        desc: 'Informs the HLS scheduler about execution bounds (`min`, `max`, `avg`) for static scheduling, latency estimation, and resource allocation.',
        example: '@TRIPCOUNT(min=8, max=64, avg=32)'
    },
    '@PARTITION': {
        title: '💾 @PARTITION — Multi-Bank Memory Partitioning',
        desc: 'Partitions an array into multiple independent physical RAM banks or registers to eliminate multi-port access memory stalls.\n- `cyclic`: Alternates elements cyclically across banks.\n- `block`: Splits contiguous chunks into banks.\n- `complete`: Decomposes array into discrete registers.',
        example: '@PARTITION(type="cyclic", factor=4, dim=1)\nunsigned<32> buffer[16];'
    },
    '@MEM': {
        title: '🗄️ @MEM — Dedicated RAM Storage Binding',
        desc: 'Specifies physical memory architecture attributes: port count (1 or 2), number of banks, and read latency in cycles.',
        example: '@MEM(ports=2, banks=4, latency=1)\nunsigned<32> coefficient_rom[8];'
    },
    '@REG': {
        title: '📌 @REG — Explicit State Register Allocation',
        desc: 'Forces the HLS compiler to bind the variable to a hardware flip-flop register instead of transient combinational wire.',
        example: '@REG unsigned<32> delay_pipe[4];'
    },
    '@BIND_OP': {
        title: '🎯 @BIND_OP — Arithmetic Resource Core Binding',
        desc: 'Binds arithmetic operations to specific silicon hardware cores (e.g. `dsp` vs `fabric` LUTs).',
        example: '@BIND_OP(op="mul", impl="dsp")\nunsigned<32> prod = a * b;'
    },
    '@BIND_STORAGE': {
        title: '🏛️ @BIND_STORAGE — Memory Primitive Core Binding',
        desc: 'Binds arrays to specific memory blocks (`bram`, `uram`, `lutram`).',
        example: '@BIND_STORAGE(type="ram_2p", impl="bram")\nint memory_table[1024];'
    },
    '@INTERFACE': {
        title: '🔌 @INTERFACE — Hardware Bus Interface Protocol',
        desc: 'Synthesizes ports into standard hardware protocols: `s_axilite` (memory-mapped registers), `axis` (streaming with valid/ready), `ap_none`, `m_axi`.',
        example: '@INTERFACE(mode="axis") in unsigned<32> in_data'
    },
    '@DEPENDENCE': {
        title: '🛡️ @DEPENDENCE — Memory Disambiguation Hint',
        desc: 'Instructs the HLS scheduler to ignore false loop dependencies (e.g. RAW/WAR hazards across array indices).',
        example: '@DEPENDENCE(variable="tap_delay_line", type="inter", direction="RAW", false=true)'
    },
    '@LOOP_FLATTEN': {
        title: '📐 @LOOP_FLATTEN — Nested Loop Flattening',
        desc: 'Flattens nested multi-dimensional loops into a single pipelined loop without cycle penalties between iterations.',
        example: '@LOOP_FLATTEN\nfor (int i = 0; i < R; i++)\n    for (int j = 0; j < C; j++) { ... }'
    },
    '@DATAFLOW': {
        title: '🌊 @DATAFLOW — Task-Level Pipelining',
        desc: 'Enables task-level concurrency across sequential kernels connected via FIFO or streaming channels.',
        example: '@DATAFLOW\nkernel_producer();\nkernel_consumer();'
    },
    '@INLINE': {
        title: '✂️ @INLINE — Function Boundary Inlining',
        desc: 'Inlines function logic directly into the caller module to eliminate call overhead and optimize cross-boundary logic.',
        example: '@FUNC\n@INLINE\nunsigned<32> fast_clamp(...) { ... }'
    },
    '@TESTBENCH': {
        title: '🧪 @TESTBENCH — Simulation Testbench Environment',
        desc: 'Declares an untimed or cycle-based simulation testbench block for functional verification.',
        example: '@TESTBENCH\nFilterTB() {\n    // Stimulus and clock generation\n}'
    },

    // --- Types ---
    'unsigned': {
        title: '🔢 unsigned<W> — Bit-Exact Unsigned Integer',
        desc: 'Synthesizes an unsigned integer with exact hardware bit-width `W` (e.g. `unsigned<12>` creates a 12-bit bus).',
        example: 'unsigned<32> data_word = 32\'hFFFF;'
    },
    'signed': {
        title: '🔢 signed<W> — Bit-Exact Two’s Complement Signed Integer',
        desc: 'Synthesizes a signed integer with exact hardware bit-width `W` using standard two\'s complement arithmetic.',
        example: 'signed<16> delta = -10;'
    },
    'fxp': {
        title: '🎯 fxp<W, F> — Bit-Exact Fixed-Point Number',
        desc: 'Hardware fixed-point arithmetic type with `W` total bits and `F` fractional bits. Ideal for DSP filters, neural networks, and matrix computation.',
        example: 'fxp<16, 8> coeff = 1.25; // 8 integer bits, 8 fractional bits'
    },
    'wire': {
        title: '〰️ wire<W> — Combinational Continuous Signal',
        desc: 'Continuous combinational wire evaluated immediately without flip-flop clock latency.',
        example: 'wire<32> clamped = data_in & 32\'h00FF;'
    },
    'reg': {
        title: '💾 reg — State Register Variable',
        desc: 'Flip-flop register inferred for sequential state retention across clock cycles.',
        example: 'reg clk_div = 1\'b0;'
    },
    'stream': {
        title: '🌊 stream<Type, Depth> — AXI / Handshake Streaming Channel',
        desc: 'Point-to-point streaming channel supporting non-blocking or blocking reads and writes with hardware FIFO flow control.',
        example: 'stream<unsigned<32>, 16> sample_stream;'
    },
    'fifo': {
        title: '📥 fifo<Type, Depth> — Hardware FIFO Buffer',
        desc: 'Hardware First-In-First-Out circular buffer queue with programmable depth.',
        example: 'fifo<unsigned<32>, 8> output_fifo;'
    },

    // --- Operators ---
    ':=': {
        title: '⚡ := — Sequential Non-Blocking Register Assignment',
        desc: 'Updates the target state register on the next clock trigger (equivalent to Verilog non-blocking assignment `<=`).',
        example: 'tap_delay_line[0] := new_sample;'
    },
    '=': {
        title: '🔗 = — Combinational Blocking Assignment',
        desc: 'Evaluates and assigns the expression immediately in combinational logic.',
        example: 'unsigned<32> acc = a + b;'
    },
    '+:': {
        title: '✂️ +: — Part-Select Plus Slice Operator',
        desc: 'Dynamic bit slice: `signal[base +: width]` extracts `width` bits starting from index `base`.',
        example: 'acc[0 +: 16] // selects bits 0 to 15'
    },
    '-:': {
        title: '✂️ -: — Part-Select Minus Slice Operator',
        desc: 'Dynamic bit slice: `signal[base -: width]` extracts `width` bits decrementing from index `base`.',
        example: 'acc[31 -: 8] // selects bits 31 down to 24'
    },
    '<$': {
        title: '🔗 $ — Hardware Bit Concatenation & Replication',
        desc: 'Concatenates multiple bit signals into a single vector `${a, b}` or replicates bits `${4{1\'b0}}`.',
        example: 'wire<16> bus = ${msb[7:0], lsb[7:0]};'
    }
};

// ============================================================================
// 2. Main Extension Activation
// ============================================================================
function activate(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('univrc');
    context.subscriptions.push(diagnosticCollection);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'univrc.checkSyntax';
    statusBarItem.text = '$(circuit-board) uniVRc';
    statusBarItem.tooltip = 'Click to re-run uniVRc syntax analysis';
    context.subscriptions.push(statusBarItem);

    // ------------------------------------------------------------------------
    // Diagnostics & Syntax Checking
    // ------------------------------------------------------------------------
    function runDiagnostics(document) {
        if (!document || document.languageId !== 'univrc') {
            return;
        }

        const config = vscode.workspace.getConfiguration('univrc');
        const enabled = config.get('enableSyntaxAnalysis', true);
        if (!enabled) {
            diagnosticCollection.delete(document.uri);
            statusBarItem.hide();
            return;
        }

        const pythonPath = config.get('pythonPath', 'python');
        const analyzerScript = path.join(context.extensionPath, 'server', 'analyzer.py');
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : '';

        const args = [analyzerScript, '--stdin'];
        if (workspacePath) {
            args.push('--workspace', workspacePath);
        }

        const proc = cp.spawn(pythonPath, args, { windowsHide: true });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', data => { stdout += data.toString(); });
        proc.stderr.on('data', data => { stderr += data.toString(); });

        proc.on('error', err => {
            console.error('Failed to spawn uniVRc syntax analyzer:', err);
            statusBarItem.text = '$(warning) uniVRc: Python not found';
            statusBarItem.tooltip = `Could not run ${pythonPath}. Please configure 'univrc.pythonPath' in settings.`;
            statusBarItem.show();
        });

        proc.on('close', code => {
            if (code !== 0 && !stdout) {
                return;
            }

            try {
                const results = JSON.parse(stdout.trim() || '[]');
                const diags = results.map(item => {
                    const line = Math.max(0, (item.line || 1) - 1);
                    const col = Math.max(0, (item.column || 1) - 1);
                    const endLine = Math.max(0, (item.endLine || item.line || 1) - 1);
                    const endCol = Math.max(col + 1, (item.endColumn || (col + 1)) - 1);

                    const range = new vscode.Range(line, col, endLine, endCol);
                    const severity = item.severity === 'warning'
                        ? vscode.DiagnosticSeverity.Warning
                        : vscode.DiagnosticSeverity.Error;

                    return new vscode.Diagnostic(range, item.message, severity);
                });

                diagnosticCollection.set(document.uri, diags);

                if (diags.length === 0) {
                    statusBarItem.text = '$(check) uniVRc: Valid';
                    statusBarItem.tooltip = 'uniVRc Syntax: 0 errors';
                    statusBarItem.command = 'univrc.checkSyntax';
                } else {
                    statusBarItem.text = `$(error) uniVRc: ${diags.length} error(s)`;
                    statusBarItem.tooltip = 'Syntax errors detected. Click to view in Problems panel.';
                    statusBarItem.command = 'workbench.actions.view.problems';
                }
                statusBarItem.show();
            } catch (parseErr) {
                console.error('Error parsing analyzer output:', parseErr, stdout);
            }
        });

        try {
            proc.stdin.write(document.getText());
            proc.stdin.end();
        } catch (writeErr) {
            console.error('Error sending text to analyzer:', writeErr);
        }
    }

    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'univrc') {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                runDiagnostics(event.document);
            }, 400);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId === 'univrc') {
            runDiagnostics(doc);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.languageId === 'univrc') {
            runDiagnostics(doc);
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidCloseTextDocument(doc => {
        diagnosticCollection.delete(doc.uri);
    }, null, context.subscriptions);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'univrc') {
            statusBarItem.show();
            runDiagnostics(editor.document);
        } else {
            statusBarItem.hide();
        }
    }, null, context.subscriptions);

    // Manual Syntax Check Command
    context.subscriptions.push(vscode.commands.registerCommand('univrc.checkSyntax', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'univrc') {
            runDiagnostics(editor.document);
            vscode.window.showInformationMessage('uniVRc: Syntax check triggered.');
        } else {
            vscode.window.showInformationMessage('Open a uniVRc (.vr) file to check syntax.');
        }
    }));

    // ------------------------------------------------------------------------
    // 3. Hover Provider (Documentation Tooltips)
    // ------------------------------------------------------------------------
    const hoverProvider = vscode.languages.registerHoverProvider('univrc', {
        provideHover(document, position) {
            const range = document.getWordRangeAtPosition(position, /@[a-zA-Z_]\w*|:=|\+:|-:|\b[a-zA-Z_]\w*\b/);
            if (!range) {
                return null;
            }

            const word = document.getText(range);
            const docInfo = HOVER_DOCS[word] || HOVER_DOCS[word.toUpperCase()];

            if (docInfo) {
                const md = new vscode.MarkdownString();
                md.appendMarkdown(`### ${docInfo.title}\n\n`);
                md.appendMarkdown(`${docInfo.desc}\n\n`);
                if (docInfo.example) {
                    md.appendCodeblock(docInfo.example, 'univrc');
                }
                return new vscode.Hover(md, range);
            }

            return null;
        }
    });
    context.subscriptions.push(hoverProvider);

    // ------------------------------------------------------------------------
    // 4. Document Outline & Symbols Provider
    // ------------------------------------------------------------------------
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider('univrc', {
        provideDocumentSymbols(document) {
            const symbols = [];
            const text = document.getText();
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // 1. Module
                let match = line.match(/(?:@MODULE\s+)?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/);
                if (match && !line.includes('if') && !line.includes('for') && !line.includes('switch')) {
                    const name = match[1];
                    const range = new vscode.Range(i, 0, i, line.length);
                    symbols.push(new vscode.DocumentSymbol(name, 'Module', vscode.SymbolKind.Module, range, range));
                    continue;
                }

                // 2. Thread
                match = line.match(/@THREAD\s+(?:void\s+)?([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*\{/);
                if (match) {
                    const name = match[1];
                    const range = new vscode.Range(i, 0, i, line.length);
                    symbols.push(new vscode.DocumentSymbol(name, 'Process Thread', vscode.SymbolKind.Event, range, range));
                    continue;
                }

                // 3. Function
                match = line.match(/(?:@FUNC\s+)?(?:unsigned<\d+>|signed<\d+>|fxp<\d+,\s*\d+>|wire<\d+>|int|float|bool|void)\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/);
                if (match) {
                    const name = match[1];
                    const range = new vscode.Range(i, 0, i, line.length);
                    symbols.push(new vscode.DocumentSymbol(name, 'Function', vscode.SymbolKind.Function, range, range));
                    continue;
                }

                // 4. Struct
                match = line.match(/struct\s+([A-Za-z_]\w*)\s*\{/);
                if (match) {
                    const name = match[1];
                    const range = new vscode.Range(i, 0, i, line.length);
                    symbols.push(new vscode.DocumentSymbol(name, 'Hardware Struct', vscode.SymbolKind.Struct, range, range));
                    continue;
                }

                // 5. Enum
                match = line.match(/enum\s+([A-Za-z_]\w*)(?:<\d+>)?\s*\{/);
                if (match) {
                    const name = match[1];
                    const range = new vscode.Range(i, 0, i, line.length);
                    symbols.push(new vscode.DocumentSymbol(name, 'Sized Enum', vscode.SymbolKind.Enum, range, range));
                    continue;
                }

                // 6. Testbench
                match = line.match(/@TESTBENCH\s+([A-Za-z_]\w*)/);
                if (match) {
                    const name = match[1];
                    const range = new vscode.Range(i, 0, i, line.length);
                    symbols.push(new vscode.DocumentSymbol(name, 'Testbench', vscode.SymbolKind.Package, range, range));
                    continue;
                }
            }

            return symbols;
        }
    });
    context.subscriptions.push(symbolProvider);

    // ------------------------------------------------------------------------
    // 5. Auto-Formatter (Shift + Alt + F)
    // ------------------------------------------------------------------------
    const formatProvider = vscode.languages.registerDocumentFormattingEditProvider('univrc', {
        provideDocumentFormattingEdits(document, options) {
            const edits = [];
            const text = document.getText();
            const lines = text.split('\n');

            const tabSize = options.tabSize || 4;
            const indentStr = options.insertSpaces ? ' '.repeat(tabSize) : '\t';
            let indentLevel = 0;
            const formattedLines = [];

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();

                if (line.length === 0) {
                    // Prevent more than one consecutive empty line
                    if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === '') {
                        continue;
                    }
                    formattedLines.push('');
                    continue;
                }

                // Decrease indent if line starts with closing brace
                if (line.startsWith('}') || line.startsWith(')')) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }

                // Case labels in switch indent slightly less
                let isCase = line.startsWith('case ') || line.startsWith('default');

                // Standardize operator spacing (safe regexes that avoid messing quotes/comments)
                if (!line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
                    // Spacing around :=
                    line = line.replace(/([^\s:])\s*:=\s*([^\s=])/g, '$1 := $2');
                    // Spacing around = (avoid ==, !=, <=, >=, :=)
                    line = line.replace(/([^!=<>:\s])\s*=\s*([^=])/g, '$1 = $2');
                    // Spacing after commas
                    line = line.replace(/,([^\s\n])/g, ', $1');
                    // Spacing after semicolons (if followed by text in same line)
                    line = line.replace(/;([^\s\n;/])/g, '; $1');
                }

                let currentIndent = isCase ? Math.max(0, indentLevel) : indentLevel;
                formattedLines.push(indentStr.repeat(currentIndent) + line);

                // Increase indent if line ends with open brace
                const openBraces = (line.match(/{/g) || []).length;
                const closeBraces = (line.match(/}/g) || []).length;
                indentLevel += (openBraces - closeBraces);
                if (indentLevel < 0) indentLevel = 0;
            }

            const formattedText = formattedLines.join('\n');
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );

            edits.push(vscode.TextEdit.replace(fullRange, formattedText));
            return edits;
        }
    });
    context.subscriptions.push(formatProvider);

    // ------------------------------------------------------------------------
    // 6. Interactive Graphical Visualizer (CDFG, Schedule & Dashboard Webview)
    // ------------------------------------------------------------------------
    const visualizerCmd = vscode.commands.registerCommand('univrc.showVisualizer', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'univrc') {
            vscode.window.showWarningMessage('Please open a uniVRc (.vr) file to view compilation graph.');
            return;
        }

        const document = editor.document;
        const filePath = document.uri.fsPath;
        const fileName = path.basename(filePath);

        if (currentVisualizerPanel) {
            currentVisualizerPanel.reveal(vscode.ViewColumn.Beside);
        } else {
            currentVisualizerPanel = vscode.window.createWebviewPanel(
                'univrcVisualizer',
                `uniVRc: ${fileName} (CDFG & Schedule)`,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            currentVisualizerPanel.onDidDispose(() => {
                currentVisualizerPanel = null;
            }, null, context.subscriptions);
        }

        currentVisualizerPanel.webview.html = `<!DOCTYPE html><html><body style="background:#1e1e2e;color:#cdd6f4;font-family:sans-serif;padding:24px;"><h3>Compiling & Generating CDFG Graph...</h3><p>Extracting AST, CFG, memory hazard edges, and schedule...</p></body></html>`;

        const config = vscode.workspace.getConfiguration('univrc');
        const pythonPath = config.get('pythonPath', 'python');
        const bridgeScript = path.join(context.extensionPath, 'server', 'visualizer_bridge.py');
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : '';

        const args = [bridgeScript, '--stdin', '--file', filePath];
        if (workspacePath) {
            args.push('--workspace', workspacePath);
        }

        const proc = cp.spawn(pythonPath, args, { windowsHide: true });
        let htmlOut = '';
        let errOut = '';

        proc.stdout.on('data', data => { htmlOut += data.toString(); });
        proc.stderr.on('data', data => { errOut += data.toString(); });

        proc.on('close', code => {
            if (currentVisualizerPanel) {
                if (htmlOut.trim()) {
                    currentVisualizerPanel.webview.html = htmlOut;
                } else {
                    currentVisualizerPanel.webview.html = `<!DOCTYPE html><html><body style="background:#1e1e2e;color:#f38ba8;padding:24px;"><h3>Visualizer Compilation Error</h3><pre>${errOut || 'Unknown visualizer error'}</pre></body></html>`;
                }
            }
        });

        try {
            proc.stdin.write(document.getText());
            proc.stdin.end();
        } catch (err) {
            console.error('Error piping code to visualizer:', err);
        }
    });
    context.subscriptions.push(visualizerCmd);

    // ------------------------------------------------------------------------
    // 7. Go to Definition Provider (F12 / Ctrl+Click)
    // ------------------------------------------------------------------------
    const definitionProvider = vscode.languages.registerDefinitionProvider('univrc', {
        provideDefinition(document, position) {
            const range = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
            if (!range) {
                return null;
            }

            const word = document.getText(range);
            const reserved = new Set([
                'if', 'elif', 'else', 'switch', 'case', 'default', 'for', 'while', 'do', 'repeat',
                'break', 'continue', 'return', 'int', 'float', 'bool', 'wire', 'reg', 'void',
                'unsigned', 'signed', 'fxp', 'stream', 'fifo', 'true', 'false', 'in', 'out', 'inout',
                'posedge', 'negedge', 'struct', 'enum', 'typedef', 'var', 'const', 'import'
            ]);
            if (reserved.has(word) || word.startsWith('@')) {
                return null;
            }

            const text = document.getText();
            const lines = text.split('\n');

            const declPatterns = [
                // Port declaration: in unsigned<32> word, out bool word
                new RegExp(`\\b(in|out|inout)\\s+(?:@\\w+(?:\\([^)]*\\))?\\s+)*(?:unsigned<\\d+>|signed<\\d+>|fxp<\\d+,\\s*\\d+>|wire(?:<\\d+>)?|stream<[^>]+>|fifo<[^>]+>|int|float|bool|reg|\\w+)\\s+(${word})\\b`),
                // Variable declaration: unsigned<32> word, wire word, int word[8], @REG unsigned<32> word
                new RegExp(`(?:@REG\\s+)?(?:var|const|wire(?:<\\d+>)?|unsigned<\\d+>|signed<\\d+>|fxp<\\d+,\\s*\\d+>|stream<[^>]+>|fifo<[^>]+>|int|float|bool|reg|[A-Z]\\w*)\\s+(${word})\\b`),
                // Struct / Enum / Typedef definition: struct word {, enum word {, typedef ... word;
                new RegExp(`(?:struct|enum|typedef)\\s+(${word})\\b`),
                // Enum member or constant definition: word = 2'b00
                new RegExp(`^\\s*(${word})\\s*=\\s*(?:\\d|'|true|false|[A-Z_])`),
                // Parameter definition: @PARAM(..., word = 32, ...)
                new RegExp(`@PARAM\\s*\\([^)]*?\\b(${word})\\s*=`),
                // Function / Module / Thread definition: word(...) { or void word(...) { or @MODULE word(...) {
                new RegExp(`(?:@MODULE|@FUNC|@THREAD|void)?\\s*\\b(${word})\\s*\\(`)
            ];

            const searchOrder = [];
            for (let i = position.line; i >= 0; i--) searchOrder.push(i);
            for (let i = position.line + 1; i < lines.length; i++) searchOrder.push(i);

            for (const lineIdx of searchOrder) {
                const line = lines[lineIdx];
                if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
                    continue;
                }

                for (const pattern of declPatterns) {
                    const match = line.match(pattern);
                    if (match) {
                        const col = line.indexOf(word);
                        if (col !== -1) {
                            const targetPos = new vscode.Position(lineIdx, col);
                            return new vscode.Location(document.uri, targetPos);
                        }
                    }
                }
            }

            return null;
        }
    });
    context.subscriptions.push(definitionProvider);

    // ------------------------------------------------------------------------
    // 8. Rename Symbol Provider (F2)
    // ------------------------------------------------------------------------
    const renameProvider = vscode.languages.registerRenameProvider('univrc', {
        provideRenameEdits(document, position, newName) {
            if (!/^[a-zA-Z_]\w*$/.test(newName)) {
                throw new Error(`'${newName}' is not a valid uniVRc identifier.`);
            }

            const range = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
            if (!range) {
                return null;
            }

            const oldName = document.getText(range);
            const reserved = new Set([
                'if', 'elif', 'else', 'switch', 'case', 'default', 'for', 'while', 'do', 'repeat',
                'break', 'continue', 'return', 'int', 'float', 'bool', 'wire', 'reg', 'void',
                'unsigned', 'signed', 'fxp', 'stream', 'fifo', 'true', 'false', 'in', 'out', 'inout',
                'posedge', 'negedge', 'struct', 'enum', 'typedef', 'var', 'const', 'import'
            ]);
            if (reserved.has(oldName) || oldName.startsWith('@')) {
                throw new Error(`Cannot rename reserved keyword or pragma '${oldName}'.`);
            }

            const workspaceEdit = new vscode.WorkspaceEdit();
            const text = document.getText();
            const lines = text.split('\n');
            const regex = new RegExp(`\\b${oldName}\\b`, 'g');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                    continue;
                }

                const commentIndex = line.indexOf('//');
                const codePart = commentIndex !== -1 ? line.substring(0, commentIndex) : line;

                let match;
                while ((match = regex.exec(codePart)) !== null) {
                    const matchIndex = match.index;
                    const before = codePart.substring(0, matchIndex);
                    const doubleQuotes = (before.match(/"/g) || []).length;
                    const singleQuotes = (before.match(/'/g) || []).length;
                    if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) {
                        continue;
                    }

                    const replaceRange = new vscode.Range(i, matchIndex, i, matchIndex + oldName.length);
                    workspaceEdit.replace(document.uri, replaceRange, newName);
                }
            }

            return workspaceEdit;
        }
    });
    context.subscriptions.push(renameProvider);

    // Initial check for open file
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'univrc') {
        statusBarItem.show();
        runDiagnostics(vscode.window.activeTextEditor.document);
    }
}

function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.clear();
    }
}

module.exports = {
    activate,
    deactivate
};
