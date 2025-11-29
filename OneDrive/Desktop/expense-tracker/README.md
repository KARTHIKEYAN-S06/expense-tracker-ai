Expense Tracker
===============

Simple expense tracker built with HTML/CSS/JS using localStorage.

Files:
- index.html
- style.css
- script.js

How to run locally:
1. Put files into a folder (expense-tracker).
2. Open index.html in your browser (double-click or use a local server).
   Recommended (for consistent behavior): run a simple static server:
   - Python 3: `python -m http.server 5500` then open http://localhost:5500
   - Or use VS Code Live Server extension.

Deployment options:
- GitHub Pages: push repo to GitHub, enable Pages from `gh-pages` or `main` branch. (See steps below.)
- Netlify: drag-and-drop folder or connect repo.
- Vercel: connect repo and deploy as static site.

Notes:
- Data persists in browser localStorage under key `expense_tracker_transactions_v1`.
- Clear All removes all saved transactions.
