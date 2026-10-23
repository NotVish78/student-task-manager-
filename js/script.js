// ---------- Constants & Data (Arrays + Objects + Local Storage + JSON) ----------
const DAY = 24 * 60 * 60 * 1000;
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

// A damaged backup should not prevent the rest of the page from loading.
function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch (error) { return fallback; }
}

function validTask(t) {
  return t && typeof t.title === "string" && t.title.trim().length >= 3 && t.title.length <= 60 &&
    typeof t.subject === "string" && t.subject.trim().length > 0 && t.subject.length <= 60 &&
    typeof t.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) &&
    !Number.isNaN(Date.parse(t.dueDate)) && new Date(t.dueDate).toISOString().slice(0, 10) === t.dueDate &&
    Object.hasOwn(PRIORITY_ORDER, t.priority) && typeof t.completed === "boolean";
}

const savedTasks = readSaved("tasks", []);
let tasks = Array.isArray(savedTasks) ? savedTasks.filter(validTask) : [];
let staleDays = Number(readSaved("staleDays", 7));
if (![3, 7, 14].includes(staleDays)) staleDays = 7;
let editId = null; // null = adding, otherwise id of the task being edited
let lastDate = "";

// Older saved tasks may not have createdAt, so fall back to their id (a timestamp)
tasks.forEach((t, i) => {
  if (!Number.isFinite(t.createdAt)) t.createdAt = Number.isFinite(t.id) ? t.id : Date.now();
  if (!Number.isFinite(t.id) || tasks.slice(0, i).some(other => other.id === t.id)) t.id = nextTaskId();
});

function nextTaskId() {
  let id = Date.now();
  while (tasks.some(t => t.id === id)) id++;
  return id;
}

function saveTasks() {
  try { localStorage.setItem("tasks", JSON.stringify(tasks)); }
  catch (error) { showToast("Could not save. Export a backup before closing this tab.", "error"); }
}

// ---------- Date Helpers ----------
function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayString() {
  return localDateString(new Date());
}

function offsetDate(days) {
  return localDateString(new Date(Date.now() + days * DAY));
}

// Days from today until the due date (negative = late)
function daysUntil(task) {
  const due = new Date(task.dueDate + "T00:00:00");
  const today = new Date(todayString() + "T00:00:00");
  return Math.round((due - today) / DAY);
}

// How many days ago the task was created
function ageInDays(task) {
  return Math.floor((Date.now() - task.createdAt) / DAY);
}

function isOverdue(task) {
  return !task.completed && daysUntil(task) < 0;
}

// Stale = still pending after staleDays or more
function isStale(task) {
  return !task.completed && ageInDays(task) >= staleDays;
}

function dueLabel(task) {
  const d = daysUntil(task);
  if (d < 0) return `${-d} day${-d > 1 ? "s" : ""} late`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

// ---------- Toast Notifications (in-app) ----------
function showToast(message, type = "info") {
  const container = document.getElementById("toasts");
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  container.appendChild(toast);
  while (container.children.length > 3) container.firstElementChild.remove();

  setTimeout(function () {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ---------- Browser Notifications ----------
function updateNotifyBtn() {
  const btn = document.getElementById("notifyBtn");
  if (!("Notification" in window)) {
    btn.style.display = "none";
    return;
  }
  if (Notification.permission === "granted") btn.textContent = "Notifications: On";
  else if (Notification.permission === "denied") btn.textContent = "Notifications: Blocked";
  else btn.textContent = "Enable Notifications";
}

document.getElementById("notifyBtn").addEventListener("click", function () {
  if (Notification.permission === "granted") {
    showToast("Notifications are already on.", "success");
  } else if (Notification.permission === "denied") {
    showToast("Notifications are blocked. Allow them in your browser's site settings.", "error");
  } else {
    Notification.requestPermission().then(function (permission) {
      updateNotifyBtn();
      if (permission === "granted") {
        showToast("Notifications enabled!", "success");
        checkReminders();
      } else {
        showToast("Notification permission was not granted.", "warning");
      }
    });
  }
});

function sendBrowserNotification(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body: body, tag: tag });
  } catch (error) {
    // Some mobile browsers do not allow the Notification constructor
  }
}

// Each reminder is sent once per task, per type, per day
function checkReminders() {
  const today = todayString();
  let sent = readSaved("notified", []);
  if (!Array.isArray(sent)) sent = [];
  sent = sent.filter(key => typeof key === "string" && key.startsWith(today)); // forget old days

  const messages = [];

  tasks.filter(t => !t.completed).forEach(function (task) {
    const d = daysUntil(task);
    let type = null;
    let title = "";
    let body = "";

    if (d < 0) {
      type = "overdue";
      title = "Overdue task";
      body = `"${task.title}" (${task.subject}) was due on ${task.dueDate}`;
    } else if (d === 0) {
      type = "today";
      title = "Due today";
      body = `"${task.title}" (${task.subject}) is due today`;
    } else if (d === 1) {
      type = "tomorrow";
      title = "Due tomorrow";
      body = `"${task.title}" (${task.subject}) is due tomorrow`;
    } else if (isStale(task)) {
      type = "stale";
      title = "Task pending for a long time";
      body = `"${task.title}" has been pending for ${ageInDays(task)} days`;
    }

    if (!type) return;

    const key = `${today}|${task.id}|${type}`;
    if (sent.includes(key)) return;

    sent.push(key);
    messages.push({ title: title, body: body, key: key });
  });

  localStorage.setItem("notified", JSON.stringify(sent));
  if (messages.length === 0) return;

  // Browser notifications (max 5, then one summary)
  messages.slice(0, 5).forEach(m => sendBrowserNotification(m.title, m.body, m.key));
  if (messages.length > 5) {
    sendBrowserNotification("More reminders", `${messages.length - 5} more tasks need attention`, "more");
  }

  // One in-app toast summarising the reminders
  const extra = messages.length > 1 ? ` (+${messages.length - 1} more)` : "";
  showToast(`${messages[0].title}: ${messages[0].body}${extra}`, "warning");
}

// ---------- Form Validation (Regex + trim + preventDefault) ----------
function validateForm(title, subject, dueDate) {
  let valid = true;
  document.querySelectorAll(".error").forEach(e => e.textContent = "");

  if (title.length < 3 || title.length > 60) {
    document.getElementById("titleError").textContent = "Title must be 3-60 characters";
    valid = false;
  }
  if (!subject || subject.length > 60) {
    document.getElementById("subjectError").textContent = "Subject is required (up to 60 characters)";
    valid = false;
  }
  if (!dueDate) {
    document.getElementById("dueDateError").textContent = "Due date is required";
    valid = false;
  }
  return valid;
}

// ---------- Add / Update Task ----------
document.getElementById("taskForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const title = document.getElementById("title").value.trim();
  const subject = document.getElementById("subject").value.trim();
  const dueDate = document.getElementById("dueDate").value;
  const priority = document.getElementById("priority").value;

  if (!validateForm(title, subject, dueDate)) return;

  if (editId === null) {
    const task = {
      id: nextTaskId(),
      title: title,
      subject: subject,
      dueDate: dueDate,
      priority: priority,
      completed: false,
      createdAt: Date.now()
    };
    tasks.push(task);
    showToast("Task added!", "success");
  } else {
    const task = tasks.find(t => t.id === editId);
    task.title = title;
    task.subject = subject;
    task.dueDate = dueDate;
    task.priority = priority;
    resetForm();
    showToast("Task updated.", "success");
  }

  saveTasks();
  this.reset();
  document.getElementById("priority").value = "Medium";
  render();
  checkReminders();
});

// Clear an error as soon as the user types
document.querySelectorAll("#taskForm input").forEach(input => {
  input.addEventListener("input", function () {
    const error = document.getElementById(this.id + "Error");
    if (error && this.value.trim()) error.textContent = "";
  });
});

// ---------- Toggle / Edit / Delete ----------
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  task.completed = !task.completed;
  saveTasks();
  render();
  showToast(task.completed ? "Nice work! Task completed." : "Task moved back to pending.", task.completed ? "success" : "info");
}

function startEdit(id) {
  const task = tasks.find(t => t.id === id);
  editId = id;
  document.getElementById("title").value = task.title;
  document.getElementById("subject").value = task.subject;
  document.getElementById("dueDate").value = task.dueDate;
  document.getElementById("priority").value = task.priority;
  document.getElementById("formHeading").textContent = "Edit Task";
  document.getElementById("submitBtn").textContent = "Update Task";
  document.getElementById("cancelBtn").style.display = "inline-block";
  document.getElementById("title").focus();
  document.getElementById("taskForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetForm() {
  editId = null;
  document.getElementById("taskForm").reset();
  document.getElementById("priority").value = "Medium";
  document.getElementById("formHeading").textContent = "Add New Task";
  document.getElementById("submitBtn").textContent = "Add Task";
  document.getElementById("cancelBtn").style.display = "none";
  document.querySelectorAll(".error").forEach(e => e.textContent = "");
}

document.getElementById("cancelBtn").addEventListener("click", resetForm);

function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  // findIndex -> splice
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) tasks.splice(index, 1);
  if (editId === id) resetForm();
  saveTasks();
  render();
  showToast("Task deleted.", "error");
}

document.getElementById("clearCompleted").addEventListener("click", function () {
  if (!tasks.some(t => t.completed)) {
    showToast("No completed tasks to clear.", "info");
    return;
  }
  if (!confirm("Remove all completed tasks?")) return;
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  render();
  showToast("Completed tasks cleared.", "success");
});

// ---------- Search + Filters + Sorting ----------
function matchesStatus(task, status) {
  const d = daysUntil(task);
  if (status === "Pending") return !task.completed;
  if (status === "Completed") return task.completed;
  if (status === "Overdue") return isOverdue(task);
  if (status === "Due Today") return !task.completed && d === 0;
  if (status === "Due Soon") return !task.completed && d >= 1 && d <= 2;
  if (status === "Stale") return isStale(task);
  return true; // All
}

function getVisibleTasks() {
  const text = document.getElementById("search").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const priority = document.getElementById("priorityFilter").value;

  return tasks.filter(function (t) {
    const matchesText =
      t.title.toLowerCase().includes(text) ||
      t.subject.toLowerCase().includes(text);
    const matchesPriority = priority === "All" || t.priority === priority;
    return matchesText && matchesStatus(t, status) && matchesPriority;
  });
}

function sortTasks(list) {
  const mode = document.getElementById("sortSelect").value;
  return list.slice().sort(function (a, b) {
    if (a.completed !== b.completed) return a.completed ? 1 : -1; // completed go last
    if (mode === "priority") {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.dueDate.localeCompare(b.dueDate);
    }
    if (mode === "newest") return b.createdAt - a.createdAt;
    if (mode === "oldest") return a.createdAt - b.createdAt;
    return a.dueDate.localeCompare(b.dueDate); // due date
  });
}

document.getElementById("search").addEventListener("input", render);
document.getElementById("statusFilter").addEventListener("change", render);
document.getElementById("priorityFilter").addEventListener("change", render);
document.getElementById("sortSelect").addEventListener("change", render);

document.getElementById("staleSelect").addEventListener("change", function () {
  staleDays = Number(this.value);
  localStorage.setItem("staleDays", staleDays);
  render();
  showToast(`Tasks pending for ${staleDays}+ days are now marked stale.`, "info");
});

// ---------- Rendering (DOM Manipulation) ----------
function makeButton(label, className, handler) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = className;
  btn.addEventListener("click", handler);
  return btn;
}

function makeChip(text, className) {
  const chip = document.createElement("span");
  chip.className = "chip " + className;
  chip.textContent = text;
  return chip;
}

function render() {
  const list = document.getElementById("taskList");
  list.innerHTML = "";

  const visible = sortTasks(getVisibleTasks());
  document.getElementById("visibleCount").textContent = `${visible.length} of ${tasks.length} tasks`;

  if (visible.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = tasks.length === 0
      ? "No tasks yet. Add your first task above!"
      : "No tasks match your search/filter.";
    list.appendChild(li);
  }

  visible.forEach(function (task) {
    const li = document.createElement("li");
    li.className = "task " + task.priority + (task.completed ? " completed" : "");

    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.appendChild(makeChip(task.subject, ""));
    meta.appendChild(makeChip(task.priority, task.priority));

    if (task.completed) {
      meta.appendChild(makeChip("Due: " + task.dueDate, ""));
    } else {
      const d = daysUntil(task);
      const dueClass = d < 0 ? "overdue" : d === 0 ? "today" : d <= 2 ? "soon" : "";
      meta.appendChild(makeChip(`${task.dueDate} | ${dueLabel(task)}`, dueClass));
      meta.appendChild(makeChip("Added " + (ageInDays(task) === 0 ? "today" : ageInDays(task) + "d ago"), "age"));
      if (isStale(task)) {
        meta.appendChild(makeChip(`STALE ${ageInDays(task)}d`, "stale"));
      }
    }

    info.appendChild(title);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(makeButton(task.completed ? "Undo" : "Done", "btn-green", () => toggleTask(task.id)));
    actions.appendChild(makeButton("Edit", "btn-orange", () => startEdit(task.id)));
    actions.appendChild(makeButton("Delete", "btn-red", () => deleteTask(task.id)));

    li.appendChild(info);
    li.appendChild(actions);
    list.appendChild(li);
  });

  updateStats();
  renderAlerts();
}

function updateStats() {
  const done = tasks.filter(t => t.completed).length;
  document.getElementById("totalCount").textContent = tasks.length;
  document.getElementById("doneCount").textContent = done;
  document.getElementById("pendingCount").textContent = tasks.length - done;
  document.getElementById("overdueCount").textContent = tasks.filter(t => isOverdue(t)).length;
  document.getElementById("staleCount").textContent = tasks.filter(t => isStale(t)).length;

  const percent = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressText").textContent = percent + "%";
}

// "Needs your attention" banner: each button applies the matching filter
function renderAlerts() {
  const box = document.getElementById("alerts");
  box.innerHTML = "";

  const items = [
    { text: "overdue", filter: "Overdue", cls: "a-red" },
    { text: "due today", filter: "Due Today", cls: "a-orange" },
    { text: "due in 1-2 days", filter: "Due Soon", cls: "a-yellow" },
    { text: `pending for ${staleDays}+ days`, filter: "Stale", cls: "a-purple" }
  ].map(function (item) {
    item.count = tasks.filter(t => matchesStatus(t, item.filter)).length;
    return item;
  }).filter(item => item.count > 0);

  if (items.length === 0) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";

  const heading = document.createElement("h3");
  heading.textContent = "Needs your attention";
  box.appendChild(heading);

  const row = document.createElement("div");
  row.className = "alert-list";
  items.forEach(function (item) {
    row.appendChild(makeButton(`${item.count} ${item.text}`, "alert-btn " + item.cls, function () {
      document.getElementById("statusFilter").value = item.filter;
      render();
    }));
  });
  box.appendChild(row);
}

// ---------- Sample Data, Export & Import (JSON) ----------
document.getElementById("demoBtn").addEventListener("click", function () {
  if (!confirm("Add sample tasks (overdue, due today, due soon and stale)?")) return;

  const now = Date.now();
  const samples = [
    { title: "Submit DBMS assignment", subject: "DBMS", dueDate: offsetDate(-2), priority: "High", age: 5 },
    { title: "Prepare for Java quiz", subject: "Java", dueDate: offsetDate(0), priority: "High", age: 2 },
    { title: "Write lab record", subject: "Web Technology", dueDate: offsetDate(1), priority: "Medium", age: 1 },
    { title: "Revise DSA notes", subject: "DSA", dueDate: offsetDate(10), priority: "Low", age: 12 },
    { title: "Read research paper", subject: "AI Foundations", dueDate: offsetDate(20), priority: "Low", age: 9 }
  ];

  samples.forEach(function (s, i) {
    tasks.push({
      id: nextTaskId(),
      title: s.title,
      subject: s.subject,
      dueDate: s.dueDate,
      priority: s.priority,
      completed: false,
      createdAt: now - s.age * DAY
    });
  });

  saveTasks();
  render();
  checkReminders();
});

document.getElementById("exportBtn").addEventListener("click", function () {
  if (tasks.length === 0) {
    showToast("Nothing to export yet.", "info");
    return;
  }
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tasks-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Tasks exported as tasks-backup.json", "success");
});

document.getElementById("importBtn").addEventListener("click", function () {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Invalid file");

      let added = 0;
      data.forEach(function (t) {
        const valid = validTask(t);
        const exists = tasks.some(x => x.id === t.id);
        if (valid && !exists) {
          tasks.push({
            id: Number.isFinite(t.id) ? t.id : nextTaskId(),
            title: String(t.title),
            subject: String(t.subject),
            dueDate: t.dueDate,
            priority: t.priority,
            completed: Boolean(t.completed),
            createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now()
          });
          added++;
        }
      });

      saveTasks();
      render();
      showToast(`Imported ${added} task(s).`, added > 0 ? "success" : "warning");
    } catch (error) {
      showToast("Could not import: invalid JSON file.", "error");
    }
  };
  reader.readAsText(file);
  this.value = ""; // allow importing the same file again
});

// ---------- API (fetch + Promise + error handling) ----------
function loadQuote() {
  fetch("https://dummyjson.com/quotes/random")
    .then(response => {
      if (!response.ok) {
        throw new Error("Request failed: " + response.status);
      }
      return response.json();
    })
    .then(data => {
      document.getElementById("quote").textContent = `"${data.quote}" - ${data.author}`;
    })
    .catch(error => {
      document.getElementById("quote").textContent = "Stay focused and finish one task at a time!";
    });
}

// ---------- Dark Mode (saved in Local Storage) ----------
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  document.getElementById("themeBtn").textContent = isDark ? "Light Mode" : "Dark Mode";
  localStorage.setItem("darkMode", JSON.stringify(isDark));
}

document.getElementById("themeBtn").addEventListener("click", function () {
  applyTheme(!document.body.classList.contains("dark"));
});

document.getElementById("resetFilters").addEventListener("click", function () {
  document.getElementById("search").value = "";
  document.getElementById("statusFilter").value = "All";
  document.getElementById("priorityFilter").value = "All";
  document.getElementById("sortSelect").value = "due";
  render();
});

// ---------- Start ----------
applyTheme(readSaved("darkMode", false) === true);
document.getElementById("staleSelect").value = String(staleDays);
// Past dates are allowed so existing overdue assignments can be entered.
updateNotifyBtn();
loadQuote();
lastDate = todayString();
render();
checkReminders();

// Re-check every minute (also refreshes labels after midnight)
setInterval(function () {
  if (todayString() !== lastDate) {
    lastDate = todayString();

    render();
  }
  checkReminders();
}, 60 * 1000);
