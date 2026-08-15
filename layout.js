/**
 * layout.js
 * Renders the shared header/footer on every page, the keycap grid on
 * the dashboard, and the per-app content on each app page — all driven
 * by apps-data.js so there is one place to edit copy and links.
 */

(function () {
  const path = window.location.pathname.replace(/\/$/, "").split("/").pop() || "index";

  function renderHeader() {
    const nav = [
      { label: "Home", href: "index.html", match: "index" },
      { label: "Dashboard", href: "dashboard.html", match: "dashboard" },
      { label: "Portfolio", href: "portfolio.html", match: "portfolio" },
      { label: "Bio", href: "about.html", match: "about" },
    ];

    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html">
          <span class="brand-mark">⇪</span>
          Caps Unlocked
        </a>
        <nav class="site-nav" aria-label="Primary">
          ${nav
            .map(
              (item) =>
                `<a href="${item.href}" ${item.match === path ? 'aria-current="page"' : ""}>${item.label}</a>`
            )
            .join("")}
        </nav>
      </div>
    `;
    document.body.prepend(header);
  }

  function renderFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="wrap" style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; width:100%;">
        <span>capsunlocked.com — a workbench of small apps</span>
        <span>Built with <a href="dashboard.html">${APPS.length} keys</a> unlocked so far</span>
      </div>
    `;
    document.body.appendChild(footer);
  }

  function renderDashboard() {
    const grid = document.querySelector("[data-keyboard-grid]");
    if (!grid) return;
    grid.innerHTML = APPS.map(
      (app) => `
      <a class="keycap" href="${app.slug}.html">
        <span class="slug">/${app.slug}</span>
        <p class="name">${app.name}</p>
        <p class="desc">${app.tagline}</p>
        <span class="status">${app.status}</span>
      </a>
    `
    ).join("");
  }

  function renderAppPage() {
    const root = document.querySelector("[data-app]");
    if (!root) return;
    const slug = root.getAttribute("data-app");
    const app = APPS.find((a) => a.slug === slug);
    if (!app) {
      root.innerHTML = `<div class="wrap"><p>Unknown app: ${slug}</p></div>`;
      return;
    }

    document.title = `${app.name} · Caps Unlocked`;

    root.innerHTML = `
      <section class="wrap app-hero">
        <div class="key" aria-hidden="true">${app.glyph}</div>
        <div>
          <span class="eyebrow">/${app.slug}</span>
          <h1>${app.name}</h1>
          <p class="tagline">${app.tagline}</p>
        </div>
      </section>

      <section class="wrap app-body">
        <div>
          <div class="panel">
            <h2>About</h2>
            <p>${app.description}</p>
          </div>
        </div>
        <aside>
          <div class="aside-block">
            <p class="label">Launch</p>
            <a class="btn btn-primary" href="${app.launchUrl}" target="_blank" rel="noopener">
              Open ${app.name} ↗
            </a>
            ${
              app.launchUrl === "#"
                ? '<p class="todo-flag" style="margin-top:10px;">TODO: add the live Google Apps Script URL in apps-data.js</p>'
                : ""
            }
          </div>
          <div class="aside-block">
            <p class="label">What it does</p>
            <ul class="features">
              ${app.features.map((f) => `<li>${f}</li>`).join("")}
            </ul>
          </div>
          <div class="aside-block">
            <p class="label">Hosted on</p>
            <p style="margin:0; color:var(--paper-dim); font-size:0.9rem;">Google Apps Script — planned migration to this domain.</p>
          </div>
        </aside>
      </section>

      <div class="wrap">
        <a class="back-link" href="dashboard.html">← Back to dashboard</a>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderFooter();
    renderDashboard();
    renderAppPage();
  });
})();
