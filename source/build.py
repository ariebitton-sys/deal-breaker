"""Build Deal Breaker into a single HTML file: ../index.html (served by GitHub Pages).

Usage (from this folder):  npm install   (once)   then   python3 build.py
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'index.html')
DIST = os.path.join(HERE, 'dist')
os.makedirs(DIST, exist_ok=True)

PARTS = ['pipeline_core.jsx', 'pipeline_ui_a.jsx', 'pipeline_ui_b.jsx', 'pipeline_ui_c.jsx',
         'pipeline_ui_d.jsx', 'pipeline_ui_e.jsx', 'pipeline_ui_f.jsx', 'pipeline_ui_g.jsx', 'pipeline_ui_h.jsx', 'pipeline_ui_i.jsx', 'pipeline_ui_j.jsx', 'pipeline_ui_k.jsx']
read = lambda *p: open(os.path.join(HERE, *p), encoding='utf-8').read()
version = read('VERSION').strip()

app = read('app.jsx')
i = app.index('function App() {')
full = f'const APP_VERSION = {version!r};\n' + app[:i] + '\n'.join(read('src', n) for n in PARTS) + '\n' + app[i:]
jsx_path, js_path = os.path.join(DIST, 'app.jsx'), os.path.join(DIST, 'app.js')
open(jsx_path, 'w', encoding='utf-8').write(full)

r = subprocess.run(['node', '-e', '''
const babel=require("@babel/core"),fs=require("fs");
const out=babel.transformSync(fs.readFileSync(process.argv[1],"utf8"),{babelrc:false,configFile:false,compact:false,sourceType:"script",presets:[["@babel/preset-react",{runtime:"classic"}]]});
fs.writeFileSync(process.argv[2],out.code);
''', jsx_path, js_path], cwd=HERE, capture_output=True, text=True)
if r.returncode:
    print(r.stderr[:3000]); sys.exit(1)
js = open(js_path, encoding='utf-8').read()
assert '</script' not in js, 'script terminator inside JS'

head = read('head.html')
assert head.count('</style>') == 1
head = head.replace('</style>', read('extra.css') + '</style>')
html = head + read('logo.html') + '<script>' + js + '</script></body></html>'
open(OUT, 'w', encoding='utf-8').write(html)

r = subprocess.run(['node', '--check', js_path], capture_output=True, text=True)
print('node --check:', 'OK' if r.returncode == 0 else r.stderr[:500])
print(f'{version}: index.html {len(html):,} bytes')
