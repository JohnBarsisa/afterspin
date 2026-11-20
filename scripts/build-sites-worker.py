"""Bundle Afterspin's public assets and provider routes into a self-contained Worker."""
from pathlib import Path
from base64 import b64encode
import json
import shutil
import sys

root = Path(__file__).resolve().parents[1]
source = root / (sys.argv[1] if len(sys.argv) > 1 else ".")
out = root / "dist"
content_types = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp",
}
names = (
    "index.html", "style.css", "core.js", "config.js", "app.js",
    "Afterspin-Offline.html", "spotify-top-picks.html", "spotify-top-picks.js",
    "assets/mark.svg", "assets/ribbon.webp", "assets/brand-studies.svg",
)
routes = {}
for name in names:
    file = source / name
    binary = file.suffix == ".webp"
    value = b64encode(file.read_bytes()).decode("ascii") if binary else file.read_text(encoding="utf-8")
    routes["/" + name] = [content_types[file.suffix], binary, value]
if out.exists():
    shutil.rmtree(out)
(out / "server").mkdir(parents=True)
if (root / ".openai/hosting.json").exists():
    (out / ".openai").mkdir()
    shutil.copyfile(root / ".openai/hosting.json", out / ".openai/hosting.json")
module = (root / "server/spotify-beta.mjs").read_text(encoding="utf-8")
apple_module = (root / "server/apple-token-worker.mjs").read_text(encoding="utf-8")
module += "\n" + apple_module.split("const standaloneAppleMusic=createAppleMusic();", 1)[0]
suffix = """
const spotifyRoute=createSpotifyBeta();
const appleRoute=createAppleMusic([
  'https://afterspin-listening.jpiyady.chatgpt.site',
  'https://johnbarsisa.github.io'
]);
export default {
  async fetch(request,env) {
    const result=await spotifyRoute(request,env);
    if(result)return result;
    const appleResult=await appleRoute(request,env);
    if(appleResult)return appleResult;
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const url=new URL(request.url);
    const key=url.pathname==='/'?'/index.html':url.pathname;
    const asset=Object.hasOwn(afterspinAssets,key)?afterspinAssets[key]:null;
    if(!asset)return new Response('Not found',{status:404});
    const [type,binary,value]=asset;
    const body=request.method==='HEAD'?null:binary?Uint8Array.from(atob(value),c=>c.charCodeAt(0)):value;
    return new Response(body,{headers:{'Content-Type':type,
      'Cache-Control':type.startsWith('text/html')?'no-cache':'public, max-age=120',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  }
};
"""
(out / "server/index.js").write_text(module + "\nconst afterspinAssets=" + json.dumps(routes, ensure_ascii=True, separators=(",", ":")) + ";\n" + suffix, encoding="utf-8")
print(f"Built {out}/server/index.js")
