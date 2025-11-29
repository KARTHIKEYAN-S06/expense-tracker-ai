/* script.js — cleaned & consolidated
   - No barcode scanning
   - Voice-to-text transaction add
   - AI chatbot (offline, data-aware)
   - Profiles, themes, goals/budgets, prediction, export/import
*/

/* -------------------- Constants & Helpers -------------------- */
const APP_KEY = "expense_tracker_multi_v1";
const THEME_KEY = "expense_tracker_theme_v1";
const DEFAULT_PROFILE = "Me";

function uid() {
  return "id_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}
function fmt(n) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function showToast(msg, ms = 3000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), ms);
}

/* -------------------- App State -------------------- */
function initialProfileState() {
  return {
    transactions: [],
    categories: [
      "General",
      "Food",
      "Transport",
      "Salary",
      "Shopping",
      "Bills",
      "Savings",
    ],
    budgets: [],
    goals: [],
    recurring: [],
    lastRecurringMonth: null,
  };
}
function loadApp() {
  try {
    const raw = localStorage.getItem(APP_KEY);
    return raw
      ? JSON.parse(raw)
      : {
          profiles: { [DEFAULT_PROFILE]: initialProfileState() },
          currentProfile: DEFAULT_PROFILE,
        };
  } catch (e) {
    return {
      profiles: { [DEFAULT_PROFILE]: initialProfileState() },
      currentProfile: DEFAULT_PROFILE,
    };
  }
}
let app = loadApp();
if (!app.currentProfile) app.currentProfile = DEFAULT_PROFILE;
if (!app.profiles[app.currentProfile])
  app.profiles[app.currentProfile] = initialProfileState();

function saveApp() {
  localStorage.setItem(APP_KEY, JSON.stringify(app));
}
function getState() {
  return app.profiles[app.currentProfile];
}
function setProfile(name) {
  if (!app.profiles[name]) app.profiles[name] = initialProfileState();
  app.currentProfile = name;
  saveApp();
  renderAll();
}

/* -------------------- DOM Refs -------------------- */
const themeSelect = document.getElementById("themeSelect");
const profileSelect = document.getElementById("profileSelect");

const balanceEl = document.getElementById("balance");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const monthlyAvgEl = document.getElementById("monthlyAvg");

const transactionName = document.getElementById("transactionName");
const transactionAmount = document.getElementById("transactionAmount");
const transactionType = document.getElementById("transactionType");
const transactionCategory = document.getElementById("transactionCategory");
const newCategory = document.getElementById("newCategory");
const transactionDate = document.getElementById("transactionDate");
const isRecurring = document.getElementById("isRecurring");
const addBtn = document.getElementById("addBtn");
const cancelEdit = document.getElementById("cancelEdit");
const clearBtn = document.getElementById("clearBtn");
const voiceBtn = document.getElementById("voiceBtn");

const autoCategoryHint = document.getElementById("autoCategoryHint");
const formWarning = document.getElementById("formWarning");

const goalName = document.getElementById("goalName");
const goalAmount = document.getElementById("goalAmount");
const addGoal = document.getElementById("addGoal");
const goalsList = document.getElementById("goalsList");

const budgetCategory = document.getElementById("budgetCategory");
const budgetLimit = document.getElementById("budgetLimit");
const addBudget = document.getElementById("addBudget");
const budgetsList = document.getElementById("budgetsList");

const pieContainer = document.getElementById("pieContainer");
const topCategory = document.getElementById("topCategory");
const monthlyCompareBody = document.querySelector("#monthlyCompare tbody");

const predIncome = document.getElementById("predIncome");
const predExpense = document.getElementById("predExpense");
const predNet = document.getElementById("predNet");

const transactionList = document.getElementById("transactionList");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const filterMonth = document.getElementById("filterMonth");
const filterYear = document.getElementById("filterYear");
const pageSize = document.getElementById("pageSize");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const importJson = document.getElementById("importJson");

const chatWindow = document.getElementById("chatWindow");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

/* -------------------- Theme & Profiles -------------------- */
function applyTheme(t) {
  document.body.classList.remove(
    "theme-dark",
    "theme-midnight",
    "theme-emerald",
    "theme-sunset"
  );
  if (t === "dark") document.body.classList.add("theme-dark");
  if (t === "midnight") document.body.classList.add("theme-midnight");
  if (t === "emerald") document.body.classList.add("theme-emerald");
  if (t === "sunset") document.body.classList.add("theme-sunset");
  localStorage.setItem(THEME_KEY, t);
}
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));

function renderProfileOptions() {
  profileSelect.innerHTML = "";
  Object.keys(app.profiles).forEach((name) => {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    profileSelect.appendChild(o);
  });
  profileSelect.value = app.currentProfile;
}
profileSelect.addEventListener("change", () => {
  app.currentProfile = profileSelect.value;
  saveApp();
  renderAll();
});

/* -------------------- AI categorizer (rule-based) -------------------- */
const brandMap = {
  dominos: "Food",
  mcdonald: "Food",
  pizza: "Food",
  starbucks: "Food",
  flipkart: "Shopping",
  amazon: "Shopping",
  netflix: "Entertainment",
  paytm: "Bills",
};
const rules = [
  { words: ["salary", "pay", "salary"], cat: "Salary" },
  { words: ["uber", "ola", "taxi", "bus", "metro", "train"], cat: "Transport" },
  {
    words: ["grocery", "grocer", "supermarket", "dmart", "bigbasket"],
    cat: "Food",
  },
  { words: ["rent", "apartment", "house"], cat: "Bills" },
  {
    words: ["subscription", "netflix", "spotify", "prime"],
    cat: "Entertainment",
  },
  { words: ["amazon", "flipkart", "mall", "shop"], cat: "Shopping" },
  { words: ["doctor", "hospital", "pharmacy", "clinic"], cat: "Health" },
];
function suggestCategory(text) {
  if (!text) return "";
  const t = text.toLowerCase();
  for (const b in brandMap) if (t.includes(b)) return brandMap[b];
  for (const r of rules) if (r.words.some((w) => t.includes(w))) return r.cat;
  if (/\bbill\b/.test(t)) return "Bills";
  return "";
}
transactionName.addEventListener("input", () => {
  const s = suggestCategory(transactionName.value);
  autoCategoryHint.textContent = s ? `Suggested: ${s}` : "";
  if (s && getState().categories.includes(s)) transactionCategory.value = s;
});

/* -------------------- Voice Add (SpeechRecognition) -------------------- */
window.SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
if (window.SpeechRecognition) {
  recognizer = new SpeechRecognition();
  recognizer.lang = "en-IN";
  recognizer.continuous = false;
  recognizer.interimResults = false;

  recognizer.onresult = (e) => {
    const text = e.results[0][0].transcript.trim();
    showToast("Heard: " + text);
    // Expect patterns like "food 120" or "recharge 199" or "grocery 80"
    const amountMatch = text.match(/(-?\d+(\.\d+)?)/);
    const amount = amountMatch ? Number(amountMatch[0]) : null;
    const name = text.replace(/(-?\d+(\.\d+)?)/, "").trim();
    const cat = suggestCategory(name) || "General";

    if (name) transactionName.value = name;
    if (amount) transactionAmount.value = amount;
    if (getState().categories.includes(cat)) transactionCategory.value = cat;
    autoCategoryHint.textContent = `Suggested: ${cat}`;
  };

  recognizer.onerror = (e) => {
    showToast("Voice error");
  };
}

voiceBtn.addEventListener("click", () => {
  if (!recognizer) {
    showToast("Voice not supported in this browser");
    return;
  }
  try {
    recognizer.start();
    showToast("Listening...");
  } catch (e) {
    showToast("Voice failed to start");
  }
});

/* -------------------- Transactions CRUD -------------------- */
let editingId = null;

function addTransaction(name, amount, type, category, timestamp = Date.now()) {
  const st = getState();
  st.transactions.push({
    id: uid(),
    name,
    amount: Number(amount),
    type,
    category,
    timestamp,
  });
  saveApp();
}

function updateTransaction(id, patch) {
  const st = getState();
  const idx = st.transactions.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  st.transactions[idx] = { ...st.transactions[idx], ...patch };
  saveApp();
  return true;
}

function deleteTransaction(id) {
  const st = getState();
  st.transactions = st.transactions.filter((t) => t.id !== id);
  saveApp();
}

/* Add button */
addBtn.addEventListener("click", (e) => {
  e.preventDefault();
  formWarning.textContent = "";

  let name = transactionName.value.trim();
  let amount = Number(transactionAmount.value);
  const type = transactionType.value;
  let category = transactionCategory.value;
  const nc = newCategory.value.trim();
  const dateVal = transactionDate.value;

  if (nc) {
    const st = getState();
    if (!st.categories.includes(nc)) st.categories.unshift(nc);
    category = nc;
    newCategory.value = "";
  }

  if (!name) {
    formWarning.textContent = "Enter a name";
    return;
  }
  if (isNaN(amount) || amount === 0) {
    formWarning.textContent = "Enter a valid non-zero amount";
    return;
  }

  const ts = dateVal ? new Date(dateVal).getTime() : Date.now();
  const st = getState();

  if (editingId) {
    updateTransaction(editingId, {
      name,
      amount,
      type,
      category,
      timestamp: ts,
    });
    editingId = null;
    addBtn.textContent = "Add";
    showToast("Updated");
  } else {
    st.transactions.push({
      id: uid(),
      name,
      amount,
      type,
      category,
      timestamp: ts,
    });
    showToast("Added");
    if (isRecurring.checked) {
      st.recurring.push({
        id: uid(),
        name,
        amount,
        type,
        category,
        day: new Date(ts).getDate(),
      });
      showToast("Recurring scheduled");
    }
    if (type === "income" && st.goals.length)
      st.goals[0].progress = (st.goals[0].progress || 0) + Number(amount);
  }

  transactionName.value = "";
  transactionAmount.value = "";
  transactionDate.value = "";
  isRecurring.checked = false;
  saveApp();
  renderAll();
});

/* Edit flow */
function startEdit(id) {
  const st = getState();
  const tx = st.transactions.find((t) => t.id === id);
  if (!tx) return;
  editingId = id;
  addBtn.textContent = "Save";
  transactionName.value = tx.name;
  transactionAmount.value = tx.amount;
  transactionType.value = tx.type;
  populateCategorySelects();
  transactionCategory.value = tx.category || st.categories[0];
  transactionDate.value = new Date(tx.timestamp).toISOString().split("T")[0];
}
cancelEdit.addEventListener("click", () => {
  editingId = null;
  addBtn.textContent = "Add";
  transactionName.value = "";
  transactionAmount.value = "";
  transactionDate.value = "";
});

/* -------------------- Goals & Budgets -------------------- */
addGoal.addEventListener("click", () => {
  const st = getState();
  const n = goalName.value.trim();
  const t = Number(goalAmount.value);
  if (!n || isNaN(t) || t <= 0) {
    showToast("Enter valid goal");
    return;
  }
  st.goals.push({ id: uid(), name: n, target: t, progress: 0 });
  goalName.value = "";
  goalAmount.value = "";
  saveApp();
  renderGoals();
});
addBudget.addEventListener("click", () => {
  const st = getState();
  const cat = budgetCategory.value;
  const lim = Number(budgetLimit.value);
  if (!cat || isNaN(lim) || lim <= 0) {
    showToast("Enter valid budget");
    return;
  }
  const idx = st.budgets.findIndex((b) => b.category === cat);
  if (idx !== -1) st.budgets[idx].limit = lim;
  else st.budgets.push({ category: cat, limit: lim });
  budgetLimit.value = "";
  saveApp();
  renderBudgets();
});

/* -------------------- Recurring processor -------------------- */
function processRecurring() {
  const st = getState();
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth() + 1}`;
  if (st.lastRecurringMonth === key) return;
  st.recurring.forEach((r) => {
    const exists = st.transactions.some(
      (tx) =>
        tx.recurringId === r.id &&
        new Date(tx.timestamp).getMonth() === now.getMonth() &&
        new Date(tx.timestamp).getFullYear() === now.getFullYear()
    );
    if (!exists) {
      const day = r.day && r.day >= 1 && r.day <= 28 ? r.day : 1;
      const ts = new Date(now.getFullYear(), now.getMonth(), day).getTime();
      st.transactions.push({
        id: uid(),
        name: r.name,
        amount: r.amount,
        type: r.type,
        category: r.category,
        timestamp: ts,
        recurringId: r.id,
      });
    }
  });
  st.lastRecurringMonth = key;
  saveApp();
}

/* -------------------- Summary & Prediction -------------------- */
function computeSummary() {
  const st = getState();
  const income = st.transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = st.transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  balanceEl.textContent = "$" + fmt(income - expense);
  totalIncomeEl.textContent = "$" + fmt(income);
  totalExpenseEl.textContent = "$" + fmt(expense);

  // monthly avg (net)
  const months = {};
  st.transactions.forEach((t) => {
    const d = new Date(t.timestamp);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months[k] =
      (months[k] || 0) +
      (t.type === "income" ? Number(t.amount) : -Number(t.amount));
  });
  const keys = Object.keys(months);
  const avg = keys.length
    ? keys.reduce((s, k) => s + months[k], 0) / keys.length
    : 0;
  monthlyAvgEl.textContent = "$" + fmt(avg);
}

function getLastNMonths(n = 12) {
  const now = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    arr.push({
      key,
      label: d.toLocaleString(undefined, { month: "short", year: "numeric" }),
      income: 0,
      expense: 0,
    });
  }
  const st = getState();
  st.transactions.forEach((t) => {
    const d = new Date(t.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const slot = arr.find((x) => x.key === key);
    if (slot) {
      if (t.type === "income") slot.income += Number(t.amount);
      else slot.expense += Number(t.amount);
    }
  });
  return arr;
}

function predictNext(k = 6) {
  const series = getLastNMonths(k);
  const xs = series.map((s, i) => i);
  const ys = series.map((s) => s.income - s.expense);
  const n = xs.length;
  if (n === 0) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return intercept + slope * n;
}

function renderPrediction() {
  const net = predictNext(6);
  const series6 = getLastNMonths(6);
  const avgIncome =
    series6.reduce((s, x) => s + x.income, 0) / Math.max(1, series6.length);
  const avgExpense =
    series6.reduce((s, x) => s + x.expense, 0) / Math.max(1, series6.length);
  const predictedIncome = Math.max(0, avgIncome + net / 2);
  const predictedExpense = Math.max(0, predictedIncome - net);
  predIncome.textContent = "$" + fmt(predictedIncome);
  predExpense.textContent = "$" + fmt(predictedExpense);
  predNet.textContent = "$" + fmt(net);
}

/* -------------------- Pie chart -------------------- */
function renderPie() {
  const st = getState();
  const totals = {};
  st.transactions.forEach((t) => {
    if (t.type === "expense")
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
  });
  const entries = Object.entries(totals).filter(([k, v]) => v > 0);
  pieContainer.innerHTML = "";
  if (!entries.length) {
    pieContainer.innerHTML = '<div class="muted">No expense data</div>';
    topCategory.textContent = "";
    return;
  }
  const total = entries.reduce((s, [k, v]) => s + v, 0);
  const size = 160,
    radius = 60,
    cx = size / 2,
    cy = size / 2;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  let angle = -90;
  const colors = [
    "#2563eb",
    "#10b981",
    "#ef4444",
    "#f97316",
    "#7c3aed",
    "#06b6d4",
    "#f43f5e",
    "#f59e0b",
  ];
  entries.forEach(([cat, val], i) => {
    const portion = val / total;
    const slice = portion * 360;
    const start = polar(cx, cy, radius, angle);
    const end = polar(cx, cy, radius, angle + slice);
    const large = slice > 180 ? 1 : 0;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute(
      "d",
      [
        `M ${cx} ${cy}`,
        `L ${start.x} ${start.y}`,
        `A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`,
        "Z",
      ].join(" ")
    );
    path.setAttribute("fill", colors[i % colors.length]);
    svg.appendChild(path);
    angle += slice;
  });
  const hole = document.createElementNS(svgNS, "circle");
  hole.setAttribute("cx", cx);
  hole.setAttribute("cy", cy);
  hole.setAttribute("r", radius * 0.46);
  hole.setAttribute("fill", "var(--card)");
  svg.appendChild(hole);
  pieContainer.appendChild(svg);
  entries.sort((a, b) => b[1] - a[1]);
  topCategory.textContent = `Top: ${entries[0][0]} ($${fmt(entries[0][1])})`;
}
function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/* -------------------- Transactions list, filters, pagination -------------------- */
let currentPage = 1;
function populateMonthYearFilters() {
  filterMonth.innerHTML = "";
  [
    "All",
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
  ].forEach((m) => {
    const o = document.createElement("option");
    o.value = m;
    o.textContent =
      m === "All"
        ? "All"
        : new Date(2000, Number(m) - 1).toLocaleString(undefined, {
            month: "short",
          });
    filterMonth.appendChild(o);
  });
  const years = new Set();
  getState().transactions.forEach((t) =>
    years.add(new Date(t.timestamp).getFullYear())
  );
  const now = new Date().getFullYear();
  for (let y = now; y >= now - 5; y--) years.add(y);
  filterYear.innerHTML = "";
  const all = document.createElement("option");
  all.value = "All";
  all.textContent = "All";
  filterYear.appendChild(all);
  Array.from(years)
    .sort((a, b) => b - a)
    .forEach((y) => {
      const o = document.createElement("option");
      o.value = y;
      o.textContent = y;
      filterYear.appendChild(o);
    });
}
function getFilteredTransactions() {
  const st = getState();
  const q = (searchInput.value || "").toLowerCase().trim();
  const type = filterType.value;
  const month = filterMonth.value;
  const year = filterYear.value;
  let res = [...st.transactions].sort((a, b) => b.timestamp - a.timestamp);
  if (type !== "all") res = res.filter((t) => t.type === type);
  if (month !== "All")
    res = res.filter(
      (t) => new Date(t.timestamp).getMonth() + 1 === Number(month)
    );
  if (year !== "All")
    res = res.filter(
      (t) => new Date(t.timestamp).getFullYear() === Number(year)
    );
  if (q)
    res = res.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
    );
  return res;
}
function renderTransactions() {
  const all = getFilteredTransactions();
  const ps = Number(pageSize.value) || 50;
  const totalPages = Math.max(1, Math.ceil(all.length / ps));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ps;
  const pageItems = all.slice(start, start + ps);
  transactionList.innerHTML = "";
  if (!pageItems.length)
    transactionList.innerHTML =
      '<li class="transaction-item"><div>No transactions</div></li>';
  pageItems.forEach((tx) => {
    const li = document.createElement("li");
    li.className = "transaction-item";
    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "txn-name";
    name.textContent = tx.name;
    const meta = document.createElement("div");
    meta.className = "txn-meta";
    meta.textContent = `${tx.category || "General"} • ${new Date(
      tx.timestamp
    ).toLocaleString()}`;
    left.appendChild(name);
    left.appendChild(meta);
    const right = document.createElement("div");
    const amount = document.createElement("div");
    amount.style.fontWeight = "800";
    amount.style.color =
      tx.type === "income" ? "var(--success)" : "var(--danger)";
    amount.textContent =
      (tx.type === "income" ? "+" : "-") + "$" + fmt(tx.amount);
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => startEdit(tx.id);
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = () => {
      if (confirm("Delete?")) {
        deleteTransaction(tx.id);
        saveApp();
        renderAll();
        showToast("Deleted");
      }
    };
    right.appendChild(amount);
    right.appendChild(editBtn);
    right.appendChild(delBtn);
    li.appendChild(left);
    li.appendChild(right);
    transactionList.appendChild(li);
  });
  pageInfo.textContent = `${currentPage} / ${totalPages}`;
}
prevPage.addEventListener("click", () => {
  if (currentPage > 1) currentPage--;
  renderTransactions();
});
nextPage.addEventListener("click", () => {
  currentPage++;
  renderTransactions();
});
[searchInput, filterType, filterMonth, filterYear, pageSize].forEach((el) =>
  el.addEventListener("input", () => {
    currentPage = 1;
    renderTransactions();
  })
);

/* -------------------- Export / Import / PDF -------------------- */
exportCsvBtn.addEventListener("click", () => {
  const rows = [["id", "name", "amount", "type", "category", "timestamp"]];
  getState().transactions.forEach((t) =>
    rows.push([t.id, t.name, t.amount, t.type, t.category || "", t.timestamp])
  );
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '"')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${app.currentProfile}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
exportJsonBtn.addEventListener("click", () => {
  const st = getState();
  const blob = new Blob([JSON.stringify(st, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `profile_${app.currentProfile}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
exportPdfBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text(`Expense Report — ${app.currentProfile}`, 14, 20);
  let y = 36;
  getLastNMonths(6).forEach((s) => {
    doc.text(
      `${s.label} • Income: $${fmt(s.income)} • Expense: $${fmt(
        s.expense
      )} • Net: $${fmt(s.income - s.expense)}`,
      14,
      y
    );
    y += 7;
  });
  doc.save(`report_${app.currentProfile}_${Date.now()}.pdf`);
});
importJson.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      const st = getState();
      if (Array.isArray(data.transactions))
        st.transactions = st.transactions.concat(data.transactions);
      if (Array.isArray(data.categories))
        data.categories.forEach((c) => {
          if (!st.categories.includes(c)) st.categories.push(c);
        });
      if (Array.isArray(data.goals)) st.goals = st.goals.concat(data.goals);
      if (Array.isArray(data.budgets))
        st.budgets = st.budgets.concat(data.budgets);
      saveApp();
      renderAll();
      showToast("Imported");
    } catch (err) {
      alert("Import failed: " + err);
    }
  };
  r.readAsText(f);
  e.target.value = "";
});

/* -------------------- Clear profile -------------------- */
clearBtn.addEventListener("click", () => {
  if (!confirm("Clear ALL data for profile " + app.currentProfile + "?"))
    return;
  app.profiles[app.currentProfile] = initialProfileState();
  saveApp();
  renderAll();
  showToast("Cleared");
});

/* -------------------- Goals & Budgets render -------------------- */
function renderGoals() {
  const st = getState();
  goalsList.innerHTML = "";
  st.goals.forEach((g) => {
    const percent = Math.min(100, ((g.progress || 0) / g.target) * 100);
    const div = document.createElement("div");
    div.innerHTML = `<div><strong>${g.name}</strong> — $${fmt(
      g.progress || 0
    )} / $${fmt(
      g.target
    )}</div><div class="progress"><i style="width:${percent}%"></i></div>`;
    goalsList.appendChild(div);
  });
}
function renderBudgets() {
  const st = getState();
  budgetsList.innerHTML = "";
  st.budgets.forEach((b) => {
    const spent = st.transactions
      .filter((t) => t.type === "expense" && t.category === b.category)
      .reduce((s, t) => s + Number(t.amount), 0);
    const percent = b.limit ? (spent / b.limit) * 100 : 0;
    const div = document.createElement("div");
    div.innerHTML = `<div><strong>${b.category}</strong> — $${fmt(
      spent
    )} / $${fmt(
      b.limit
    )}</div><div class="progress"><i style="width:${percent}%"></i></div>`;
    budgetsList.appendChild(div);
  });
}

/* -------------------- Chatbot (offline, data-aware) -------------------- */
function addChatMessage(text, sender = "user") {
  const div = document.createElement("div");
  div.className = sender === "user" ? "chat-msg user" : "chat-msg bot";
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function aiRespond(question) {
  const q = question.toLowerCase();
  const st = getState();

  if (/^(hi|hello|hey)\b/.test(q))
    return 'Hello! I can answer balance, spending, budgets, goals, recent transactions, and predictions. Try: "What is my balance?"';

  if (q.includes("balance")) {
    const income = st.transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = st.transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return `Your current balance is $${fmt(income - expense)}.`;
  }

  if (q.includes("total income") || q.includes("how much did i earn")) {
    const income = st.transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0);
    return `Total income: $${fmt(income)}.`;
  }

  if (q.includes("total expense") || q.includes("how much did i spend")) {
    const expense = st.transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return `Total expense: $${fmt(expense)}.`;
  }

  if (q.includes("spent on")) {
    // "how much spent on food"
    const m = q.match(/spent on\s+([a-zA-Z]+)/);
    const cat = m ? m[1] : null;
    if (!cat) return "Which category?";
    const total = st.transactions
      .filter(
        (t) =>
          t.type === "expense" && t.category.toLowerCase() === cat.toLowerCase()
      )
      .reduce((s, t) => s + Number(t.amount), 0);
    return `You spent $${fmt(total)} on ${cat}.`;
  }

  if (
    q.includes("largest expense") ||
    q.includes("biggest expense") ||
    q.includes("top category")
  ) {
    const totals = {};
    st.transactions.forEach((t) => {
      if (t.type === "expense")
        totals[t.category] = (totals[t.category] || 0) + Number(t.amount);
    });
    const arr = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!arr.length) return "No expenses recorded yet.";
    return `Top expense category: ${arr[0][0]} — $${fmt(arr[0][1])}.`;
  }

  if (
    q.includes("last transactions") ||
    q.includes("recent transactions") ||
    q.includes("last")
  ) {
    const numMatch = q.match(/\d+/);
    const n = numMatch ? Number(numMatch[0]) : 5;
    const tx = st.transactions.slice(-n).reverse();
    if (!tx.length) return "No transactions yet.";
    return tx
      .map((t) => `${t.name} — $${fmt(t.amount)} (${t.category})`)
      .join("\n");
  }

  if (q.includes("budget")) {
    if (!st.budgets.length) return "No budgets set.";
    return st.budgets
      .map((b) => {
        const spent = st.transactions
          .filter((t) => t.type === "expense" && t.category === b.category)
          .reduce((s, t) => s + Number(t.amount), 0);
        return `${b.category}: $${fmt(spent)} / $${fmt(b.limit)}`;
      })
      .join("\n");
  }

  if (q.includes("goal") || q.includes("saving")) {
    if (!st.goals.length) return "No goals set.";
    return st.goals
      .map((g) => `${g.name}: $${fmt(g.progress || 0)} / $${fmt(g.target)}`)
      .join("\n");
  }

  if (
    q.includes("predict") ||
    q.includes("prediction") ||
    q.includes("next month")
  ) {
    const p = predictNext(6);
    return `Estimated next month net: $${fmt(
      p
    )} (linear regression on last 6 months).`;
  }

  if (q.includes("help") || q.includes("what can you do")) {
    return "I can answer about: balance, total income/expense, spending by category, budgets, goals, last transactions, and predictions.";
  }

  return "Sorry — I don't understand exactly. Try: 'What is my balance?', 'How much did I spend on food?', or 'Show last 5 transactions'.";
}

chatSendBtn.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (!text) return;
  addChatMessage(text, "user");
  const reply = aiRespond(text);
  setTimeout(() => addChatMessage(reply, "bot"), 250);
  chatInput.value = "";
});
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") chatSendBtn.click();
});

/* -------------------- Init / Render All -------------------- */
function populateCategorySelects() {
  const st = getState();
  transactionCategory.innerHTML = "";
  budgetCategory.innerHTML = "";
  st.categories.forEach((c) => {
    const o = document.createElement("option");
    o.value = o.textContent = c;
    transactionCategory.appendChild(o);
    const b = o.cloneNode(true);
    budgetCategory.appendChild(b);
  });
}

function renderMonthly() {
  const series = getLastNMonths(12);
  monthlyCompareBody.innerHTML = "";
  series.forEach((s) => {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = s.label;
    const td2 = document.createElement("td");
    td2.textContent = "$" + fmt(s.income);
    const td3 = document.createElement("td");
    td3.textContent = "$" + fmt(s.expense);
    const td4 = document.createElement("td");
    td4.textContent = "$" + fmt(s.income - s.expense);
    td4.style.fontWeight = "700";
    td4.style.color =
      s.income - s.expense >= 0 ? "var(--success)" : "var(--danger)";
    tr.append(td1, td2, td3, td4);
    monthlyCompareBody.appendChild(tr);
  });
}

function renderGoalsAndBudgets() {
  renderGoals();
  renderBudgets();
}

function renderAll() {
  renderProfileOptions();
  populateCategorySelects();
  populateMonthYearFilters();
  processRecurring();
  computeSummary();
  renderPie();
  renderMonthly();
  renderPrediction();
  renderGoals();
  renderBudgets();
  renderTransactions();
}

/* helpers used earlier (getLastNMonths etc.) */
function getLastNMonths(n = 12) {
  const now = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    arr.push({
      key,
      label: d.toLocaleString(undefined, { month: "short", year: "numeric" }),
      income: 0,
      expense: 0,
    });
  }
  const st = getState();
  st.transactions.forEach((t) => {
    const d = new Date(t.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const slot = arr.find((x) => x.key === key);
    if (slot) {
      if (t.type === "income") slot.income += Number(t.amount);
      else slot.expense += Number(t.amount);
    }
  });
  return arr;
}

/* initial ui state on load */
(function init() {
  renderProfileOptions();
  const saved = localStorage.getItem(THEME_KEY) || "light";
  themeSelect.value = saved;
  applyTheme(saved);
  populateMonthYearFilters();
  populateCategorySelects();
  renderAll();
})();
