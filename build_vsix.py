"""Script to pack the uniVRc extension into a standard .vsix archive without requiring Node.js or vsce."""
import os
import zipfile
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PACKAGE_JSON_FILE = os.path.join(BASE_DIR, "package.json")

def get_package_info():
    with open(PACKAGE_JSON_FILE, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    version = pkg.get("version", "0.2.0")
    publisher = pkg.get("publisher", "univrc")
    name = pkg.get("name", "univrc")
    return name, version, publisher

CONTENT_TYPES_XML = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="py" ContentType="text/x-python" />
  <Default Extension="lark" ContentType="text/plain" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
</Types>
"""

def generate_vsix_manifest(name, version, publisher):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Id="{name}" Version="{version}" Language="en-US" Publisher="{publisher}" />
    <DisplayName>uniVRc IntelliSense</DisplayName>
    <Description>Official uniVRc IntelliSense: Real-time Lark syntax diagnostics, syntax highlighting, file icons, and snippets for uniVRc (.vr) HLS language.</Description>
    <Categories>Programming Languages,Linters,Snippets</Categories>
    <Icon>extension/icon.png</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  </Assets>
</PackageManifest>
""".strip()

FILES_TO_PACK = [
    "package.json",
    "extension.js",
    "language-configuration.json",
    "README.md",
    "icon.png",
    os.path.join("syntaxes", "univrc.tmLanguage.json"),
    os.path.join("snippets", "univrc.json"),
    os.path.join("server", "analyzer.py"),
    os.path.join("server", "visualizer_bridge.py"),
    os.path.join("server", "grammar.lark"),
    os.path.join("icons", "icon-theme.json"),
    os.path.join("icons", "vr_icon.png"),
    os.path.join("icons", "vr_icon_64.png"),
    os.path.join("icons", "vr_icon_32.png"),
    os.path.join("icons", "file.png"),
    os.path.join("icons", "folder.png"),
    os.path.join("icons", "folder_open.png"),
]

def build():
    name, version, publisher = get_package_info()
    output_vsix = os.path.join(BASE_DIR, f"{name}-{version}.vsix")
    manifest_xml = generate_vsix_manifest(name, version, publisher)

    print(f"Building {output_vsix} (v{version}) ...")
    with zipfile.ZipFile(output_vsix, "w", zipfile.ZIP_DEFLATED) as zf:
        # Write root metadata
        zf.writestr("[Content_Types].xml", CONTENT_TYPES_XML.strip())
        zf.writestr("extension.vsixmanifest", manifest_xml)
        
        # Write extension payload
        for rel_path in FILES_TO_PACK:
            full_path = os.path.join(BASE_DIR, rel_path)
            if os.path.exists(full_path):
                arcname = "extension/" + rel_path.replace("\\", "/")
                zf.write(full_path, arcname)
                print(f"  Added {arcname}")
            else:
                print(f"  WARNING: File missing {full_path}")

    print(f"Successfully generated {output_vsix} ({os.path.getsize(output_vsix)} bytes).")
    return output_vsix

if __name__ == "__main__":
    build()
