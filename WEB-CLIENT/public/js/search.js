// search.js (URL-based)
// No YouTube Data API, no API key.
// We parse a YouTube URL, fetch title+thumbnail via oEmbed (no key), then allow play + add to playlists.

const PLAYLISTS_KEY = "playlists";

let currentUser = null;
let playerModalInstance = null;
let addModalInstance = null;
let toastInstance = null;

let pendingVideo = null;

document.addEventListener("DOMContentLoaded", () => {
    currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    // Welcome
    document.getElementById("welcomeTitle").textContent = `שלום ${currentUser.username}`;
    const img = document.getElementById("welcomeImg");
    img.src = currentUser.imageUrl;
    img.onerror = () => (img.src = "https://via.placeholder.com/56?text=User");

    // Bootstrap
    playerModalInstance = new bootstrap.Modal(document.getElementById("playerModal"));
    addModalInstance = new bootstrap.Modal(document.getElementById("addModal"));
    toastInstance = new bootstrap.Toast(document.getElementById("saveToast"));

    // Events
    document.getElementById("urlForm").addEventListener("submit", onUrlSubmit);
    document.getElementById("confirmAddBtn").addEventListener("click", onConfirmAdd);

    // Stop video when modal closes
    document.getElementById("playerModal").addEventListener("hidden.bs.modal", () => {
        document.getElementById("playerFrame").src = "";
    });
});

// ---------- SESSION ----------
function getCurrentUser() {
    const raw = sessionStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
}

// ---------- URL FLOW ----------
async function onUrlSubmit(e) {
    e.preventDefault();

    const urlEl = document.getElementById("videoUrl");
    const msgEl = document.getElementById("urlMsg");
    const grid = document.getElementById("resultsGrid");

    setMsg(msgEl, "", "");
    grid.innerHTML = "";

    const url = urlEl.value.trim();
    if (!url) {
        setMsg(msgEl, "Please paste a URL.", "text-danger");
        return;
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
        setMsg(msgEl, "Invalid YouTube URL. Try watch?v=..., youtu.be/..., or /shorts/...", "text-danger");
        return;
    }

    try {
        // Fetch metadata (title + thumbnail) via oEmbed (no key)
        const meta = await fetchOEmbed(url);

        const video = {
            videoId,
            title: meta.title || "YouTube Video",
            thumbnailUrl: meta.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            // Not available without YouTube Data API:
            duration: "—",
            views: "—",
        };

        renderSingleResult(video);
    } catch (err) {
        console.error(err);
        setMsg(msgEl, "Could not fetch video info. The URL might be private/blocked.", "text-danger");
    }
}

function extractYouTubeVideoId(url) {
    try {
        const u = new URL(url);

        // youtu.be/<id>
        if (u.hostname.includes("youtu.be")) {
            const id = u.pathname.split("/").filter(Boolean)[0];
            return id || null;
        }

        // youtube.com/watch?v=<id>
        if (u.hostname.includes("youtube.com") || u.hostname.includes("m.youtube.com")) {
            if (u.pathname === "/watch") {
                return u.searchParams.get("v");
            }

            // youtube.com/shorts/<id>
            const parts = u.pathname.split("/").filter(Boolean);
            if (parts[0] === "shorts" && parts[1]) return parts[1];

            // youtube.com/embed/<id>
            if (parts[0] === "embed" && parts[1]) return parts[1];
        }

        return null;
    } catch {
        return null;
    }
}

async function fetchOEmbed(videoUrl) {
    // YouTube oEmbed endpoint (no key needed)
    const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error("oEmbed failed");
    return await res.json();
}

// ---------- RENDER ----------
function renderSingleResult(v) {
    const grid = document.getElementById("resultsGrid");
    const userPlaylists = getUserPlaylists(currentUser.username);
    const existingVideoIds = new Set(getAllVideoIdsFromPlaylists(userPlaylists));
    const alreadySaved = existingVideoIds.has(v.videoId);

    const btnClass = alreadySaved ? "btn-secondary" : "btn-outline-primary";
    const btnText = alreadySaved ? "Added" : "Add to favorites";
    const btnDisabled = alreadySaved ? "disabled" : "";

    grid.innerHTML = `
    <div class="col-12 col-md-6 col-lg-4">
      <div class="card shadow-sm video-card h-100">
        ${alreadySaved ? `<div class="card-check">✓</div>` : ""}

        <img
          src="${escapeHtml(v.thumbnailUrl)}"
          class="card-img-top video-thumb"
          alt="thumbnail"
          role="button"
          id="thumbPlay"
        />

        <div class="card-body d-flex flex-column">
          <h6
            class="video-title mb-2"
            title="${escapeHtml(v.title)}"
            role="button"
            id="titlePlay"
          >
            ${escapeHtml(v.title)}
          </h6>

          <div class="small text-muted mb-2">
            <div><strong>Duration:</strong> ${escapeHtml(v.duration)}</div>
            <div><strong>Views:</strong> ${escapeHtml(v.views)}</div>
          </div>

          <div class="mt-auto d-flex gap-2">
            <button class="btn btn-sm btn-outline-dark" id="btnPlay">Player</button>

            <button
              class="btn btn-sm ${btnClass} flex-grow-1"
              id="btnAdd"
              ${btnDisabled}
            >
              ${btnText}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

    // Play handlers
    document.getElementById("thumbPlay").addEventListener("click", () => openPlayerModal(v.videoId, v.title));
    document.getElementById("titlePlay").addEventListener("click", () => openPlayerModal(v.videoId, v.title));
    document.getElementById("btnPlay").addEventListener("click", () => openPlayerModal(v.videoId, v.title));

    // Add handler
    const btnAdd = document.getElementById("btnAdd");
    if (btnAdd && !alreadySaved) {
        btnAdd.addEventListener("click", () => openAddModal(v));
    }
}

// ---------- PLAYER MODAL ----------
function openPlayerModal(videoId, title) {
    document.getElementById("playerTitle").textContent = title;
    document.getElementById("playerFrame").src =
        `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
    playerModalInstance.show();
}

// ---------- ADD TO PLAYLIST ----------
function openAddModal(video) {
    pendingVideo = video;

    document.getElementById("addVideoTitle").textContent = video.title;
    document.getElementById("newPlaylistName").value = "";
    setMsg(document.getElementById("addMsg"), "", "");

    const select = document.getElementById("playlistSelect");
    const playlists = getUserPlaylists(currentUser.username);

    select.innerHTML = playlists.length
        ? playlists.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")
        : `<option value="">(No playlists yet)</option>`;

    addModalInstance.show();
}

function onConfirmAdd() {
    const msgEl = document.getElementById("addMsg");
    setMsg(msgEl, "", "");

    if (!pendingVideo) {
        setMsg(msgEl, "No video selected.", "text-danger");
        return;
    }

    const username = currentUser.username;

    const playlistsAll = readAllPlaylists();
    const userPlaylists = playlistsAll[username] || [];

    // Prevent duplicates across ALL playlists
    const already = userPlaylists.some((pl) => (pl.items || []).some((it) => it.videoId === pendingVideo.videoId));
    if (already) {
        setMsg(msgEl, "This video is already in one of your playlists.", "text-danger");
        return;
    }

    const selectedPlaylistId = document.getElementById("playlistSelect").value;
    const newName = document.getElementById("newPlaylistName").value.trim();

    let targetPlaylist = null;

    if (newName) {
        targetPlaylist = { id: createId("pl"), name: newName, items: [] };
        userPlaylists.push(targetPlaylist);
    } else {
        if (!selectedPlaylistId) {
            setMsg(msgEl, "Please choose a playlist or create a new one.", "text-danger");
            return;
        }
        targetPlaylist = userPlaylists.find((p) => p.id === selectedPlaylistId);
        if (!targetPlaylist) {
            setMsg(msgEl, "Selected playlist not found.", "text-danger");
            return;
        }
    }

    targetPlaylist.items = targetPlaylist.items || [];
    targetPlaylist.items.push({
        videoId: pendingVideo.videoId,
        title: pendingVideo.title,
        thumbnailUrl: pendingVideo.thumbnailUrl,
        duration: pendingVideo.duration,
        views: pendingVideo.views,
        addedAt: new Date().toISOString(),
    });

    playlistsAll[username] = userPlaylists;
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlistsAll));

    addModalInstance.hide();
    showSavedToast(targetPlaylist);

    // Refresh preview to show ✓ and disable button
    renderSingleResult(pendingVideo);

    pendingVideo = null;
}

function showSavedToast(playlist) {
    const toastBody = document.getElementById("toastBody");
    toastBody.innerHTML = `
    Saved to <strong>${escapeHtml(playlist.name)}</strong>.
    <a href="playlists.html?playlistId=${encodeURIComponent(playlist.id)}" class="ms-2">Go to playlist</a>
  `;
    toastInstance.show();
}

// ---------- PLAYLIST STORAGE HELPERS ----------
function readAllPlaylists() {
    const raw = localStorage.getItem(PLAYLISTS_KEY);
    return raw ? JSON.parse(raw) : {};
}

function getUserPlaylists(username) {
    const all = readAllPlaylists();
    return all[username] || [];
}

function getAllVideoIdsFromPlaylists(playlists) {
    const ids = [];
    playlists.forEach((pl) => (pl.items || []).forEach((it) => ids.push(it.videoId)));
    return ids;
}

function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------- UI HELPERS ----------
function setMsg(el, text, className) {
    if (!el) return;
    el.className = `small mt-2 ${className || ""}`;
    el.textContent = text;
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
