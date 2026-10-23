# Student Task Manager

A mini project built with **HTML, CSS and JavaScript** (no frameworks, no build step) to help students plan assignments, track deadlines and stay organised.

**Live demo:** https://notvish78.github.io/student-task-manager-/ *(after enabling GitHub Pages, see below)*

## Features

- Add, edit and delete tasks (title, subject, due date, priority)
- Mark tasks as Done / Undo
- Search by title or subject
- Filter by status (Pending, Completed, Overdue) and priority
- Live counters (Total, Completed, Pending, Overdue) with a progress bar
- Light and dark theme toggle (remembered across visits)
- Colour-coded priority badges and responsive layout for mobile
- Overdue detection, with relative due labels (Due today, Due tomorrow, 3 days late)
- **Stale task detection:** tasks left pending for 3, 7 or 14 days (your choice) are flagged
- **"Needs your attention" banner** with one-click filters for overdue, due today, due soon and stale tasks
- **Notifications:** in-app toasts plus optional browser notifications for overdue, due-today, due-tomorrow and stale tasks (sent once per task per day, re-checked every minute while the page is open)
- Sort by due date, priority, newest or oldest
- Export / import tasks as a JSON backup file
- "Add Sample Tasks" button for quick demos
- Clear all completed tasks in one click
- Data saved in the browser using Local Storage (survives refresh)
- Form validation with inline error messages
- Motivational quote fetched from an API (with offline fallback)

## Notes on Notifications

- Browser notifications need `localhost` or `https` (Live Server and GitHub Pages both work). They may not work when opening `index.html` directly from the file system.
- Reminders fire only while the page is open in a browser tab.
- Click **Enable Notifications** in the header once and allow the browser prompt.

## Tech Stack

| Layer | Used |
|---|---|
| Structure | HTML5 |
| Styling | CSS3 (Flexbox, Grid) |
| Logic | Vanilla JavaScript (ES6) |
| Storage | `localStorage` + JSON |
| API | `fetch()` with Promises |

## JavaScript Concepts Demonstrated

- Variables, data types, template literals, operators, conditionals
- Functions and arrow functions
- Arrays and objects: `push`, `filter`, `find`, `findIndex`, `splice`, `forEach`, `some`
- DOM manipulation: `getElementById`, `createElement`, `appendChild`, `textContent`
- Events: `submit`, `input`, `change`, `click` using `addEventListener`
- Validation using length checks, `trim()` and `preventDefault()`
- Local Storage with `JSON.stringify()` / `JSON.parse()`
- Fetch API with `.then()`, `.catch()` and `response.ok`
- Date handling, `setInterval()`, Notifications API, `Blob` / `FileReader` for export and import

## Project Structure

```
student-task-manager/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── .gitignore
├── LICENSE
└── README.md
```

## Run Locally

```bash
git clone https://github.com/NotVish78/student-task-manager-.git
cd student-task-manager-
```

Then open `index.html` in a browser, or in VS Code right-click `index.html` → **Open with Live Server**.

## Deploy on GitHub Pages

1. Push the project to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then click **Save**.
4. After a minute, the site is live at `https://<your-username>.github.io/student-task-manager-/`.

## Author

**Vishwas P**, CSE, RV College of Engineering, Bengaluru
GitHub: [@NotVish78](https://github.com/NotVish78)

## License

Released under the [MIT License](LICENSE).

## UI refinements

The original purple theme and vanilla JavaScript structure are retained, with clearer card spacing, responsive form fields, keyboard focus outlines, a task result count and a reset-filters button. Task titles support normal punctuation and Unicode. Past deadlines can be entered for existing overdue work. Invalid saved JSON falls back safely; imported task records are validated before use.
