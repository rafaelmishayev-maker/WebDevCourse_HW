/* playlists.js
   - Shows all playlists of current user (stored in localStorage under playlists_<username>)
   - Layout: sidebar + main
   - Supports querystring (?playlist=NAME) and hash (#playlist=NAME)
   - Default: first playlist if exists
   - Rating per video (1-5), store per-video rating inside saved video object
   - Sort: A-Z or Rating
   - Filter by title
   - Delete video / delete playlist
   - Play single video in modal + play playlist (queue)
*/

const PlaylistsPage = (() => {
    function qs(id) { return document.getElementById(id); }

    function currentUser() { return Auth.getCurrentUserSession(); }

    function userKey() {
        const u = currentUser();
        return `playlists_${(u.username || "").toLowerCase()}`;
    }

    function loadUserData() {
        try {
            const raw = localStorage.getItem(userKey());
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === "object") return parsed;
        } catch { }
        return { playlists: {} };
    }

    function saveUserData(data) {
        localStorage.setItem(userKey(), JSON.stringify(data));
    }

    function playlistNames(data) {
        return Object.keys(data.playlists || {});
    }

    function renderWelcome() {
        const u = currentUser();
        const displayName = u.firstName?.trim() ? u.firstName.trim() : u.username;
        qs("welcomeMsg").textContent = `שלום ${displayName}`;
        qs("userAvatar").src = u.imageUrl || "";
    }

    // ---------- URL parameter parsing ----------
    function getRequestedPlaylistName() {
        // Supports:
        // 1) ?playlist=NAME
        // 2) #playlist=NAME  (from toast)
        const url = new URL(window.location.href);

        const q = url.searchParams.get("playlist");
        if (q) return q;

        const hash = (url.hash || "").replace("#", "");
        if (hash.startsWith("playlist=")) {
            return decodeURIComponent(hash.slice("playlist=".length));
        }
        return "";
    }

    // ---------- State ----------
    let data;
    let activePlaylist = ""; // name
    let playerModal;
    let playingQueue = [];
    let queueIndex = 0;

    // ---------- Sidebar ----------
    function setSidebarButtonsEnabled(enabled) {
        qs("playPlaylistBtn").disabled = !enabled;
        qs("deletePlaylistBtn").disabled = !enabled;
    }

    function renderSidebar() {
        const list = qs("playlistList");
        list.innerHTML = "";

        const names = playlistNames(data);

        if (names.length === 0) {
            list.innerHTML = `<div class="text-muted small p-2">No playlists yet.</div>`;
            setSidebarButtonsEnabled(false);
            return;
        }

        names.forEach(name => {
            const a = document.createElement("button");
            a.type = "button";
            a.className = "list-group-item list-group-item-action";
            a.textContent = name;

            if (name === activePlaylist) {
                a.classList.add("active");
            }

            a.addEventListener("click", () => {
                setActivePlaylist(name, true);
            });

            list.appendChild(a);
        });

        setSidebarButtonsEnabled(!!activePlaylist);
    }

    // ---------- Main content ----------
    function getActiveVideos() {
        if (!activePlaylist) return [];
        return (data.playlists?.[activePlaylist] || []).slice();
    }

    function ensureRatingField(videos) {
        // store rating in video object: rating: 0..5
        for (const v of videos) {
            if (typeof v.rating !== "number") v.rating = 0;
        }
    }

    function sortVideos(videos) {
        const mode = qs("sortSelect").value;
        if (mode === "rating") {
            videos.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.title || "").localeCompare(b.title || ""));
        } else {
            videos.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        }
        return videos;
    }

    function filterVideos(videos) {
        const term = qs("innerSearch").value.trim().toLowerCase();
        if (!term) return videos;
        return videos.filter(v => (v.title || "").toLowerCase().includes(term));
    }

    function starHtml(current) {
        // 1..5 clickable
        let out = "";
        for (let i = 1; i <= 5; i++) {
            const filled = i <= (current || 0);
            out += `
        <button type="button" class="btn btn-sm p-0 star-btn ${filled ? "text-warning" : "text-muted"}"
                data-star="${i}" aria-label="rate ${i}">
          ${filled ? "★" : "☆"}
        </button>
      `;
        }
        return out;
    }

    function renderMain() {
        const empty = qs("emptyState");
        const wrap = qs("videosWrap");
        const nameEl = qs("activePlaylistName");

        if (!activePlaylist) {
            nameEl.textContent = "No playlist selected";
            empty.classList.remove("d-none");
            wrap.classList.add("d-none");
            wrap.innerHTML = "";
            return;
        }

        nameEl.textContent = `Active: ${activePlaylist}`;

        let videos = getActiveVideos();
        ensureRatingField(videos);

        videos = sortVideos(filterVideos(videos));

        if (videos.length === 0) {
            empty.textContent = "This playlist is empty.";
            empty.classList.remove("d-none");
            wrap.classList.add("d-none");
            wrap.innerHTML = "";
            return;
        }

        empty.classList.add("d-none");
        wrap.classList.remove("d-none");
        wrap.innerHTML = "";

        videos.forEach(v => {
            const col = document.createElement("div");
            col.className = "col-12 col-md-6 col-lg-4";

            col.innerHTML = `
        <div class="card shadow-sm h-100 position-relative">
          <img src="${v.thumbnail}" class="card-img-top" alt="thumbnail" style="cursor:pointer;">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title video-title" style="cursor:pointer;" title="${v.title}" data-bs-toggle="tooltip">${v.title}</h5>

            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="small text-muted">Your rating:</span>
              <div class="stars" data-video-id="${v.videoId}">
                ${starHtml(v.rating || 0)}
              </div>
            </div>

            <div class="mt-auto d-flex gap-2">
              <button class="btn btn-primary btn-sm play-one">Play</button>
              <button class="btn btn-outline-danger btn-sm delete-one">Remove</button>
            </div>
          </div>
        </div>
      `;

            // play click on image/title
            col.querySelector("img").addEventListener("click", () => openPlayer(v.videoId, v.title));
            col.querySelector(".video-title").addEventListener("click", () => openPlayer(v.videoId, v.title));
            col.querySelector(".play-one").addEventListener("click", () => openPlayer(v.videoId, v.title));

            // delete video
            col.querySelector(".delete-one").addEventListener("click", () => {
                removeVideoFromActive(v.videoId);
            });

            // rating stars
            col.querySelectorAll(".star-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const rating = Number(btn.getAttribute("data-star"));
                    setVideoRating(v.videoId, rating);
                });
            });

            wrap.appendChild(col);
        });

        // tooltips
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
    }

    function setVideoRating(videoId, rating) {
        if (!activePlaylist) return;
        const arr = data.playlists[activePlaylist] || [];
        const item = arr.find(x => x.videoId === videoId);
        if (!item) return;
        item.rating = rating;
        saveUserData(data);
        renderMain();
    }

    function removeVideoFromActive(videoId) {
        if (!activePlaylist) return;
        const arr = data.playlists[activePlaylist] || [];
        const next = arr.filter(v => v.videoId !== videoId);
        data.playlists[activePlaylist] = next;
        saveUserData(data);
        renderMain();
    }

    function deleteActivePlaylist() {
        if (!activePlaylist) return;
        const ok = confirm(`Delete playlist "${activePlaylist}"?`);
        if (!ok) return;

        delete data.playlists[activePlaylist];
        saveUserData(data);

        // choose next active playlist
        const names = playlistNames(data);
        activePlaylist = names[0] || "";
        renderSidebar();
        renderMain();

        // update URL
        setUrlPlaylist(activePlaylist);
    }

    function setUrlPlaylist(name) {
        const url = new URL(window.location.href);
        if (name) {
            url.searchParams.set("playlist", name);
            url.hash = "";
        } else {
            url.searchParams.delete("playlist");
            url.hash = "";
        }
        window.history.replaceState({}, "", url.toString());
    }

    function setActivePlaylist(name, updateUrl) {
        activePlaylist = name || "";
        if (updateUrl) setUrlPlaylist(activePlaylist);
        renderSidebar();
        renderMain();
    }

    // ---------- Create playlist modal ----------
    let createModal;

    function showCreateError(msg) {
        const box = qs("createError");
        box.textContent = msg;
        box.classList.remove("d-none");
    }

    function hideCreateError() {
        const box = qs("createError");
        box.classList.add("d-none");
        box.textContent = "";
    }

    function createPlaylist(nameRaw) {
        const name = (nameRaw || "").trim();
        if (!name) return { ok: false, msg: "Playlist name is required." };

        if (!data.playlists) data.playlists = {};
        if (data.playlists[name]) return { ok: false, msg: "Playlist already exists." };

        data.playlists[name] = [];
        saveUserData(data);
        return { ok: true, name };
    }

    // ---------- Player ----------
    function openPlayer(videoId, title) {
        qs("playerTitle").textContent = title || "Player";
        qs("playerFrame").src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        playerModal.show();
    }

    function stopPlayer() {
        qs("playerFrame").src = "";
    }

    // Play playlist (simple queue: plays videos sequentially when modal closes -> next)
    function playPlaylist() {
        const videos = getActiveVideos();
        if (!videos.length) {
            alert("Playlist is empty.");
            return;
        }
        playingQueue = videos.slice();
        queueIndex = 0;
        openPlayer(playingQueue[0].videoId, playingQueue[0].title);
    }

    function playNextInQueue() {
        if (!playingQueue.length) return;
        queueIndex++;
        if (queueIndex >= playingQueue.length) {
            playingQueue = [];
            queueIndex = 0;
            return;
        }
        openPlayer(playingQueue[queueIndex].videoId, playingQueue[queueIndex].title);
    }

    // ---------- Init ----------
    function initDefaultPlaylistFromUrlOrFirst() {
        const names = playlistNames(data);
        const requested = getRequestedPlaylistName();

        if (requested && names.includes(requested)) {
            activePlaylist = requested;
            setUrlPlaylist(activePlaylist);
            return;
        }

        // default: first playlist
        activePlaylist = names[0] || "";
        if (activePlaylist) setUrlPlaylist(activePlaylist);
    }

    function init() {
        renderWelcome();

        data = loadUserData();

        // modals
        createModal = new bootstrap.Modal(qs("createPlaylistModal"));
        playerModal = new bootstrap.Modal(qs("playerModal"));
        qs("playerModal").addEventListener("hidden.bs.modal", () => {
            stopPlayer();
            // if queue active, move to next
            if (playingQueue.length) {
                // small delay so bootstrap finishes close animation
                setTimeout(playNextInQueue, 200);
            }
        });

        // URL -> active playlist
        initDefaultPlaylistFromUrlOrFirst();

        // render
        renderSidebar();
        renderMain();

        // sidebar buttons
        qs("playPlaylistBtn").addEventListener("click", playPlaylist);
        qs("deletePlaylistBtn").addEventListener("click", deleteActivePlaylist);

        // create playlist
        qs("newPlaylistBtn").addEventListener("click", () => {
            hideCreateError();
            qs("playlistNameInput").value = "";
            createModal.show();
        });

        qs("createPlaylistConfirm").addEventListener("click", () => {
            hideCreateError();
            const name = qs("playlistNameInput").value;
            const res = createPlaylist(name);
            if (!res.ok) {
                showCreateError(res.msg);
                return;
            }
            createModal.hide();

            // activate new playlist
            setActivePlaylist(res.name, true);
        });

        // main controls
        qs("innerSearch").addEventListener("input", renderMain);
        qs("sortSelect").addEventListener("change", renderMain);

        // Also handle back/forward changing querystring:
        window.addEventListener("popstate", () => {
            const requested = getRequestedPlaylistName();
            const names = playlistNames(data);
            if (requested && names.includes(requested)) setActivePlaylist(requested, false);
        });
    }

    return { init };
})();
