const STORAGE_KEY = "expenseTrackerTransactions";

const CATEGORIES = {
    income: { label: "Income", sign: "+", cls: "plus", icon: "↓" },
    necessities: { label: "Necessities", sign: "-", cls: "minus", icon: "N" },
    desires: { label: "Desires", sign: "-", cls: "minus", icon: "D" },
    savings: { label: "Savings", sign: "+", cls: "neutral", icon: "S" },
    liabilities: { label: "Liabilities", sign: "-", cls: "minus", icon: "L" }
};

const DESCRIPTION_PATTERN = /^[\p{L}\p{N} .,'&()\-_/]{2,60}$/u;
const AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const MAX_AMOUNT = 999999999999;

let transactions = [];
let activeFilter = "all";

const form = document.getElementById("transactionForm");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const descriptionError = document.getElementById("descriptionError");
const amountError = document.getElementById("amountError");
const categoryError = document.getElementById("categoryError");
const listEl = document.getElementById("transactionList");
const emptyState = document.getElementById("emptyState");
const visibleCount = document.getElementById("visibleCount");
const filtersEl = document.getElementById("filters");
const toastArea = document.getElementById("toastArea");
const clearAllBtn = document.getElementById("clearAllBtn");
const confirmModal = document.getElementById("confirmModal");
const cancelClear = document.getElementById("cancelClear");
const confirmClear = document.getElementById("confirmClear");

function formatMoney(value) {
    const negative = value < 0;
    const text = Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return (negative ? "-Rs " : "Rs ") + text;
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function isValidTransaction(item) {
    return (
        item &&
        typeof item === "object" &&
        typeof item.id === "number" &&
        typeof item.description === "string" &&
        typeof item.amount === "number" &&
        isFinite(item.amount) &&
        item.amount > 0 &&
        Object.prototype.hasOwnProperty.call(CATEGORIES, item.category)
    );
}

function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(isValidTransaction);
    } catch (error) {
        return [];
    }
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        showToast("Could not save to browser storage. Data may be lost on reload.", "error");
        return false;
    }
}

function calculateTotals() {
    const totals = {
        income: 0,
        necessities: 0,
        desires: 0,
        savings: 0,
        liabilities: 0,
        expenses: 0,
        net: 0,
        counts: { income: 0, necessities: 0, desires: 0, savings: 0, liabilities: 0 }
    };

    transactions.forEach(function (item) {
        totals[item.category] += item.amount;
        totals.counts[item.category] += 1;
    });

    totals.expenses = totals.necessities + totals.desires;
    totals.net = (totals.income + totals.savings) - (totals.expenses + totals.liabilities);

    return totals;
}

function setText(id, text) {
    document.getElementById(id).textContent = text;
}

function setBar(id, value, base) {
    const percent = base > 0 ? Math.min(100, (value / base) * 100) : 0;
    document.getElementById(id).style.width = percent + "%";
}

function pluralEntries(count) {
    return count + (count === 1 ? " entry" : " entries");
}

function renderSummary(totals) {
    const netEl = document.getElementById("netBalance");
    netEl.textContent = formatMoney(totals.net);
    netEl.classList.toggle("negative", totals.net < 0);

    setText("totalIncome", formatMoney(totals.income));
    setText("totalExpenses", formatMoney(totals.expenses));
    setText("totalLiabilities", formatMoney(totals.liabilities));

    setText("sumNecessities", formatMoney(totals.necessities));
    setText("sumDesires", formatMoney(totals.desires));
    setText("sumSavings", formatMoney(totals.savings));
    setText("sumLiabilities", formatMoney(totals.liabilities));

    setText("countNecessities", pluralEntries(totals.counts.necessities));
    setText("countDesires", pluralEntries(totals.counts.desires));
    setText("countSavings", pluralEntries(totals.counts.savings));
    setText("countLiabilities", pluralEntries(totals.counts.liabilities));

    const base = totals.income > 0 ? totals.income : totals.expenses + totals.savings + totals.liabilities;
    setBar("barNecessities", totals.necessities, base);
    setBar("barDesires", totals.desires, base);
    setBar("barSavings", totals.savings, base);
    setBar("barLiabilities", totals.liabilities, base);
}

function createTransactionElement(item) {
    const meta = CATEGORIES[item.category];

    const li = document.createElement("li");
    li.className = "tx-item tx-" + item.category;
    li.dataset.id = String(item.id);

    const badge = document.createElement("div");
    badge.className = "tx-badge";
    badge.textContent = meta.icon;

    const info = document.createElement("div");
    info.className = "tx-info";

    const desc = document.createElement("p");
    desc.className = "tx-desc";
    desc.textContent = item.description;
    desc.title = item.description;

    const metaLine = document.createElement("p");
    metaLine.className = "tx-meta";

    const tag = document.createElement("span");
    tag.className = "tx-tag";
    tag.textContent = meta.label;

    const date = document.createElement("span");
    date.textContent = formatDate(item.id);

    metaLine.appendChild(tag);
    metaLine.appendChild(date);
    info.appendChild(desc);
    info.appendChild(metaLine);

    const amount = document.createElement("span");
    amount.className = "tx-amount " + meta.cls;
    amount.textContent = meta.sign + " " + formatMoney(item.amount);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "tx-delete";
    del.setAttribute("aria-label", "Delete " + item.description);
    del.dataset.id = String(item.id);
    del.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path>' +
        '<path d="M6 6l1 14h10l1-14"></path><path d="M10 11v5M14 11v5"></path></svg>';

    li.appendChild(badge);
    li.appendChild(info);
    li.appendChild(amount);
    li.appendChild(del);

    return li;
}

function renderUI() {
    const visible = transactions
        .filter(function (item) {
            return activeFilter === "all" || item.category === activeFilter;
        })
        .sort(function (a, b) {
            return b.id - a.id;
        });

    listEl.innerHTML = "";

    const fragment = document.createDocumentFragment();
    visible.forEach(function (item) {
        fragment.appendChild(createTransactionElement(item));
    });
    listEl.appendChild(fragment);

    emptyState.classList.toggle("show", visible.length === 0);
    listEl.style.display = visible.length === 0 ? "none" : "flex";
    visibleCount.textContent = visible.length + " shown";

    renderSummary(calculateTotals());
}

function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = "toast " + (type || "info");
    toast.textContent = message;
    toastArea.appendChild(toast);

    setTimeout(function () {
        toast.classList.add("leaving");
        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 2800);
}

function setFieldError(input, errorEl, message) {
    errorEl.textContent = message;
    if (input) {
        input.classList.toggle("invalid", Boolean(message));
    }
}

function clearErrors() {
    setFieldError(descriptionInput, descriptionError, "");
    setFieldError(amountInput, amountError, "");
    setFieldError(null, categoryError, "");
}

function validateForm(description, amountText, category) {
    let valid = true;
    clearErrors();

    if (description.length === 0) {
        setFieldError(descriptionInput, descriptionError, "Please enter a description.");
        valid = false;
    } else if (!DESCRIPTION_PATTERN.test(description)) {
        setFieldError(descriptionInput, descriptionError, "Use 2 to 60 letters, numbers or basic punctuation.");
        valid = false;
    }

    if (amountText.length === 0) {
        setFieldError(amountInput, amountError, "Please enter an amount.");
        valid = false;
    } else if (!AMOUNT_PATTERN.test(amountText)) {
        setFieldError(amountInput, amountError, "Enter a positive number, up to 2 decimals (e.g. 1500.50).");
        valid = false;
    } else {
        const value = parseFloat(amountText);
        if (!(value > 0) || value > MAX_AMOUNT) {
            setFieldError(amountInput, amountError, "Amount must be greater than 0.");
            valid = false;
        }
    }

    if (!category || !Object.prototype.hasOwnProperty.call(CATEGORIES, category)) {
        setFieldError(null, categoryError, "Please choose a category.");
        valid = false;
    }

    return valid;
}

function addTransaction(e) {
    e.preventDefault();

    const description = descriptionInput.value.trim().replace(/\s+/g, " ");
    const amountText = amountInput.value.trim().replace(/,/g, "");
    const selected = form.querySelector('input[name="category"]:checked');
    const category = selected ? selected.value : "";

    if (!validateForm(description, amountText, category)) {
        showToast("Please fix the highlighted fields.", "error");
        return;
    }

    let id = Date.now();
    while (transactions.some(function (item) { return item.id === id; })) {
        id += 1;
    }

    const transaction = {
        id: id,
        description: description,
        amount: Math.round(parseFloat(amountText) * 100) / 100,
        category: category
    };

    transactions.push(transaction);
    saveToLocalStorage();

    form.reset();
    form.querySelector('input[name="category"][value="' + category + '"]').checked = true;
    clearErrors();

    if (activeFilter !== "all" && activeFilter !== category) {
        setActiveFilter("all");
    }

    renderUI();
    showToast(CATEGORIES[category].label + " added successfully.", "success");
    descriptionInput.focus();
}

function deleteTransaction(id) {
    const exists = transactions.some(function (item) {
        return item.id === id;
    });

    if (!exists) {
        return;
    }

    transactions = transactions.filter(function (item) {
        return item.id !== id;
    });

    saveToLocalStorage();
    renderUI();
    showToast("Transaction deleted.", "info");
}

function setActiveFilter(filter) {
    activeFilter = filter;
    filtersEl.querySelectorAll(".filter").forEach(function (button) {
        const isActive = button.dataset.filter === filter;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });
}

function handleFilterClick(event) {
    const button = event.target.closest(".filter");
    if (!button) {
        return;
    }
    setActiveFilter(button.dataset.filter);
    renderUI();
}

function handleListClick(event) {
    const button = event.target.closest(".tx-delete");
    if (!button) {
        return;
    }

    const id = Number(button.dataset.id);
    const row = button.closest(".tx-item");

    if (row) {
        row.classList.add("removing");
        setTimeout(function () {
            deleteTransaction(id);
        }, 220);
    } else {
        deleteTransaction(id);
    }
}

function openConfirm() {
    if (transactions.length === 0) {
        showToast("There is no data to clear.", "info");
        return;
    }
    confirmModal.hidden = false;
    confirmClear.focus();
}

function closeConfirm() {
    confirmModal.hidden = true;
}

function clearAllData() {
    transactions = [];
    saveToLocalStorage();
    setActiveFilter("all");
    renderUI();
    closeConfirm();
    showToast("All data cleared.", "success");
}

function init() {
    transactions = loadFromLocalStorage();

    form.addEventListener("submit", addTransaction);
    filtersEl.addEventListener("click", handleFilterClick);
    listEl.addEventListener("click", handleListClick);
    clearAllBtn.addEventListener("click", openConfirm);
    cancelClear.addEventListener("click", closeConfirm);
    confirmClear.addEventListener("click", clearAllData);

    confirmModal.addEventListener("click", function (event) {
        if (event.target === confirmModal) {
            closeConfirm();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !confirmModal.hidden) {
            closeConfirm();
        }
    });

    descriptionInput.addEventListener("input", function () {
        setFieldError(descriptionInput, descriptionError, "");
    });

    amountInput.addEventListener("input", function () {
        setFieldError(amountInput, amountError, "");
    });

    renderUI();
}

init();
