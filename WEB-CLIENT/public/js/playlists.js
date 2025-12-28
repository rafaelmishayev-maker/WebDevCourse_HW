// playlists.js
// Shows user's playlists, supports querystring playlistId, internal search, sorting, rating, delete video/playlist, and playlist player.

const PLAYLISTS_KEY = "playlists";

let currentUser = null;
let activePlaylistId = null;

// Bootstrap modal
let createModal = null;
let playerModal = null;

// Player state
let playerIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
    currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    createModal = new bootstrap.Modal(document.getElementById("createPlaylistModal"));
    playerModal = new bootstrap.Modal(document.getElementById("playerModal"));

    // Events
    document.getElementById("newPlaylistBtn").addEventListener("click", () => {
        document.getElementById("newPlaylistName").value = "";
        setMsg("createMsg", "", "");
        createModal.show();
    });

    document.getElementById("confirmCreatePlaylist").addEventListener("click", createNewPlaylist);
    document.getElementById("playPlaylistBtn").addEventListener("click", playActivePlaylist);
    document.getElementById("deletePlaylistBtn").addEventListener("click", deleteActivePlaylist);

    document.getElementById("internalSearch").addEventListener("input", renderActivePlaylistVideos);
    document.getElementById("sortSelect").addEventListener("change", renderActivePlaylistVideos);

    document.getElementById("prevBtn").addEventListener("click", () => stepPlayer(-1));
    document.getElementById("nextBtn").addEventListener("click", () => stepPlayer(1));

    // Stop video on close
    document.getElementById("playerModal").addEventListener("hidden.bs.modal", () => {
        document.getElementById("playerFrame").src = "";
    });

    // Load playlists and set active based on querystring (or default)
    initActivePlaylistFromQuery();
    renderSidebar();
    ensureActivePlaylist();
    renderActivePlaylistVideos();
});

function getCurrentUser() {
    const raw = sessionStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
}

/* ------------------ QUERYSTRING ------------------ */

function initActivePlaylistFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const qsId = params.get("playlistId");
    if (qsId) activePlaylistId = qsId;
}

function setQueryPlaylistId(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("playlistId", id);
    history.replaceState({}, "", url.toString());
}

/* ------------------ STORAGE ------------------ */

function readAllPlaylists() {
    const raw = localStorage.getItem(PLAYLISTS_KEY);
    return raw ? JSON.parse(raw) : {};
}

function writeAllPlaylists(all) {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(all));
}

function getUserPlaylists() {
    const all = readAllPlaylists();
    return all[currentUser.username] || [];
}

function setUserPlaylists(playlists) {
    const all = readAllPlaylists();
    all[currentUser.username] = playlists;
    writeAllPlaylists(all);
}

function findActivePlaylist() {
    const pls = getUserPlaylists();
    return pls.find((p) => p.id === activePlaylistId) || null;
}

function ensureActivePlaylist() {
    const pls = getUserPlaylists();

    if (pls.length === 0) {
        activePlaylistId = null;
        setMainMsg(true, "בחר פלייליסט מהרשימה. (אין פלייליסטים עדיין — צור אחד חדש)");
        updateHeader(null);
        document.getElementById("videosGrid").innerHTML = "";
        return;
    }

    // If querystring ID invalid, default to first
    const exists = pls.some((p) => p.id === activePlaylistId);
    if (!activePlaylistId || !exists) {
        activePlaylistId = pls[0].id;
    }

    setQueryPlaylistId(activePlaylistId);
    setMainMsg(false, "");
}

/* ------------------ SIDEBAR ------------------ */

function renderSidebar() {
    const listEl = document.getElementById("playlistsList");
    const msgEl = document.getElementById("sidebarMsg");

    const pls = getUserPlaylists();

    if (pls.length === 0) {
        msgEl.textContent = "No playlists yet. Create one!";
        listEl.innerHTML = "";
        return;
    }

    msgEl.textContent = "";

    listEl.innerHTML = pls
        .map((p) => {
            const activeClass = p.id === activePlaylistId ? "active" : "";
            const count = (p.items || []).length;
            return `
        <button
          type="button"
          class="list-group-item list-group-item-action ${activeClass}"
          data-plid="${escapeHtml(p.id)}"
          title="${escapeHtml(p.name)}"
        >
          <div class="d-flex justify-content-between align-items-center">
            <span>${escapeHtml(p.name)}</span>
            <span class="badge text-bg-secondary">${count}</span>
          </div>
        </button>
      `;
        })
        .join("");

    listEl.querySelectorAll("[data-plid]").forEach((btn) => {
        btn.addEventListener("click", () => {
            activePlaylistId = btn.dataset.plid;
            setQueryPlaylistId(activePlaylistId);
            renderSidebar();
            renderActivePlaylistVideos();
        });
    });
}

/* ------------------ MAIN AREA (VIDEOS) ------------------ */

function renderActivePlaylistVideos() {
    ensureActivePlaylist();

    const playlist = findActivePlaylist();
    if (!playlist) return;

    updateHeader(playlist);

    const grid = document.getElementById("videosGrid");
    const searchText = document.getElementById("internalSearch").value.trim().toLowerCase();
    const sortMode = document.getElementById("sortSelect").value;

    let items = (playlist.items || []).map((it) => ({
        ...it,
        rating: Number(it.rating || 0),
    }));

    // Internal search filter by title
    if (searchText) {
        items = items.filter((it) => (it.title || "").toLowerCase().includes(searchText));
    }

    // Sorting
    if (sortMode === "az") {
        items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortMode === "rating_desc") {
        items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortMode === "rating_asc") {
        items.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    }

    if (items.length === 0) {
        grid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-light border mb-0">
          No videos match your filter (or playlist is empty).
        </div>
      </div>
    `;
        return;
    }

    grid.innerHTML = items
        .map((v) => `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card shadow-sm h-100 video-card">
          <img
            src="${escapeHtml(v.thumbnailUrl || "")}"
            class="card-img-top video-thumb"
            alt="thumbnail"
            data-action="play"
            data-video-id="${escapeHtml(v.videoId)}"
            data-title="${escapeHtml(v.title)}"
          />

          <div class="card-body d-flex flex-column">
            <h6
              class="video-title mb-2"
              title="${escapeHtml(v.title)}"
              role="button"
              data-action="play"
              data-video-id="${escapeHtml(v.videoId)}"
              data-title="${escapeHtml(v.title)}"
            >
              ${escapeHtml(v.title)}
            </h6>

            <div class="small text-muted mb-2">
              <div><strong>Duration:</strong> ${escapeHtml(v.duration || "—")}</div>
              <div><strong>Views:</strong> ${escapeHtml(v.views || "—")}</div>
            </div>

            <div class="mt-auto d-flex align-items-center gap-2">
              <label class="small text-muted mb-0">Rating:</label>
              <select class="form-select form-select-sm" style="max-width: 110px;"
                data-action="rate"
                data-video-id="${escapeHtml(v.videoId)}"
              >
                ${renderRatingOptions(v.rating)}
              </select>

              <button class="btn btn-sm btn-outline-danger ms-auto"
                data-action="delete-video"
                data-video-id="${escapeHtml(v.videoId)}"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    `)
        .join("");

    // Play events
    grid.querySelectorAll("[data-action='play']").forEach((el) => {
        el.addEventListener("click", () => openPlayer(el.dataset.videoId, el.dataset.title));
    });

    // Rating events
    grid.querySelectorAll("[data-action='rate']").forEach((sel) => {
        sel.addEventListener("change", () => {
            const videoId = sel.dataset.videoId;
            const rating = Number(sel.value);
            setVideoRating(videoId, rating);
            // re-render if sorting by rating
            if (document.getElementById("sortSelect").value.startsWith("rating")) {
                renderActivePlaylistVideos();
            }
        });
    });

    // Delete video events
    grid.querySelectorAll("[data-action='delete-video']").forEach((btn) => {
        btn.addEventListener("click", () => {
            const videoId = btn.dataset.videoId;
            deleteVideoFromActivePlaylist(videoId);
        });
    });
}

function updateHeader(playlist) {
    const titleEl = document.getElementById("activePlaylistTitle");
    const metaEl = document.getElementById("activePlaylistMeta");

    if (!playlist) {
        titleEl.textContent = "Playlists";
        metaEl.textContent = "";
        return;
    }

    titleEl.textContent = playlist.name;
    metaEl.textContent = `${(playlist.items || []).length} video(s)`;
}

function renderRatingOptions(current) {
    const opts = [];
    opts.push(`<option value="0" ${current === 0 ? "selected" : ""}>0</option>`);
    for (let i = 1; i <= 10; i++) {
        opts.push(`<option value="${i}" ${current === i ? "selected" : ""}>${i}</option>`);
    }
    return opts.join("");
}

/* ------------------ RATING / DELETE ------------------ */

function setVideoRating(videoId, rating) {
    const pls = getUserPlaylists();
    const pl = pls.find((p) => p.id === activePlaylistId);
    if (!pl) return;

    const item = (pl.items || []).find((it) => it.videoId === videoId);
    if (!item) return;

    item.rating = rating;
    setUserPlaylists(pls);
}

function deleteVideoFromActivePlaylist(videoId) {
    const pl = findActivePlaylist();
    if (!pl) return;

    const ok = confirm("Remove this video from the playlist?");
    if (!ok) return;

    const pls = getUserPlaylists();
    const target = pls.find((p) => p.id === activePlaylistId);
    target.items = (target.items || []).filter((it) => it.videoId !== videoId);

    setUserPlaylists(pls);
    renderSidebar();
    renderActivePlaylistVideos();
}

/* ------------------ CREATE / DELETE PLAYLIST ------------------ */

function createNewPlaylist() {
    const name = document.getElementById("newPlaylistName").value.trim();
    if (!name) {
        setMsg("createMsg", "Please enter a playlist name.", "text-danger");
        return;
    }

    const pls = getUserPlaylists();
    const newPl = {
        id: createId("pl"),
        name,
        items: [],
        createdAt: new Date().toISOString(),
    };

    pls.push(newPl);
    setUserPlaylists(pls);

    activePlaylistId = newPl.id;
    setQueryPlaylistId(activePlaylistId);

    createModal.hide();
    renderSidebar();
    renderActivePlaylistVideos();
}

function deleteActivePlaylist() {
    const pl = findActivePlaylist();
    if (!pl) {
        alert("No active playlist to delete.");
        return;
    }

    const ok = confirm(`Delete playlist "${pl.name}"? This cannot be undone.`);
    if (!ok) return;

    let pls = getUserPlaylists();
    pls = pls.filter((p) => p.id !== activePlaylistId);
    setUserPlaylists(pls);

    // Reset active
    activePlaylistId = null;
    renderSidebar();
    ensureActivePlaylist();
    renderActivePlaylistVideos();
}

/* ------------------ PLAYLIST PLAYER ------------------ */

function playActivePlaylist() {
    const pl = findActivePlaylist();
    if (!pl) {
        alert("Choose a playlist first.");
        return;
    }

    const items = pl.items || [];
    if (items.length === 0) {
        alert("This playlist is empty.");
        return;
    }

    playerIndex = 0;
    openPlayer(items[playerIndex].videoId, items[playerIndex].title, true);
}

function stepPlayer(delta) {
    const pl = findActivePlaylist();
    if (!pl) return;

    const items = pl.items || [];
    if (items.length === 0) return;

    playerIndex += delta;
    if (playerIndex < 0) playerIndex = 0;
    if (playerIndex >= items.length) playerIndex = items.length - 1;

    openPlayer(items[playerIndex].videoId, items[playerIndex].title, true);
}

function openPlayer(videoId, title, fromPlaylistPlayer = false) {
    document.getElementById("playerTitle").textContent = title;
    document.getElementById("playerFrame").src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;

    if (fromPlaylistPlayer) {
        const pl = findActivePlaylist();
        const total = (pl?.items || []).length;
        document.getElementById("playerCounter").textContent = `${playerIndex + 1} / ${total}`;
    } else {
        document.getElementById("playerCounter").textContent = "";
    }

    playerModal.show();
}

/* ------------------ UI HELPERS ------------------ */

function setMainMsg(show, text) {
    const el = document.getElementById("mainMsg");
    if (show) {
        el.classList.remove("d-none");
        el.textContent = text;
    } else {
        el.classList.add("d-none");
        el.textContent = "";
    }
}

function setMsg(id, text, className) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `small mt-2 ${className || ""}`;
    el.textContent = text;
}

function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }[m]));
}
