"""Builds index.html (the hosted app) from src/app.html.

src/app.html is the single source of truth. It is also published unchanged as
the Claude artifact. This script wraps it in a full HTML document and adds the
Supabase client and config.js so it runs on any web host.
"""
import pathlib
root = pathlib.Path(__file__).parent
app = (root / "src" / "app.html").read_text(encoding="utf-8")
head = """<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" href="icons/icon-192.png">
<link rel="alternate icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231c2732'/%3E%3Ctext x='16' y='21' font-family='Arial' font-weight='700' font-size='13' fill='%23e2884d' text-anchor='middle'%3EOX%3C/text%3E%3C/svg%3E">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="config.js"></script>
<meta property="og:title" content="Project Reporting">
<meta property="og:site_name" content="Project Reporting">
<meta property="og:type" content="website">
<meta property="og:url" content="https://zaineddin3.github.io/ox-project-reporting/">
<meta property="og:image" content="https://zaineddin3.github.io/ox-project-reporting/icons/icon-512.png">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Project Reporting">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1c2732">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="OX Reporting">
<script id="ox-install-guide">(function(){var q=new URLSearchParams(location.search);var want=q.get('install');var ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.platform)&&navigator.maxTouchPoints>1);var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;var dp=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();dp=e;var b=document.getElementById('oxig-go');if(b)b.hidden=false});if(want===null||standalone)return;try{history.replaceState(null,'',location.pathname+location.hash)}catch(e){}function show(){var d=document.createElement('div');d.id='oxig';d.setAttribute('role','dialog');d.innerHTML='<div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998"></div><div style="position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:99999;background:#fff;color:#1c2732;border-radius:16px;padding:18px 18px 14px;box-shadow:0 10px 40px rgba(0,0,0,.35);font:16px/1.45 system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto"><b style="font-size:18px">Install Project Reporting</b>'+(ios?'<ol style="margin:10px 0 6px;padding-left:22px"><li>Tap the <b>Share</b> button <span style="display:inline-block;border:1.5px solid #1c2732;border-radius:4px;width:16px;height:16px;text-align:center;line-height:13px;font-size:12px">&uarr;</span> in Safari&rsquo;s toolbar (bottom of the screen on iPhone, top on iPad).</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open <b>OX Reporting</b> from your home screen and sign in.</li></ol><p style="margin:4px 0 10px;font-size:13px;color:#5d6670">Not in Safari? Open this page in Safari first; iPhones only install apps from Safari.</p>':'<p style="margin:10px 0">Tap <b>Install</b> below, or use the browser menu &#8942; &rarr; <b>Install app</b>. It then opens from your home screen like any other app.</p><p><button id="oxig-go" hidden style="background:#b5541c;color:#fff;border:0;border-radius:10px;padding:11px 18px;font-weight:700;font-size:16px">Install</button></p>')+'<div style="text-align:right"><button id="oxig-x" style="background:none;border:1px solid #d6d0c7;border-radius:10px;padding:8px 14px;font-size:15px">Close</button></div></div>';document.body.appendChild(d);d.querySelector('#oxig-x').onclick=function(){d.remove()};var g=d.querySelector('#oxig-go');if(g){if(dp)g.hidden=false;g.onclick=function(){if(!dp)return;dp.prompt();dp.userChoice.finally(function(){d.remove()})}}}if(document.readyState==='loading')addEventListener('DOMContentLoaded',show);else show()})();</script>
<script>if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))</script>
</head>
<body>
"""
(root / "index.html").write_text(head + app + "\n</body>\n</html>\n", encoding="utf-8")
print("Built index.html")

# Desktop app copy: same app, with the libraries bundled so it starts without fetching them.
desk = (head.replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>', '<script src="lib/supabase.js"></script>')
            .replace('<script src="config.js"></script>', ''))
desk = "\n".join(l for l in desk.split("\n") if "manifest" not in l and "serviceWorker" not in l and "apple-" not in l and "ox-install-guide" not in l)
desk_app = (app.replace("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "lib/jspdf.umd.min.js")
               .replace("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js", "lib/jspdf.plugin.autotable.min.js")
               .replace("https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js", "lib/exceljs.min.js"))
desk = desk.replace('<link rel="icon" href="icons/icon-192.png">', '')
(root / "desktop" / "app" / "index.html").write_text(desk + desk_app + "\n</body>\n</html>\n", encoding="utf-8")
print("Built desktop/app/index.html")
