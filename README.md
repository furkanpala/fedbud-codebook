# FedBUD codebook

An interactive course that teaches federated budgeted decomposition (FedBUD) step by step: why small clients cannot train a large language model alone, how FedBUD cuts one sub-network per client within its budget, and how the clients train their sub-networks together without sharing data.

Ten lessons and an index. Each lesson explains one idea in plain words, has an interactive element, asks one to four questions with a "Show the result" control, offers a Python cell, and ends with a summary.

## How it runs

- Plain HTML, CSS and JavaScript. No build step and no server code.
- Toy models train in the student's browser: TensorFlow.js 4.22.0 for the small transformer layer (Lessons 4, 6 and 7), plain JavaScript for the other toys.
- Python cells run in the browser through Pyodide 0.26.4 with NumPy, loaded only when a student presses Run.
- Libraries load from cdn.jsdelivr.net at pinned versions, and fonts from Google Fonts.
- Statements about the method and every number in Lessons 9 and 10 come from the paper. The pages label the numbers that the toy models produce as the student's own results.

## Preview on your computer

```
python .checks/serve.py 8791
```

Then open http://127.0.0.1:8791/. The pages need a local server, because browsers block JavaScript modules on `file://` pages. (`.checks/` is not published.)

## Publish on GitHub Pages

After pushing this folder to a GitHub repository, enable Pages for the `main` branch and the root folder in one step:

```
gh api -X POST repos/OWNER/REPO/pages -f "source[branch]=main" -f "source[path]=/"
```

Or, in the repository's Settings, Pages, choose Deploy from a branch, branch `main`, folder `/ (root)`.

The site appears at `https://OWNER.github.io/REPO/` about a minute after the first deploy.

## Layout

```
index.html                 the course start page
lessons/01-...10-*.html    one page per lesson
assets/css/style.css       the one stylesheet
assets/js/common.js        questions, Python cells (Pyodide), small SVG charts
assets/js/toy-transformer.js  the toy transformer layer (Lessons 4, 6, 7)
assets/js/toy-mlp.js       the toy federation with different sub-networks (Lessons 8, 9)
assets/js/lessonNN.js      the interactive part of each lesson
assets/js/anim.js          the engine of the live figures (play, pause, step, speed, reduced motion)
assets/js/figNN.js         the live figure of each lesson
references.html            every cited work, generated
tools/refs.json            the reference list (each entry checked against its DOI, arXiv or proceedings record)
tools/build_refs.py        numbers the citation markers of each lesson and writes the reference lists
```

## Citations

In a lesson, write a marker after the clause it supports, for example
`<sup class="cite" data-refs="mcmahan2017"></sup>`, add the entry to `tools/refs.json` if it is new, and run
`python tools/build_refs.py` from the repository root. The script numbers the markers of every page, writes each
page's reference list and rebuilds `references.html`. Running it twice gives the same files.

## Open items before publishing

- License: MIT (see LICENSE). The paper link and the author list are added when the paper's review ends.
