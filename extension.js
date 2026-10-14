const vscode = require('vscode');
const cp = require('child_process');
const path = require('path');

let diagnosticCollection;
let statusBarItem;
let debounceTimer;

function activate(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('univrc');
    context.subscriptions.push(diagnosticCollection);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'univrc.checkSyntax';
    statusBarItem.text = '$(circuit-board) uniVRc';
    statusBarItem.tooltip = 'Click to re-run uniVRc syntax analysis';
    context.subscriptions.push(statusBarItem);

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

        const proc = cp.spawn(pythonPath, args, {
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', data => {
            stdout += data.toString();
        });

        proc.stderr.on('data', data => {
            stderr += data.toString();
        });

        proc.on('error', err => {
            console.error('Failed to spawn uniVRc syntax analyzer:', err);
            statusBarItem.text = '$(warning) uniVRc: Python not found';
            statusBarItem.tooltip = `Could not run ${pythonPath}. Please configure 'univrc.pythonPath' in settings.`;
            statusBarItem.show();
        });

        proc.on('close', code => {
            if (code !== 0 && !stdout) {
                console.error('uniVRc analyzer exited with code', code, stderr);
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

        // Send current code to analyzer stdin
        try {
            proc.stdin.write(document.getText());
            proc.stdin.end();
        } catch (writeErr) {
            console.error('Error sending document text to analyzer:', writeErr);
        }
    }

    // Trigger on document change (debounced 400ms)
    vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'univrc') {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                runDiagnostics(event.document);
            }, 400);
        }
    }, null, context.subscriptions);

    // Trigger on open & save
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

    // Command to manually re-run syntax check
    const checkCmd = vscode.commands.registerCommand('univrc.checkSyntax', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'univrc') {
            runDiagnostics(editor.document);
            vscode.window.showInformationMessage('uniVRc: Syntax check triggered.');
        } else {
            vscode.window.showInformationMessage('Open a uniVRc (.vr) file to check syntax.');
        }
    });
    context.subscriptions.push(checkCmd);

    // Initial check for currently open editor
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
