"""uniVRc Syntax Analyzer / Diagnostics Server for VS Code.
Parses uniVRc (.vr) source code using Lark and returns JSON-formatted diagnostics.
"""

import sys
import os
import json
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FALLBACK_GRAMMAR_FILE = os.path.join(SCRIPT_DIR, "grammar.lark")


def resolve_grammar(workspace_dir=None):
    """Finds the grammar from anti-HLS frontend if available, else uses bundled grammar."""
    candidates = []
    if workspace_dir:
        candidates.append(os.path.join(workspace_dir, "anti-HLS"))
        candidates.append(os.path.join(workspace_dir, "frontend"))
    
    # Try looking in parent dirs
    parent = os.path.dirname(SCRIPT_DIR)
    while parent and os.path.splitdrive(parent)[1] not in ("\\", "/"):
        candidates.append(os.path.join(parent, "anti-HLS"))
        candidates.append(os.path.join(parent, "CAD", "anti-HLS"))
        parent = os.path.dirname(parent)

    # Hardcoded known path
    candidates.append("D:/UT.CE/CAD/anti-HLS")

    for cand in candidates:
        if os.path.isdir(cand) and cand not in sys.path:
            sys.path.insert(0, cand)

    try:
        from frontend.grammar import get_grammar
        return get_grammar("hls")
    except Exception:
        pass

    if os.path.exists(FALLBACK_GRAMMAR_FILE):
        with open(FALLBACK_GRAMMAR_FILE, "r", encoding="utf-8") as f:
            return f.read()

    raise RuntimeError("Cannot locate uniVRc grammar file.")


def analyze_code(source_code: str, workspace_dir=None):
    """Analyzes source code and returns a list of diagnostic dictionaries."""
    diagnostics = []
    if not source_code.strip():
        return diagnostics

    try:
        from lark import Lark
        from lark.exceptions import (
            UnexpectedToken, UnexpectedCharacters, UnexpectedEOF,
            VisitError, LarkError
        )
    except ImportError as err:
        return [{
            "line": 1,
            "column": 1,
            "endLine": 1,
            "endColumn": 1,
            "message": f"Python dependency 'lark' import error: {str(err)}",
            "severity": "warning"
        }]

    try:
        grammar_text = resolve_grammar(workspace_dir)
        parser = Lark(grammar_text, parser="earley", propagate_positions=True)
    except Exception as e:
        return [{
            "line": 1,
            "column": 1,
            "endLine": 1,
            "endColumn": 1,
            "message": f"Grammar Loader Error: {str(e)}",
            "severity": "error"
        }]

    try:
        tree = parser.parse(source_code)
        
        # Try AST transformation if available for semantic checks
        try:
            from frontend.parser import PseudoVRTransformer
            transformer = PseudoVRTransformer()
            transformer.transform(tree)
        except Exception:
            # If transformer has non-critical differences, ignore or catch
            pass

    except UnexpectedToken as e:
        tok_val = getattr(e.token, "value", "")
        line = getattr(e, "line", 1) or 1
        col = getattr(e, "column", 1) or 1
        end_line = getattr(e, "end_line", line) or line
        end_col = getattr(e, "end_column", col + max(1, len(tok_val))) or (col + 1)
        
        expected = ""
        if hasattr(e, "expected") and e.expected:
            exp_list = sorted(list(e.expected))[:6]
            expected = f" (Expected: {', '.join(exp_list)})"

        diagnostics.append({
            "line": line,
            "column": col,
            "endLine": end_line,
            "endColumn": end_col,
            "message": f"Syntax Error: Unexpected token {tok_val!r}{expected}",
            "severity": "error"
        })

    except UnexpectedCharacters as e:
        line = getattr(e, "line", 1) or 1
        col = getattr(e, "column", 1) or 1
        end_line = getattr(e, "end_line", line) or line
        end_col = getattr(e, "end_column", col + 1) or (col + 1)
        
        diagnostics.append({
            "line": line,
            "column": col,
            "endLine": end_line,
            "endColumn": end_col,
            "message": f"Syntax Error: Unexpected character {getattr(e, 'char', '?')!r}",
            "severity": "error"
        })

    except UnexpectedEOF as e:
        line = getattr(e, "line", 1) or 1
        col = getattr(e, "column", 1) or 1
        
        diagnostics.append({
            "line": line,
            "column": col,
            "endLine": line,
            "endColumn": col + 1,
            "message": "Syntax Error: Unexpected end of file",
            "severity": "error"
        })

    except Exception as e:
        diagnostics.append({
            "line": 1,
            "column": 1,
            "endLine": 1,
            "endColumn": 1,
            "message": f"Parse Error: {str(e)}",
            "severity": "error"
        })

    return diagnostics


def main():
    parser = argparse.ArgumentParser(description="uniVRc Syntax Analyzer")
    parser.add_argument("--file", help="Path to .vr file to analyze")
    parser.add_argument("--stdin", action="store_true", help="Read source code from standard input")
    parser.add_argument("--workspace", help="Workspace root directory")
    args = parser.parse_args()

    source = ""
    if args.stdin:
        source = sys.stdin.read()
    elif args.file:
        if os.path.exists(args.file):
            with open(args.file, "r", encoding="utf-8") as f:
                source = f.read()
        else:
            print(json.dumps([{"line": 1, "column": 1, "endLine": 1, "endColumn": 1, "message": f"File not found: {args.file}", "severity": "error"}]))
            return
    else:
        # Default read stdin if available
        if not sys.stdin.isatty():
            source = sys.stdin.read()

    results = analyze_code(source, workspace_dir=args.workspace)
    print(json.dumps(results))


if __name__ == "__main__":
    main()
