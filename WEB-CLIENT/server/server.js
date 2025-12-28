const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Paths ----------
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DB_DIR = path.join(__dirname, "db");
const USERS_FILE = path.join(DB_DIR, "users.json");
const PLAYLISTS_DIR = path.join(DB_DIR, "playlists");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// ---------- Ensure dirs/files ----------
function ensureDir(p) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(DB_DIR);
ensureDir(PLAYLISTS_DIR);
ensureDir(UPLOADS_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), "utf8");

// ---------- Helpers ----------
function readJson(filePath, fallback) {
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeUsername(u) {
    return String(u || "").trim().toLowerCase();
}

function validatePassword(pw) {
    if (typeof pw !== "string") return false;
    if (pw.length < 6) return false;
    const hasLetter = /[A-Za-z]/.test(pw);
    const hasDigit = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    return hasLetter && hasDigit && hasSpecial;
}

function requireAuth(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

function userPlaylistFile(username) {
    return path.join(PLAYLISTS_DIR, `${normalizeUsername(username)}.json`);
}

function loadUserPlaylists(username) {
    const file = userPlaylistFile(username);
    const data = readJson(file, { playlists: {} });
    if (!data.playlists || typeof data.playlists !== "object") data.playlists = {};
    return data;
}

function saveUserPlaylists(username, data) {
    const file = userPlaylistFile(username);
    writeJson(file, data);
}

// ---------- Middleware ----------
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "replace_this_with_a_random_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax"
        // secure: true // enable only with https
    }
}));

// Serve uploads (mp3)
app.use("/uploads", express.static(UPLOADS_DIR));

// Serve static site
app.use(express.static(PUBLIC_DIR));

// ---------- AUTH API ----------
app.post("/api/auth/register", (req, res) => {
    const { username, password, firstName, imageUrl } = req.body;

    const u = String(username || "").trim();
    const pw = String(password || "");
    const fn = String(firstName || "").trim();
    const img = String(imageUrl || "").trim();

    if (!u || !pw || !fn || !img) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    try {
        const url = new URL(img);
        if (!(url.protocol === "http:" || url.protocol === "https:")) throw new Error("bad url");
    } catch {
        return res.status(400).json({ error: "Invalid imageUrl" });
    }
    if (!validatePassword(pw)) {
        return res.status(400).json({ error: "Password does not meet requirements" });
    }

    const users = readJson(USERS_FILE, []);
    const exists = users.some(x => normalizeUsername(x.username) === normalizeUsername(u));
    if (exists) return res.status(409).json({ error: "Username already exists" });

    users.push({ username: u, password: pw, firstName: fn, imageUrl: img });
    writeJson(USERS_FILE, users);

    // create empty playlists file
    saveUserPlaylists(u, { playlists: {} });

    res.json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const u = String(username || "").trim();
    const pw = String(password || "");

    if (!u || !pw) return res.status(400).json({ error: "Missing credentials" });

    const users = readJson(USERS_FILE, []);
    const found = users.find(x => normalizeUsername(x.username) === normalizeUsername(u) && x.password === pw);
    if (!found) return res.status(401).json({ error: "Invalid username or password" });

    req.session.user = { username: found.username, firstName: found.firstName, imageUrl: found.imageUrl };
    res.json({ ok: true, user: req.session.user });
});

app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.session.user || null });
});

// ---------- PLAYLISTS API ----------
app.get("/api/playlists", requireAuth, (req, res) => {
    const u = req.session.user.username;
    const data = loadUserPlaylists(u);
    res.json(data);
});

app.post("/api/playlists", requireAuth, (req, res) => {
    // create playlist
    const u = req.session.user.username;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Playlist name required" });

    const data = loadUserPlaylists(u);
    if (data.playlists[name]) return res.status(409).json({ error: "Playlist already exists" });

    data.playlists[name] = [];
    saveUserPlaylists(u, data);
    res.json({ ok: true, name });
});

app.delete("/api/playlists/:name", requireAuth, (req, res) => {
    const u = req.session.user.username;
    const name = req.params.name;

    const data = loadUserPlaylists(u);
    if (!data.playlists[name]) return res.status(404).json({ error: "Playlist not found" });

    delete data.playlists[name];
    saveUserPlaylists(u, data);
    res.json({ ok: true });
});

app.post("/api/playlists/:name/videos", requireAuth, (req, res) => {
    // add a YouTube video object
    const u = req.session.user.username;
    const name = req.params.name;

    const video = req.body?.video;
    if (!video || !video.videoId || !video.title) {
        return res.status(400).json({ error: "Invalid video payload" });
    }

    const data = loadUserPlaylists(u);
    if (!data.playlists[name]) return res.status(404).json({ error: "Playlist not found" });

    // If video exists in ANY playlist -> reject (like requirement)
    const all = Object.values(data.playlists).flat();
    if (all.some(v => v.videoId === video.videoId && v.source !== "mp3")) {
        return res.status(409).json({ error: "Video already exists in favorites" });
    }

    data.playlists[name].push({
        ...video,
        source: "youtube",
        rating: typeof video.rating === "number" ? video.rating : 0
    });

    saveUserPlaylists(u, data);
    res.json({ ok: true });
});

app.patch("/api/playlists/:name/videos/:videoId/rating", requireAuth, (req, res) => {
    const u = req.session.user.username;
    const name = req.params.name;
    const videoId = req.params.videoId;
    const rating = Number(req.body?.rating);

    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
        return res.status(400).json({ error: "Invalid rating" });
    }

    const data = loadUserPlaylists(u);
    const arr = data.playlists[name];
    if (!arr) return res.status(404).json({ error: "Playlist not found" });

    const item = arr.find(v => v.videoId === videoId);
    if (!item) return res.status(404).json({ error: "Video not found" });

    item.rating = rating;
    saveUserPlaylists(u, data);
    res.json({ ok: true });
});

app.delete("/api/playlists/:name/videos/:videoId", requireAuth, (req, res) => {
    const u = req.session.user.username;
    const name = req.params.name;
    const videoId = req.params.videoId;

    const data = loadUserPlaylists(u);
    const arr = data.playlists[name];
    if (!arr) return res.status(404).json({ error: "Playlist not found" });

    data.playlists[name] = arr.filter(v => v.videoId !== videoId);
    saveUserPlaylists(u, data);
    res.json({ ok: true });
});

// ---------- MP3 upload ----------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const u = req.session.user.username;
        const dir = path.join(UPLOADS_DIR, normalizeUsername(u));
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // keep original name but make it safe-ish
        const safe = file.originalname.replace(/[^\w.\- ]+/g, "_");
        cb(null, `${Date.now()}_${safe}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        // allow only mp3
        const ok = file.mimetype === "audio/mpeg" || file.originalname.toLowerCase().endsWith(".mp3");
        cb(ok ? null : new Error("Only MP3 files are allowed"), ok);
    },
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

app.post("/api/upload/mp3", requireAuth, upload.single("file"), (req, res) => {
    const playlistName = String(req.body?.playlistName || "").trim();
    if (!playlistName) return res.status(400).json({ error: "playlistName required" });

    const u = req.session.user.username;
    const data = loadUserPlaylists(u);
    if (!data.playlists[playlistName]) return res.status(404).json({ error: "Playlist not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // add as playlist item
    const item = {
        videoId: `mp3_${file.filename}`, // unique id for deletion/rating
        title: file.originalname,
        thumbnail: "https://via.placeholder.com/480x360?text=MP3",
        source: "mp3",
        mp3Url: `/uploads/${normalizeUsername(u)}/${file.filename}`,
        rating: 0
    };

    data.playlists[playlistName].push(item);
    saveUserPlaylists(u, data);

    res.json({ ok: true, item });
});

// ---------- Fallback to index for unknown routes? (optional) ----------
// app.get("*", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
