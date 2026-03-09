let chartInstance = null;
let allData = {};
let selectedCurrencies = new Set(["1 Singapore Dollar", "1 US Dollar"]); // 默认 SGD
let selectedMetric = "selling_tt_od";

const metricOptions = {
  selling_tt_od: "Selling TT/OD (Market)",
  buying_tt: "Buying TT",
  buying_od: "Buying OD",
  notes_selling: "Notes Selling (Cash)",
  notes_buying: "Notes Buying (Cash)",
};
const styles = {
  light: {
    body: {
      margin: "0",
      padding: "0",
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      background: "#f6f7f9",
      color: "#111",
    },
    app: {
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    },
    toolbar: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
      flexWrap: "wrap",
      padding: "10px 12px",
      background: "#ffffff",
      borderRadius: "8px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
    },
    currencyPanel: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
      padding: "10px 12px",
      background: "#ffffff",
      borderRadius: "8px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
      fontSize: "14px",
    },
    chart: {
      background: "#ffffff",
      borderRadius: "12px",
      padding: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    },
    button: {
      padding: "6px 14px",
      borderRadius: "6px",
      border: "1px solid #ccc",
      background: "#f3f3f3",
      cursor: "pointer",
    },
    input: {
      padding: "5px 8px",
      borderRadius: "6px",
      border: "1px solid #ccc",
    },
  },

  dark: {
    body: {
      margin: "0",
      padding: "0",
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      background: "#121212",
      color: "#eee",
    },
    app: {
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      maxHeight: "100vh",
    },
    toolbar: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
      flexWrap: "wrap",
      padding: "10px 12px",
      background: "#1e1e1e",
      borderRadius: "8px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
    },
    currencyPanel: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
      padding: "10px 12px",
      background: "#1e1e1e",
      borderRadius: "8px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
      fontSize: "14px",
    },
    chart: {
      background: "#1a1a1a",
      borderRadius: "12px",
      padding: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
      maxHeight: "600px",
    },
    button: {
      padding: "6px 14px",
      borderRadius: "6px",
      border: "1px solid #444",
      background: "#2a2a2a",
      color: "#eee",
      cursor: "pointer",
    },
    input: {
      padding: "5px 8px",
      borderRadius: "6px",
      border: "1px solid #444",
      background: "#2a2a2a",
      color: "#eee",
    },
  },
};

function detectAutoTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyLayoutStyle(theme = "auto") {
  if (theme === "auto") {
    theme = detectAutoTheme();
  }

  const s = styles[theme];

  const app = document.getElementById("app");
  const toolbar = document.getElementById("toolbar");
  const currencyPanel = document.getElementById("currency-panel");
  const chart = document.getElementById("chart");

  Object.assign(document.body.style, s.body);
  Object.assign(app.style, s.app);
  Object.assign(toolbar.style, s.toolbar);
  Object.assign(currencyPanel.style, s.currencyPanel);
  Object.assign(chart.style, s.chart);

  return s; // 给后面按钮 / input 用
}

// 默认日期 90 天
function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 90);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/* =========================
   顶部日期工具栏
========================= */
function renderToolbar() {
  const style = applyLayoutStyle("auto");

  const { from, to } = getDefaultDates();
  const bar = document.getElementById("toolbar");
  bar.innerHTML = "";

  // From
  const fromInput = document.createElement("input");
  fromInput.type = "date";
  fromInput.value = from;
  Object.assign(fromInput.style, style.input);

  // To
  const toInput = document.createElement("input");
  toInput.type = "date";
  toInput.value = to;
  Object.assign(toInput.style, style.input);

  // Metric select
  const select = document.createElement("select");
  Object.assign(select.style, {
    ...style.input,
    cursor: "pointer",
    minWidth: "200px",
  });

  Object.entries(metricOptions).forEach(([key, label]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    if (key === selectedMetric) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = () => {
    selectedMetric = select.value;
    redrawChart();
  };

  // Load button
  const btn = document.createElement("button");
  btn.textContent = "Load";
  Object.assign(btn.style, style.button);

  btn.onclick = () => {
    loadChart(fromInput.value, toInput.value);
  };

  // Layout
  bar.append("From:", fromInput, "To:", toInput, "Metric:", select, btn);

  // 初始加载
  loadChart(from, to);
  renderNotes();
}

/* =========================
   币种开关面板
========================= */
let currencyPanelExpanded = false;

function renderCurrencyPanel(currencies) {
  const panel = document.getElementById("currency-panel");
  panel.innerHTML = "";

  const theme = detectAutoTheme(); // "light" / "dark"

  const container = document.createElement("div");
  Object.assign(container.style, {
    maxHeight: currencyPanelExpanded ? "none" : "150px",
    overflow: "hidden",
    transition: "max-height 0.2s ease",
  });

  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  });

  currencies.forEach((cur) => {
    const label = document.createElement("label");

    Object.assign(label.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "13px",
      cursor: "pointer",
      border: theme === "dark" ? "1px solid #444" : "1px solid #ddd",
      background: selectedCurrencies.has(cur)
        ? theme === "dark"
          ? "#2f2f2f"
          : "#e0e7ff"
        : theme === "dark"
          ? "#1e1e1e"
          : "#f9f9f9",
      color: selectedCurrencies.has(cur)
        ? theme === "dark"
          ? "#fff"
          : "#1e3a8a"
        : theme === "dark"
          ? "#ccc"
          : "#333",
      userSelect: "none",
      transition: "all 0.15s",
    });

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedCurrencies.has(cur);
    cb.style.display = "none";

    label.onmouseenter = () => (label.style.opacity = "0.8");
    label.onmouseleave = () => (label.style.opacity = "1");

    cb.onchange = () => {
      if (cb.checked) {
        selectedCurrencies.add(cur);
      } else {
        selectedCurrencies.delete(cur);
      }
      renderCurrencyPanel(currencies);
      redrawChart();
    };

    label.append(cb, cur);
    wrap.appendChild(label);
  });

  container.appendChild(wrap);
  panel.appendChild(container);

  // ---- Show more 按钮 ----
  const btn = document.createElement("button");
  btn.textContent = currencyPanelExpanded ? "Show less" : "Show more";

  Object.assign(btn.style, {
    marginTop: "6px",
    fontSize: "12px",
    background: "none",
    border: "none",
    color: theme === "dark" ? "#8ab4f8" : "#2563eb",
    cursor: "pointer",
  });

  btn.onclick = () => {
    currencyPanelExpanded = !currencyPanelExpanded;
    renderCurrencyPanel(currencies);
  };

  panel.appendChild(btn);
}

/* =========================
   拉数据
========================= */
async function loadChart(from, to) {
  const url = `/get_rate_range/${from}/${to}`;
  const res = await fetch(url);
  const json = await res.json();
  allData = json.data;

  const currencies = Object.keys(allData);
  renderCurrencyPanel(currencies);
  redrawChart();
}

/* =========================
   真正画图
========================= */
function redrawChart() {
  const datasets = [];
  let labels = [];

  const colors = [
    "#4f46e5",
    "#16a34a",
    "#dc2626",
    "#ea580c",
    "#0ea5e9",
    "#9333ea",
  ];

  let colorIndex = 0;

  selectedCurrencies.forEach((currency) => {
    const rows = allData[currency];
    if (!rows) return;

    if (labels.length === 0) {
      labels = rows.map((r) => r.date.slice(0, 10));
    }

    const color = colors[colorIndex % colors.length];
    colorIndex++;
    const base = rows[0][selectedMetric];

    datasets.push({
      label: currency,
      data: rows.map((r) => {
        const v = r[selectedMetric];
        if (!base || !v) return 0;
        return (v / base - 1) * 100;
      }),
      _rawPrices: rows.map((r) => r[selectedMetric]),

      borderColor: color,
      borderWidth: 2.5,
      tension: 0.4,
      cubicInterpolationMode: "monotone",

      shadowColor: color,
      shadowBlur: 10,

      pointRadius: 0,
      pointHoverRadius: 6,
      pointBackgroundColor: "#fff",
      pointBorderColor: color,
      pointBorderWidth: 2,

      fill: true,
      backgroundColor: (ctx) => {
        const chart = ctx.chart;
        const { ctx: canvasCtx, chartArea } = chart;
        if (!chartArea) return null;
        const gradient = canvasCtx.createLinearGradient(
          0,
          chartArea.top,
          0,
          chartArea.bottom,
        );
        gradient.addColorStop(0, color + "44");
        gradient.addColorStop(1, color + "00");
        return gradient;
      },
    });
  });

  const ctx = document.getElementById("chart").getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.8)",
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const pct = ctx.parsed.y;
              const raw = ctx.dataset._rawPrices[ctx.dataIndex];
              const sign = pct >= 0 ? "+" : "";
              return ` ${ctx.dataset.label}: ${sign}${pct.toFixed(2)}% | ${raw}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: "rgba(200,200,200,0.15)", // 网格线淡
          },
          ticks: {
            maxTicksLimit: 8,
          },
          title: {
            display: true,
            text: "Date",
          },
        },
        y: {
          grid: {
            color: "rgba(200,200,200,0.15)",
          },
          title: {
            display: true,
            text: "Change (%)", // 👈 语义变了
          },
          ticks: {
            callback: (v) => v.toFixed(2) + "%",
          },
        },
      },
    },
  });
}

/* =========================
   启动
========================= */
renderToolbar();
function renderNotes() {
  const notes = document.getElementById("notes");
  notes.innerHTML = "";

  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    marginTop: "16px",
    fontSize: "12px",
    opacity: "0.7",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  });

  const source = document.createElement("span");
  source.textContent = "Data coming from:";

  const link = document.createElement("a");
  link.href = "https://pbebank.com/en/rates-charges/forex/";
  link.textContent = "pbebank.com";
  link.target = "_blank";
  Object.assign(link.style, {
    color: "#4f46e5",
    textDecoration: "none",
  });

  const dev = document.createElement("span");
  dev.textContent = " | Developed by Yukang";
  Object.assign(dev.style, {
    fontWeight: "500",
  });

  wrap.append(source, link, dev);
  notes.appendChild(wrap);
}
