const OWNER = "MinhDucoder";
const MAX_REPOS = 6;
const card = document.getElementById("card");

const fallbackRepos = [
  {
    name: "PhantichThietKeThuatToan",
    desc: "Phân tích thuật toán (C++)",
    html_url: "https://github.com/MinhDucoder/PhantichThietKeThuatToan",
  },
  {
    name: "Course_Practice",
    desc: "Web chia sẻ khóa học (Handlebars)",
    html_url: "https://github.com/MinhDucoder/Course_Practice",
  },
  {
    name: "Music-player",
    desc: "Music player bằng JS",
    html_url: "https://github.com/MinhDucoder/Music-player",
  },
  {
    name: "tiktok-ui",
    desc: "UI mô phỏng TikTok (JS/CSS)",
    html_url: "https://github.com/MinhDucoder/tiktok-ui",
  },
  {
    name: "btlweb",
    desc: "Bài tập lớn web (HTML/CSS)",
    html_url: "https://github.com/MinhDucoder/btlweb",
  },
  {
    name: "DoMin",
    desc: "Một project Java",
    html_url: "https://github.com/MinhDucoder/DoMin",
  },
];

// simple in-memory cache for repo details
const repoCache = new Map();

// Render project cards (basic)
function renderProjects(repos) {
  const container = document.getElementById("projects");
  container.innerHTML = ""; // clear
  repos.forEach((r) => {
    const card = document.createElement("article");
    card.className = "project-card";
    card.setAttribute("tabindex", "0");
    card.dataset.repo = r.name;
    card.innerHTML = `
        <h3 class="proj-title"><a href="${
          r.html_url
        }" target="_blank" rel="noopener noreferrer">${r.name}</a></h3>
        <p class="proj-desc">${r.description || r.desc || "No description"}</p>
        <div class="proj-meta">
          <span class="lang">${r.language || ""}</span>
          <div class="proj-actions">
            <button class="view-btn" data-repo="${r.name}">Chi tiết</button>
            <a class="small-link" href="${
              r.html_url
            }" target="_blank" rel="noopener noreferrer">View</a>
          </div>
        </div>
      `;
    container.appendChild(card);
    // click / keyboard open modal
    card
      .querySelector(".view-btn")
      .addEventListener("click", () => openProjectModal(r.name));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openProjectModal(r.name);
    });
  });
}

// fetch list of repos
async function loadRepos() {
  try {
    const res = await fetch(
      `https://api.github.com/users/${OWNER}/repos?per_page=${MAX_REPOS}&sort=updated`
    );
    if (!res.ok) throw new Error("Fetch repos failed " + res.status);
    const data = await res.json();
    const repos = data.map((r) => ({
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      language: r.language,
    }));
    renderProjects(repos);
  } catch (err) {
    console.warn("Failed to fetch GitHub repos:", err);
    renderProjects(fallbackRepos);
  } finally {
    setTimeout(() => {
      card.classList.remove("loading");
      card.setAttribute("aria-busy", "false");
    }, 700);
  }
}

// --- Modal logic ---
const modal = document.getElementById("proj-modal");
const modalBody = document.getElementById("modal-body");
const closeBtn = modal.querySelector(".modal-close");
const backdrop = modal.querySelector(".modal-backdrop");

function openModal() {
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
  document.documentElement.style.overflow = "hidden";
  // focus the modal for accessibility
  closeBtn.focus();
  document.addEventListener("keydown", onKeyDown);
}
function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
  document.documentElement.style.overflow = "";
  document.removeEventListener("keydown", onKeyDown);
}
function onKeyDown(e) {
  if (e.key === "Escape") closeModal();
}
backdrop.addEventListener("click", () => closeModal());
closeBtn.addEventListener("click", () => closeModal());

// helper: format date
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// basic markdown -> html converter (small subset)
function simpleMarkdownToHTML(md) {
  if (!md) return "<p>(No README)</p>";
  // escape HTML
  let text = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // code block triple backticks
  text = text.replace(
    /```([\s\S]*?)```/g,
    (m, code) =>
      `<pre class="md-code"><code>${code.replace(/</g, "&lt;")}</code></pre>`
  );
  // inline code
  text = text.replace(/`([^`]+)`/g, '<code class="md-inline">$1</code>');
  // headings
  text = text.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  text = text.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  text = text.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  // bold & italic
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // links [text](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // simple paragraphs: split by double newlines
  const parts = text.split(/\n{2,}/).map((p) => {
    if (p.match(/^<h[1-3]/) || p.match(/^<pre/)) return p;
    // turn single newlines into <br>
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  });
  return parts.join("");
}

// fetch repo detail: repo, readme, issues (5)
async function fetchRepoDetails(repoName) {
  if (repoCache.has(repoName)) return repoCache.get(repoName);
  const base = `https://api.github.com/repos/${OWNER}/${repoName}`;
  const result = { repo: null, readme: null, issues: [], error: null };
  try {
    // fetch repo details
    const [repoRes, readmeRes, issuesRes] = await Promise.all([
      fetch(base),
      fetch(base + "/readme"),
      fetch(base + "/issues?state=open&per_page=5"),
    ]);
    if (!repoRes.ok) throw new Error("Repo fetch failed " + repoRes.status);
    result.repo = await repoRes.json();

    if (readmeRes.ok) {
      const readmeJson = await readmeRes.json();
      // content is base64
      if (readmeJson.content) {
        try {
          const raw = atob(readmeJson.content.replace(/\n/g, "")); // decode base64
          result.readme = raw;
        } catch (e) {
          // fallback: use download_url if exists
          if (readmeJson.download_url) {
            const text = await (await fetch(readmeJson.download_url)).text();
            result.readme = text;
          } else {
            result.readme = null;
          }
        }
      } else {
        result.readme = null;
      }
    } else {
      result.readme = null; // not found or error
    }

    if (issuesRes.ok) {
      const issuesJson = await issuesRes.json();
      // issuesJson includes PRs (with pull_request field)
      result.issues = issuesJson.map((i) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        html_url: i.html_url,
        type: i.pull_request ? "PR" : "Issue",
        created_at: i.created_at,
        user: i.user && i.user.login,
      }));
    } else {
      result.issues = [];
    }

    repoCache.set(repoName, result);
    return result;
  } catch (err) {
    console.warn("fetchRepoDetails error", err);
    result.error = err;
    repoCache.set(repoName, result);
    return result;
  }
}

async function fetchReadmeRaw(owner, repo) {
  const key = `readme:${owner}/${repo}`;
  const cached = localStorage.getItem(key);
  if (cached) return JSON.parse(cached);

  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3.raw" },
  });
  if (!res.ok) throw new Error("No readme");
  const text = await res.text();
  localStorage.setItem(key, JSON.stringify({ text, ts: Date.now() }));
  return { text };
}

// open modal with content
async function openProjectModal(repoName) {
  modalBody.innerHTML = `<div class="modal-loader">Đang tải thông tin <span class="dotdot">...</span></div>`;
  openModal();
  const data = await fetchRepoDetails(repoName);

  if (data.error && !data.repo) {
    modalBody.innerHTML = `
        <h2 id="modal-title">${repoName}</h2>
        <p>Không thể lấy dữ liệu từ GitHub (có thể do rate limit hoặc lỗi mạng).</p>
        <p><a href="https://github.com/${OWNER}/${repoName}" target="_blank" rel="noopener noreferrer">Mở repo trên GitHub</a></p>
      `;
    return;
  }

  const r = data.repo;
  const stars = r ? r.stargazers_count || 0 : 0;
  const pushed = r
    ? r.pushed_at
      ? fmtDate(r.pushed_at)
      : "Không có"
    : "Không có";
  const homepage = r && r.homepage ? r.homepage : null;
  const htmlUrl = r ? r.html_url : `https://github.com/${OWNER}/${repoName}`;

  // try to find a demo link within README if homepage missing
  let demoLink = homepage;
  if (!demoLink && data.readme) {
    const match = data.readme.match(/https?:\/\/[^\s)'"`]+/);
    if (match) demoLink = match[0];
  }

  // build issues/PR list html
  let issuesHtml = "<p>Không có issue/PR mở.</p>";
  if (data.issues && data.issues.length) {
    issuesHtml = '<ul class="issues-list">';
    data.issues.forEach((it) => {
      issuesHtml += `<li><a href="${
        it.html_url
      }" target="_blank" rel="noopener noreferrer">#${it.number} [${
        it.type
      }] — ${it.title}</a> <span class="muted">(${fmtDate(it.created_at)} by ${
        it.user
      })</span></li>`;
    });
    issuesHtml += "</ul>";
  }

  // README html (converted)
  let readmeHtml = "<p>(Không tìm thấy README)</p>";
  if (data.readme) {
    readmeHtml = simpleMarkdownToHTML(data.readme.slice(0, 5000)); // limit to first N chars
    // add 'View full README' link
    readmeHtml += `<p><a class="small-link" href="${htmlUrl}/blob/main/README.md" target="_blank" rel="noopener noreferrer">Xem README đầy đủ trên GitHub</a></p>`;
  } else {
    readmeHtml = `<p>Không có README hoặc không thể tải README. <a class="small-link" href="${htmlUrl}" target="_blank" rel="noopener noreferrer">Mở trên GitHub</a></p>`;
  }

  modalBody.innerHTML = `
      <header class="modal-header">
        <h2 id="modal-title">${r.name}</h2>
        <div class="modal-stats">
          <span>⭐ ${stars}</span>
          <span>⏱️ Last pushed: ${pushed}</span>
          ${r.language ? `<span>🧰 ${r.language}</span>` : ""}
        </div>
        <div class="modal-links">
          <a class="btn small" href="${htmlUrl}" target="_blank" rel="noopener noreferrer">Mở repo</a>
          ${
            demoLink
              ? `<a class="btn small outline" href="${demoLink}" target="_blank" rel="noopener noreferrer">Demo</a>`
              : ""
          }
        </div>
      </header>

      <section class="modal-section">
        <h3>README (preview)</h3>
        <div class="readme">${readmeHtml}</div>
      </section>

      <section class="modal-section">
        <h3>Open issues & PRs (mới nhất)</h3>
        ${issuesHtml}
      </section>
    `;
}

function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll(
    'a, button, input, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0],
    last = focusable[focusable.length - 1];
  modalEl.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

// initialize
loadRepos();
