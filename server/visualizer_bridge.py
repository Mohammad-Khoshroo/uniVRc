"""Visualizer bridge for uniVRc VS Code extension.
Parses uniVRc (.vr) files and produces a self-contained interactive HTML dashboard
featuring CDFG graph, CFG, AST Explorer, and Schedule view.
"""

import sys
import os
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def setup_paths(workspace_dir=None):
    candidates = []
    if workspace_dir:
        candidates.append(os.path.join(workspace_dir, "anti-HLS"))
        candidates.append(workspace_dir)
    
    # Try looking in parent directories
    parent = os.path.dirname(SCRIPT_DIR)
    while parent and os.path.splitdrive(parent)[1] not in ("\\", "/"):
        candidates.append(os.path.join(parent, "anti-HLS"))
        candidates.append(parent)
        parent = os.path.dirname(parent)

    candidates.append("D:/UT.CE/CAD/anti-HLS")

    for cand in candidates:
        if os.path.isdir(cand) and cand not in sys.path:
            sys.path.insert(0, cand)


def generate_visualization(source_code, file_path=None, workspace_dir=None):
    setup_paths(workspace_dir)

    title = os.path.basename(file_path) if file_path else "uniVRc Source"

    try:
        from frontend import parse, build_cfg
        from visualizer import to_dot, to_svg, generate_html_dashboard
        
        ast = parse(source_code)
        cfg = build_cfg(ast)
        
        # Build CDFG if possible
        try:
            from cdfg import construct_cdfg
            cdfg = construct_cdfg(ast)
            dot_str = cdfg.to_dot() if hasattr(cdfg, "to_dot") else to_dot(cdfg)
        except Exception:
            try:
                if file_path and os.path.exists(file_path):
                    from cdfg import parse_to_cdfg
                    cdfg = parse_to_cdfg(file_path)
                    dot_str = cdfg.to_dot()
                else:
                    dot_str = "// CDFG: In-memory live construction"
            except Exception as e:
                dot_str = f"// CDFG generation note: {e}"

        svg_str = to_svg(dot_str)

        vis_data = {
            "title": f"uniVRc HLS Visualizer: {title}",
            "ast_dump": str(ast),
            "cfg_dump": cfg.to_dot() if hasattr(cfg, "to_dot") else str(cfg),
            "cdfg_dump": dot_str,
            "cdfg_svg": svg_str,
            "sdfg_dump": "Schedule partitioning viewer (FDS / SDC / Modulo)",
            "mrt_dump": "Modulo Reservation Table (MRT)",
            "hardware_dump": "FSM Controller & Datapath Architecture",
            "pareto_dump": "Design Space Exploration (Latency vs Area)",
        }

        return generate_html_dashboard(vis_data)

    except Exception as err:
        # Fallback error page
        return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: -apple-system, sans-serif; background: #1e1e2e; color: #cdd6f4; padding: 24px; }}
  .card {{ background: #181825; border: 1px solid #45475a; border-radius: 8px; padding: 16px; margin-top: 16px; }}
  pre {{ color: #f38ba8; font-family: monospace; white-space: pre-wrap; }}
</style>
</head>
<body>
  <h2>uniVRc Visualizer</h2>
  <div class="card">
    <h3>Notice</h3>
    <p>Could not build complete compilation graph for the current file:</p>
    <pre>{str(err)}</pre>
    <p style="color: #a6adc8;">Tip: Ensure the file contains syntactically valid uniVRc code and that anti-HLS is accessible.</p>
  </div>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(description="uniVRc Visualizer Bridge")
    parser.add_argument("--file", help="Path to .vr file")
    parser.add_argument("--stdin", action="store_true", help="Read code from stdin")
    parser.add_argument("--workspace", help="Workspace folder")
    args = parser.parse_args()

    code = ""
    if args.stdin:
        code = sys.stdin.read()
    elif args.file and os.path.exists(args.file):
        with open(args.file, "r", encoding="utf-8") as f:
            code = f.read()

    html = generate_visualization(code, file_path=args.file, workspace_dir=args.workspace)
    # Output raw HTML to stdout
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(html)


if __name__ == "__main__":
    main()
