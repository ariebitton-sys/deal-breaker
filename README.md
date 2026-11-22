# Deal Breaker

Fix-and-flip deal analysis and flip management for Kappa Real Estate Investments.

**Live app:** https://ariebitton-sys.github.io/deal-breaker/

## How it's hosted

- `index.html` at the root of this repo is the whole app (one self-contained file). GitHub Pages serves it.
- Every push to `main` updates the live app within a minute or two. Refresh the page to get the new version; the version number is shown in the footer.
- No keys or IDs live in this repo. Google sign-in, the Drive folder, the Claude API key and the Maps key are entered in the app's Settings and stay in each user's browser. Deals are stored in Google Drive.

## Source and build

The source is in `source/`:

| Path | What it is |
| --- | --- |
| `app.jsx` | Main app: calculator, state, Drive save/load |
| `src/pipeline_core.jsx` | Deal model, stages, summaries, Drive and Claude helpers |
| `src/pipeline_ui_*.jsx` | UI: stages and modals (a), deal cards (b), management (c), AI document import (d), icons, Flip analysis groups and results rail (e), navigation rail and header, dashboards with the pipeline funnel, project overview with Next up (f), utilities lookup, status and transfer tasks, with local rules for Indianapolis (Marion County), Cleveland (Cuyahoga County), Lake County and Northeast Ohio county defaults (g), Expenses & Documents: drop zone, ledger with category chips and search, expense window, budget rail, document viewer, invoice reader (h), Expense search across projects (i) |
| `head.html`, `extra.css`, `logo.html` | Page head, styles (v50 design tokens at the top of `extra.css`), embedded logo |
| `VERSION` | Version label shown in the footer |
| `test/` | Calculation regression tests and full-flow UI tests (jsdom) |

```
cd source
npm install        # once
python3 build.py   # writes ../index.html
npm test           # calc, flow, draft, key, utilities, navigation, sign-in, closing, team, PM and expenses tests
```

Then commit `index.html` together with the source change and push to `main`.
