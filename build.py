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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231c2732'/%3E%3Ctext x='16' y='21' font-family='Arial' font-weight='700' font-size='13' fill='%23e2884d' text-anchor='middle'%3EOX%3C/text%3E%3C/svg%3E">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
<script src="config.js"></script>
</head>
<body>
"""
(root / "index.html").write_text(head + app + "\n</body>\n</html>\n", encoding="utf-8")
print("Built index.html")
