"""Build the citations of the codebook from tools/refs.json (no runtime JavaScript needed).

In a lesson, a citation marker is written as  <sup class="cite" data-refs="key1,key2"></sup>  after the clause it supports.
This script, run from the repository root (python tools/build_refs.py):
  1. numbers the references of each page in order of first use and fills every marker with links [1, 2];
  2. writes the page's numbered "References" list between <!-- refs:start --> and <!-- refs:end --> (it inserts the pair
     before the lesson navigation the first time);
  3. writes references.html, the whole course's list in alphabetical order, marking which entries the FedBUD paper cites.
The script is idempotent: running it again gives the same files. It stops with an error on an unknown key."""
import html, io, json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
REFS = {r["key"]: r for r in json.loads((ROOT / "tools" / "refs.json").read_text(encoding="utf-8"))}
MARK = re.compile(r'<sup class="cite" data-refs="([^"]+)">.*?</sup>', re.S)
BLOCK = re.compile(r"\n?<!-- refs:start -->.*?<!-- refs:end -->\n?", re.S)
esc = html.escape
ORIGIN = ' <span class="ref-origin">added by the course</span>'


def short_authors(a):
    if len(a) == 1:
        return a[0]
    if len(a) == 2:
        return f"{a[0]} and {a[1]}"
    if len(a) == 3:
        return f"{a[0]}, {a[1]} and {a[2]}"
    return f"{a[0]} et al."


def full_authors(a):
    return a[0] if len(a) == 1 else ", ".join(a[:-1]) + " and " + a[-1]


def entry(r, authors):
    link = r["url"]
    label = "doi.org" if "doi.org" in link else ("arXiv" if "arxiv.org" in link else ("ACL Anthology" if "aclanthology" in link else "PMLR"))
    stop = "" if r["title"].rstrip()[-1:] in "?!" else "."
    return (f"{esc(authors(r['authors']))} ({r['year']}). {esc(r['title'])}{stop} <em>{esc(r['venue'])}</em>. "
            f'<a href="{esc(link)}">{label}</a>')


def build_page(path):
    s = path.read_text(encoding="utf-8")
    order = []
    for m in MARK.finditer(s):
        for k in m.group(1).split(","):
            k = k.strip()
            if k not in REFS:
                raise SystemExit(f"{path.name}: unknown reference key {k}")
            if k not in order:
                order.append(k)
    if not order:
        return 0
    num = {k: i + 1 for i, k in enumerate(order)}
    seen = set()

    def fill(m):
        keys = [k.strip() for k in m.group(1).split(",")]
        parts = []
        for k in keys:
            ident = "" if k in seen else f' id="cite-{k}"'
            seen.add(k)
            parts.append(f'<a href="#ref-{k}"{ident}>{num[k]}</a>')
        return f'<sup class="cite" data-refs="{m.group(1)}">[{", ".join(parts)}]</sup>'

    s = MARK.sub(fill, s)
    items = "\n".join(
        f'      <li id="ref-{k}">{entry(REFS[k], short_authors)} <a class="back" href="#cite-{k}" aria-label="Back to where reference {num[k]} is cited">back</a></li>'
        for k in order)
    block = ("\n<!-- refs:start -->\n  <section class=\"references\" aria-labelledby=\"refs-h\">\n    <h2 id=\"refs-h\">References</h2>\n"
             f"    <ol>\n{items}\n    </ol>\n    <p class=\"note\"><a href=\"../references.html\">All references of the course</a></p>\n  </section>\n<!-- refs:end -->\n")
    if BLOCK.search(s):
        s = BLOCK.sub(block, s, count=1)
    else:
        i = s.index('  <nav class="lesson-nav"')
        s = s[:i].rstrip("\n") + "\n" + block + s[i:]
    path.write_text(s, encoding="utf-8", newline="")
    return len(order)


def build_all_page(used):
    def surname(r):
        a = r["authors"][0]
        return a if a == "Qwen Team" else a.split()[-1] if not a.startswith("Erik F. Tjong") else "Tjong Kim Sang"
    rows = sorted((r for r in REFS.values() if r["key"] in used), key=lambda r: (surname(r).lower(), r["year"]))
    lis = "\n".join(
        f'    <li id="ref-{r["key"]}">{entry(r, full_authors)}'
        f'{"" if r["paper"] else ORIGIN}</li>' for r in rows)
    t = (ROOT / "references.html").read_text(encoding="utf-8") if (ROOT / "references.html").exists() else None
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>References | FedBUD codebook</title>
<meta name="description" content="Every work the FedBUD codebook cites, with links.">
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Crimson+Pro:wght@600;700&display=swap">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to the references</a>
<header class="site-header"><div class="inner">
  <a class="site-title" href="index.html">FedBUD codebook</a>
  <span class="lesson-count">References</span>
</div></header>

<main id="main">
  <h1>References</h1>
  <p class="lead">Every work the lessons cite. Entries without a label are cited in the FedBUD paper. Entries marked “added by the course” teach an idea of a lesson and are not cited in the paper.</p>
  <section class="references" aria-label="All references">
  <ol>
{lis}
  </ol>
  </section>
  <nav class="lesson-nav" aria-label="Lessons">
    <a href="index.html">Back to the course</a>
  </nav>
</main>
</body>
</html>
"""
    (ROOT / "references.html").write_text(page, encoding="utf-8", newline="")
    return len(rows)


used = set()
for p in sorted((ROOT / "lessons").glob("*.html")):
    n = build_page(p)
    used |= {k.strip() for m in MARK.finditer(p.read_text(encoding="utf-8")) for k in m.group(1).split(",")}
    print(f"{p.name}: {n} references")
missing = set(REFS) - used
print(f"references.html: {build_all_page(used)} entries" + (f"; unused in refs.json: {sorted(missing)}" if missing else ""))
