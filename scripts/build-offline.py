"""Create the standalone Afterspin browser app from repository sources."""
from base64 import b64encode
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")


def data_uri(path, mime):
    return f"data:{mime};base64," + b64encode((root / path).read_bytes()).decode("ascii")


images = {
    path: data_uri(path, mime)
    for path, mime in (
        ("assets/mark.svg", "image/svg+xml"),
        ("assets/ribbon.webp", "image/webp"),
        ("assets/brand-studies.svg", "image/svg+xml"),
    )
}
# Use only one copy of the large ribbon. It is also the story backdrop.
css = css.replace("url(assets/ribbon.webp)", "var(--offline-ribbon)")
html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>")
html = html.replace('<body>', '<body id="top">').replace('href="./"', 'href="#top"')
html = html.replace(
    'href="assets/brand-studies.svg" target="_blank" rel="noreferrer"',
    'href="assets/brand-studies.svg" download="afterspin-logo-directions.svg"',
)
for path, uri in images.items():
    html = html.replace(f'"{path}"', f'"{uri}"')

scripts = {name: (root / name).read_text(encoding="utf-8") for name in ("core.js", "app.js")}
# The offline copy never loads the Apple MusicKit SDK.
scripts["config.js"] = "window.AFTERSPIN_CONFIG = Object.freeze({appleTokenEndpoint: ''});"
scripts["config.js"] += """
const offlineRibbon = document.querySelector('.ribbon').getAttribute('src');
document.documentElement.style.setProperty('--offline-ribbon', 'url("' + offlineRibbon + '")');
"""
for name, js in scripts.items():
    if re.search(r"</script", js, re.IGNORECASE):
        raise ValueError(f"{name} cannot be embedded in an HTML script tag")
    tag = f'<script src="{name}" defer></script>'
    if tag not in html:
        raise ValueError(f"Source script tag not found: {name}")
    html = html.replace(tag, f"<script>\n{js}\n</script>")

(root / "Afterspin-Offline.html").write_text(html, encoding="utf-8")
