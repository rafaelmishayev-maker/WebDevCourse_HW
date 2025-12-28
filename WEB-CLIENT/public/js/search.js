/* search.js
   - YouTube Data API v3: search + videos(details)
   - Render cards with: title (2-line clamp + tooltip), thumbnail, duration, views
   - Play in Bootstrap modal
   - Add to favorites playlists (per logged-in user) in localStorage
   - If video already in any playlist: show check overlay + disable/gray add button
   - Toast with link to playlists.html (with hash)
*/

const SearchPage = (() => {
    // ====== CONFIG ======
    const YT_API_KEY = "AIzaSyBx5IORHW_KI5118yxivuW-dQtezxiLO5w"; // <-- my key
    const MAX_RESULTS = 12;

    // localStorage key for playlists
    // each user has its own object: { playlists: { [playlistName]: [videoObj, ...] } }
    function userPlaylistsKey(username) {
        return `playlists_${(username || "").toLowerCase()}`;
    }

    // ====== Helpers ======
    function qs(id) { return document.getElementById(id); }

    function currentUser() {
        return Auth.getCurrentUserSession();
    }

    function formatNumber(n) {
        if (n === null || n === undefined) return "-";
        const num = Number(n);
        if (Number.isNaN(num)) return "-";
        return num.toLocaleString();
    }

    // ISO 8601 duration (PT#H#M#S) -> mm:ss or h:mm:ss
    function parseISODuration(iso) {
        if (!iso) return "-";
        const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!m) return "-";
        const h = Number(m[1] || 0);
        const min = Number(m[2] || 0);
        const s = Number(m[3] || 0);
        const total = h * 3600 + min * 60 + s;
        const hh = Math.floor(total / 3600);
        const mm = Math.floor((total % 3600) / 60);
        const ss = total % 60;

        const pad2 = (x) => String(x).padStart(2, "0");
        if (hh > 0) return `${hh}:${pad2(mm)}:${pad2(ss)}`;
        return `${mm}:${pad2(ss)}`;
    }

    function clampTitleWithTooltip(el, fullTitle) {
        // If it gets clamped, show tooltip on hover
        // We’ll always set title attribute; tooltip will show via Bootstrap tooltips.
        el.setAttribute("title", fullTitle);
        el.setAttribute("data-bs-toggle", "tooltip");
        el.setAttribute("data-bs-placement", "top");
    }

    function getUserData() {
        const u = currentUser();
        const key = userPlaylistsKey(u.username);
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === "object") return parsed;
        } catch { }
        return { playlists: {} };
    }

    function saveUserData(data) {
        const u = currentUser();
        const key = userPlaylistsKey(u.username);
        localStorage.setItem(key, JSON.stringify(data));
    }

    function listPlaylistNames() {
        const data = getUserData();
        return Object.keys(data.playlists || {});
    }

    function isVideoInAnyPlaylist(videoId) {
        const data = getUserData();
        const pls = data.playlists || {};
        for (const name of Object.keys(pls)) {
            const arr = pls[name] || [];
            if (arr.some(v => v.videoId === videoId)) return true;
        }
        return false;
    }

    function addVideoToPlaylist(playlistName, videoObj) {
        const data = getUserData();
        if (!data.playlists) data.playlists = {};
        if (!data.playlists[playlistName]) data.playlists[playlistName] = [];

        const already = data.playlists[playlistName].some(v => v.videoId === videoObj.videoId);
        if (already) return { ok: false, reason: "Video already exists in this playlist." };

        data.playlists[playlistName].push(videoObj);
        saveUserData(data);
        return { ok: true };
    }

    // ====== YouTube API ======
    async function ytSearch(query) {
        const params = new URLSearchParams({
            part: "snippet",
            q: query,
            type: "video",
            maxResults: String(MAX_RESULTS),
            key: YT_API_KEY
        });

        const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
            const msg = data?.error?.message || "YouTube search failed";
            throw new Error(msg);
        }
        return data.items || [];
    }

    async function ytGetVideoDetails(videoIds) {
        if (!videoIds.length) return new Map();

        const params = new URLSearchParams({
            part: "contentDetails,statistics",
            id: videoIds.join(","),
            key: YT_API_KEY
        });

        const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
            const msg = data?.error?.message || "YouTube videos(details) failed";
            throw new Error(msg);
        }

        const map = new Map();
        for (const item of (data.items || [])) {
            map.set(item.id, {
                duration: parseISODuration(item.contentDetails?.duration),
                views: item.statistics?.viewCount ?? null
            });
        }
        return map;
    }

    // ====== Rendering ======
    function renderWelcome() {
        const u = currentUser();
        const welcome = qs("welcomeMsg");
        const avatar = qs("userAvatar");

        // Requirement says: "שלום [שם המשתמש]"
        // We'll use firstName if exists, else username
        const displayName = u.firstName?.trim() ? u.firstName.trim() : u.username;

        welcome.textContent = `Hello ${displayName}`;
        avatar.src = u.imageUrl || "";
    }

    function renderPlaylistDropdown() {
        const select = qs("playlistSelect");
        select.innerHTML = `<option value="">-- Select playlist --</option>`;
        for (const name of listPlaylistNames()) {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        }
    }

    function makeCard(video, meta) {
        const alreadyFav = isVideoInAnyPlaylist(video.videoId);

        const col = document.createElement("div");
        col.className = "col-12 col-md-6 col-lg-4";

        const btnClass = alreadyFav ? "btn btn-secondary btn-sm" : "btn btn-outline-primary btn-sm";
        const btnText = alreadyFav ? "Added" : "Add to favorites";

        col.innerHTML = `
      <div class="card shadow-sm h-100 video-card position-relative">
        ${alreadyFav ? `<div class="card-check">✓</div>` : ""}

        <img src="${video.thumbnail}" class="card-img-top video-thumb" alt="thumbnail" style="cursor:pointer;">

        <div class="card-body d-flex flex-column">
          <h5 class="card-title video-title mb-2" style="cursor:pointer;"></h5>

          <div class="small text-muted mb-2">
            <div><strong>Duration:</strong> <span class="v-duration">${meta.duration ?? "-"}</span></div>
            <div><strong>Views:</strong> <span class="v-views">${formatNumber(meta.views)}</span></div>
          </div>

          <div class="mt-auto d-flex gap-2">
            <button class="btn btn-primary btn-sm play-btn">Play</button>
            <button class="${btnClass} add-btn" ${alreadyFav ? "disabled" : ""}>${btnText}</button>
          </div>
        </div>
      </div>
    `;

        const titleEl = col.querySelector(".video-title");
        titleEl.textContent = video.title;
        clampTitleWithTooltip(titleEl, video.title);

        // Click title/thumb -> open modal player
        col.querySelector(".video-thumb").addEventListener("click", () => openPlayer(video.videoId, video.title));
        titleEl.addEventListener("click", () => openPlayer(video.videoId, video.title));
        col.querySelector(".play-btn").addEventListener("click", () => openPlayer(video.videoId, video.title));

        // Add to favorites
        col.querySelector(".add-btn").addEventListener("click", () => openAddModal(video));

        return col;
    }

    function renderResults(videos, detailsMap) {
        const grid = qs("resultsGrid");
        const count = qs("resultsCount");
        grid.innerHTML = "";

        count.textContent = `${videos.length} results`;

        for (const v of videos) {
            const meta = detailsMap.get(v.videoId) || { duration: "-", views: null };
            grid.appendChild(makeCard(v, meta));
        }

        // enable bootstrap tooltips
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));
    }

    // ====== Player Modal ======
    let playerModal;
    function openPlayer(videoId, title) {
        qs("playerTitle").textContent = title || "Player";
        // autoplay inside modal
        qs("playerFrame").src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        playerModal.show();
    }

    function stopPlayer() {
        qs("playerFrame").src = "";
    }

    // ====== Add Modal ======
    let addModal;
    let saveToast;

    function openAddModal(videoObj) {
        // refresh dropdown on every open
        renderPlaylistDropdown();

        qs("selectedVideoId").value = videoObj.videoId;
        qs("newPlaylistName").value = "";
        qs("addError").classList.add("d-none");
        qs("addError").textContent = "";

        // store current selected video object in memory
        openAddModal._video = videoObj;

        addModal.show();
    }

    function showAddError(msg) {
        const box = qs("addError");
        box.textContent = msg;
        box.classList.remove("d-none");
    }

    function showSavedToast(playlistName) {
        const link = qs("toastLink");
        link.href = `playlists.html#playlist=${encodeURIComponent(playlistName)}`;
        link.textContent = `Go to "${playlistName}"`;
        saveToast.show();
    }

    function handleConfirmAdd() {
        const video = openAddModal._video;
        if (!video) return;

        const chosen = qs("playlistSelect").value.trim();
        const newName = qs("newPlaylistName").value.trim();

        let playlistName = "";
        if (newName) playlistName = newName;
        else if (chosen) playlistName = chosen;

        if (!playlistName) {
            showAddError("Please select an existing playlist or create a new one.");
            return;
        }

        // If already in ANY playlist -> block (requirement 4.4 already shows disabled button,
        // but just in case user opened modal earlier)
        if (isVideoInAnyPlaylist(video.videoId)) {
            showAddError("This video is already in your favorites (one of your playlists).");
            return;
        }

        const res = addVideoToPlaylist(playlistName, video);
        if (!res.ok) {
            showAddError(res.reason || "Failed to save.");
            return;
        }

        addModal.hide();
        showSavedToast(playlistName);

        // Re-run the current results rendering state visually by triggering a new search render?
        // Simple approach: just disable the relevant card button and show checkmark.
        // We'll update cards in DOM:
        markVideoAsSavedInUI(video.videoId);
    }

    function markVideoAsSavedInUI(videoId) {
        const cards = document.querySelectorAll(".video-card");
        cards.forEach(card => {
            const playBtn = card.querySelector(".play-btn");
            const addBtn = card.querySelector(".add-btn");
            const titleEl = card.querySelector(".video-title");
            const thumbEl = card.querySelector(".video-thumb");

            // identify card by looking at the iframe link? We don't store id on card yet.
            // We'll store data-video-id on title (easy):
        });

        // Better: set data-video-id at creation time. We'll patch quickly:
        // (If your cards were rendered before, they already include it because we set it below in init hook.)
        const card = document.querySelector(`[data-video-id="${CSS.escape(videoId)}"]`);
        if (!card) return;

        // add check overlay
        if (!card.querySelector(".card-check")) {
            const check = document.createElement("div");
            check.className = "card-check";
            check.textContent = "✓";
            card.appendChild(check);
        }

        const addBtn = card.querySelector(".add-btn");
        if (addBtn) {
            addBtn.className = "btn btn-secondary btn-sm add-btn";
            addBtn.textContent = "Added";
            addBtn.disabled = true;
        }
    }

    // ====== Search flow ======
    async function runSearch(query) {
        if (!YT_API_KEY || YT_API_KEY === "PUT_YOUR_API_KEY_HERE") {
            alert("Please set your YouTube API key in js/search.js (YT_API_KEY).");
            return;
        }

        qs("resultsCount").textContent = "Loading...";
        qs("resultsGrid").innerHTML = "";

        const items = await ytSearch(query);

        // normalize
        const videos = items
            .map(it => ({
                videoId: it.id?.videoId,
                title: it.snippet?.title || "",
                thumbnail: it.snippet?.thumbnails?.high?.url
                    || it.snippet?.thumbnails?.medium?.url
                    || it.snippet?.thumbnails?.default?.url
                    || "",
                channelTitle: it.snippet?.channelTitle || ""
            }))
            .filter(v => !!v.videoId);

        const ids = videos.map(v => v.videoId);
        const detailsMap = await ytGetVideoDetails(ids);

        renderResults(videos, detailsMap);

        // add data-video-id to each card root for UI updates
        document.querySelectorAll(".video-card").forEach((card, idx) => {
            const id = videos[idx]?.videoId;
            if (id) card.setAttribute("data-video-id", id);
        });
    }

    // ====== Init ======
    function init() {
        renderWelcome();

        playerModal = new bootstrap.Modal(qs("playerModal"));
        addModal = new bootstrap.Modal(qs("addModal"));
        saveToast = new bootstrap.Toast(qs("saveToast"));

        // stop iframe on close modal
        qs("playerModal").addEventListener("hidden.bs.modal", stopPlayer);

        qs("searchForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const q = qs("queryInput").value.trim();
            if (!q) return;

            try {
                await runSearch(q);
            } catch (err) {
                qs("resultsCount").textContent = "";
                alert(err?.message || "Search failed");
            }
        });

        qs("confirmAddBtn").addEventListener("click", handleConfirmAdd);
    }

    return { init };
})();
