# FedBUD codebook

An interactive course that teaches federated budgeted decomposition (FedBUD) step by step: why small clients cannot train a large language model alone, how FedBUD cuts one sub-network per client within its budget, and how the clients train their sub-networks together without sharing data.

Ten lessons and an index. Each lesson explains one idea in plain words, has an interactive element, asks one to four questions with a "Show the result" control, offers a Python cell, and ends with a summary.

## How it runs

- Plain HTML, CSS and JavaScript. No build step and no server code.
- Toy models train in the student's browser: TensorFlow.js 4.22.0 for the small transformer layer (Lessons 4, 6 and 7), plain JavaScript for the other toys.
- Python cells run in the browser through Pyodide 0.26.4 with NumPy, loaded only when a student presses Run.
- Libraries load from cdn.jsdelivr.net at pinned versions, and fonts from Google Fonts.
- Statements about the method and every number in Lesson 10 come from the paper. Numbers that the toy models produce are labeled as the student's own results.

## Preview on your computer

```
python .checks/serve.py 8791
```

Then open http://127.0.0.1:8791/. A local server is needed because the pages load JavaScript modules, which browsers block on `file://` pages. (`.checks/` is not published.)

## Publish on GitHub Pages

After pushing this folder to a GitHub repository, enable Pages for the `main` branch and the root folder in one step:

```
gh api -X POST repos/OWNER/REPO/pages -f "source[branch]=main" -f "source[path]=/"
```

The site then appears at `https://OWNER.github.io/REPO/`.

## Layout

```
index.html                 the course start page
lessons/01-...10-*.html    one page per lesson
assets/css/style.css       the one stylesheet
assets/js/common.js        questions, Python cells (Pyodide), small SVG charts
assets/js/toy-transformer.js  the toy transformer layer (Lessons 4, 6, 7)
assets/js/toy-mlp.js       the toy federation with different sub-networks (Lessons 8, 9)
assets/js/lessonNN.js      the interactive part of each lesson
```

## Open items before publishing

- Paper link, authors and license: to be decided by the authors (the index has a placeholder).
