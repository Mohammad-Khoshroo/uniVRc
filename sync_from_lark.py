"""Auto-synchronizer CLI for uniVRc VS Code Extension.
Extracts keywords, directives, and types directly from Lark grammar files,
bumps version if requested, updates TextMate grammar, updates installed extension,
and builds the new .vsix package!
"""

import os
import re
import json
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_ROOT = os.path.dirname(SCRIPT_DIR)
LARK_FILE = os.path.join(WORKSPACE_ROOT, "anti-HLS", "frontend", "univrc-hls.lark")
if not os.path.exists(LARK_FILE):
    LARK_FILE = os.path.join(WORKSPACE_ROOT, "anti-HLS", "frontend", "pseudo_univrc.lark")
FULL_LARK_FILE = os.path.join(WORKSPACE_ROOT, "univrc-full.lark")
TMLANG_FILE = os.path.join(SCRIPT_DIR, "syntaxes", "univrc.tmLanguage.json")
PACKAGE_JSON_FILE = os.path.join(SCRIPT_DIR, "package.json")
BUILD_VSIX_FILE = os.path.join(SCRIPT_DIR, "build_vsix.py")


def bump_version(part="patch"):
    with open(PACKAGE_JSON_FILE, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    
    current = pkg.get("version", "0.2.0")
    nums = [int(x) for x in current.split(".")]
    while len(nums) < 3:
        nums.append(0)

    if part == "major":
        nums[0] += 1
        nums[1] = 0
        nums[2] = 0
    elif part == "minor":
        nums[1] += 1
        nums[2] = 0
    elif part == "patch":
        nums[2] += 1
    
    new_version = f"{nums[0]}.{nums[1]}.{nums[2]}"
    pkg["version"] = new_version
    
    with open(PACKAGE_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(pkg, f, indent=2)
    
    print(f"-> Bumped version: {current} -> {new_version}")
    return new_version


def extract_tokens(custom_lark=None):
    texts = []
    files_to_check = [custom_lark] if custom_lark else [LARK_FILE]
    for path in files_to_check:
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                texts.append(f.read())
    
    combined = "\n".join(texts)
    if not combined.strip():
        # Fallback to server/univrc-hls.lark or server/grammar.lark
        fb = os.path.join(SCRIPT_DIR, "server", "univrc-hls.lark")
        if not os.path.exists(fb):
            fb = os.path.join(SCRIPT_DIR, "server", "grammar.lark")
        if os.path.exists(fb):
            with open(fb, "r", encoding="utf-8") as f:
                combined = f.read()

    # 1. Extract ATTR_NAME regex: /(?i:FUNC|MODULE|...)/
    attr_matches = re.findall(r"ATTR_NAME[^:]*:\s*/\(\?i:([^)]+)\)/", combined)
    attrs = set()
    for match in attr_matches:
        for a in match.split("|"):
            a = a.strip()
            if a:
                attrs.add(a.upper())
    
    # Also find literal "@WORD"
    at_words = re.findall(r'@([A-Z_]+)\b', combined)
    for w in at_words:
        attrs.add(w)

    default_attrs = {
        "FUNC", "MODULE", "PARAM", "THREAD", "WHEN", "WHILE", "UNTIL", "TRIG", "RESET",
        "MEM", "REG", "UNROLL", "PIPE", "DATAFLOW", "DEPENDENCE", "PARTITION", "RESHAPE",
        "TRIPCOUNT", "LOOP_FLATTEN", "LOOP_MERGE", "RESOURCE", "ALLOCATION", "BIND_OP",
        "BIND_STORAGE", "INTERFACE", "INLINE", "OCCURRENCE", "IMPORT"
    }
    attrs.update(default_attrs)

    # Extract all literal string tokens like "keyword"
    string_tokens = set(re.findall(r'"([a-zA-Z_]\w*)"', combined))
    
    # Built-in types
    types_set = {t for t in string_tokens if t in {
        "int", "float", "bool", "wire", "reg", "void", "signed", "unsigned", "fxp", "stream", "fifo"
    }}
    
    type_rule_matches = re.findall(r'type\s*:[^;]+', combined)
    for tr in type_rule_matches:
        for t in re.findall(r'"([a-zA-Z_]\w*)"', tr):
            types_set.add(t)

    control_flow = {k for k in string_tokens if k in {
        "if", "elif", "else", "switch", "case", "default", "for", "while", "do", "repeat", "break", "continue", "return"
    }}
    
    loop_iter = {k for k in string_tokens if k in {
        "from", "to", "step", "index", "range", "set"
    }}
    
    declarations = {k for k in string_tokens if k in {
        "import", "struct", "enum", "typedef"
    }}
    
    modifiers = {k for k in string_tokens if k in {
        "var", "const"
    }}
    
    ports = {k for k in string_tokens if k in {
        "in", "out", "inout"
    }}
    
    builtins = {k for k in string_tokens if k in {
        "min", "max", "abs", "print", "println", "assert", "delay", "wait_cycles", "cast"
    }}
    
    return {
        "attrs": attrs,
        "types": types_set,
        "control_flow": control_flow,
        "loop_iter": loop_iter,
        "declarations": declarations,
        "modifiers": modifiers,
        "ports": ports,
        "builtins": builtins
    }


def sync(bump=None, custom_lark=None):
    if bump:
        bump_version(bump)

    tokens = extract_tokens(custom_lark)
    print(f"-> Found {len(tokens['attrs'])} HLS attributes/pragmas: {sorted(tokens['attrs'])}")
    print(f"-> Found {len(tokens['types'])} types: {sorted(tokens['types'])}")
    
    with open(TMLANG_FILE, "r", encoding="utf-8") as f:
        tmlang = json.load(f)
    
    repo = tmlang.get("repository", {})
    
    # 1. Update directives regex
    sorted_attrs = sorted(tokens["attrs"], key=lambda x: -len(x))
    attr_pattern = "|".join(sorted_attrs)
    repo["directives"]["patterns"][0]["match"] = f"(@)(?i:{attr_pattern})\\b"
    
    # 2. Update types
    primitive = sorted([t for t in tokens["types"] if t in {"int", "float", "bool", "wire", "reg", "void"}], key=lambda x: -len(x))
    hardware = sorted([t for t in tokens["types"] if t not in {"int", "float", "bool", "wire", "reg", "void"}], key=lambda x: -len(x))
    
    for pat in repo.get("types", {}).get("patterns", []):
        if "primitive" in pat.get("name", "") and primitive:
            pat["match"] = f"\\b({'|'.join(primitive)})\\b"
        elif "hardware" in pat.get("name", "") and hardware:
            pat["match"] = f"\\b({'|'.join(hardware)})\\b"
            
    # 3. Update control keywords
    loops = sorted(tokens["control_flow"] & {"for", "while", "do", "repeat"}, key=lambda x: -len(x))
    flows = sorted(tokens["control_flow"] & {"break", "continue", "return"}, key=lambda x: -len(x))
    decls = sorted(tokens["declarations"], key=lambda x: -len(x))
    mods = sorted(tokens["modifiers"], key=lambda x: -len(x))
    iters = sorted(tokens["loop_iter"], key=lambda x: -len(x))

    for pat in repo.get("keywords", {}).get("patterns", []):
        name = pat.get("name", "")
        if "conditional" in name:
            pat["match"] = "\\b(if|elif|else|switch|case|default)\\b"
        elif "loop" in name and loops:
            pat["match"] = f"\\b({'|'.join(loops)})\\b"
        elif "iteration" in name and iters:
            pat["match"] = f"\\b({'|'.join(iters)})\\b"
        elif "flow" in name and flows:
            pat["match"] = f"\\b({'|'.join(flows)})\\b"
        elif "declaration" in name and decls:
            pat["match"] = f"\\b({'|'.join(decls)})\\b"
        elif "variable" in name and mods:
            pat["match"] = f"\\b({'|'.join(mods)})\\b"

    with open(TMLANG_FILE, "w", encoding="utf-8") as f:
        json.dump(tmlang, f, indent=2)
    print("-> Updated grammar file:", TMLANG_FILE)

    # 4. Copy grammar to server/univrc-hls.lark and server/grammar.lark
    server_hls = os.path.join(SCRIPT_DIR, "server", "univrc-hls.lark")
    server_grammar = os.path.join(SCRIPT_DIR, "server", "grammar.lark")
    src_lark = custom_lark if custom_lark and os.path.exists(custom_lark) else LARK_FILE
    if os.path.exists(src_lark):
        import shutil
        shutil.copy2(src_lark, server_hls)
        shutil.copy2(src_lark, server_grammar)
        print("-> Updated server/univrc-hls.lark & server/grammar.lark fallback")

    # 5. Copy to user extensions folder if present
    user_ext_dir = os.path.expanduser("~/.vscode/extensions/univrc.univrc-syntax-0.1.0")
    if os.path.exists(user_ext_dir):
        import shutil
        for item in ["package.json", "extension.js", "language-configuration.json", "README.md", "icon.png"]:
            src = os.path.join(SCRIPT_DIR, item)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(user_ext_dir, item))
        
        for folder in ["syntaxes", "snippets", "server", "icons"]:
            src_folder = os.path.join(SCRIPT_DIR, folder)
            dst_folder = os.path.join(user_ext_dir, folder)
            os.makedirs(dst_folder, exist_ok=True)
            for f in os.listdir(src_folder):
                shutil.copy2(os.path.join(src_folder, f), os.path.join(dst_folder, f))
        print("-> Updated installed VS Code extension in:", user_ext_dir)

    # 6. Rebuild VSIX
    import build_vsix
    vsix_path = build_vsix.build()
    return vsix_path


def main():
    parser = argparse.ArgumentParser(description="uniVRc Grammar Sync & Release Builder")
    parser.add_argument("--bump", choices=["patch", "minor", "major"], help="Bump version in package.json")
    parser.add_argument("--grammar", help="Path to custom .lark grammar file")
    args = parser.parse_args()

    vsix_file = sync(bump=args.bump, custom_lark=args.grammar)
    print(f"\n[SUCCESS] Sync complete! Output package: {vsix_file}")


if __name__ == "__main__":
    main()
