// server/server.js
const path = require("path");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const fs = require("fs/promises");

const app = express();
const PORT = 3000;

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PLAYLISTS_DIR = path.join(DATA_DIR, "playlists");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// ---------- Helpers ----------
async function ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    try { await fs.access(USERS_FILE); }
    catch { await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2)); }
}

async function readUsers() {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw);
}

async function writeUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

function playlistsFileFor(username) {
    return path.join(PLAYLISTS_DIR, `${username}.json`);
}

async function readUserPlaylists(username) {
    const file = playlistsFileFor(username);
    try {
        const raw = await fs.readFile(file, "utf-8");
        return JSON.parse(raw);
    } catch {
        // first time -> empty array
        await fs.writeFile(file, JSON.stringify([], null, 2));
        return [];
    }
}

async function writeUserPlaylists(username, playlists) {
    const file = playlistsFileFor(username);
    await fs.writeFile(file, JSON.stringify(playlists, null, 2));
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    next();
}

function makeId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------- Middleware ----------
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "replace_this_with_a_strong_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
    }
}));

// Serve static client
app.use(express.static(PUBLIC_DIR));
// Serve uploaded files (mp3)
app.use("/uploads", express.static(UPLOADS_DIR));

// ---------- Auth API ----------
app.post("/api/auth/register", async (req, res) => {
    const { username, password, firstName, imageUrl } = req.body;

    if (!username || !password || !firstName || !imageUrl) {
        return res.status(400).json({ error: "Missing fields" });
    }

    // Password policy (same as client)
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (password.length < 6 || !hasLetter || !hasNumber || !hasSpecial) {
        return res.status(400).json({ error: "Weak password" });
    }

    const users = await readUsers();
    const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) return res.status(409).json({ error: "Username already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    users.push({
        username,
        passwordHash,
        firstName,
        imageUrl,
        createdAt: new Date().toISOString()
    });

    await writeUsers(users);
    // Create empty playlists file for user
    await readUserPlaylists(username);

    return res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    const users = await readUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    req.session.user = {
        username: user.username,
        firstName: user.firstName,
        imageUrl: user.imageUrl
    };

    return res.json({ ok: true, user: req.session.user });
});

app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

app.get("/api/auth/me", (req, res) => {
    return res.json({ user: req.session.user || null });
});

// ---------- Playlists API ----------
app.get("/api/playlists", requireAuth, async (req, res) => {
    const pls = await readUserPlaylists(req.session.user.username);
    res.json({ playlists: pls });
});

app.post("/api/playlists", requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Missing name" });

    const username = req.session.user.username;
    const pls = await readUserPlaylists(username);

    const pl = { id: makeId("pl"), name, items: [], createdAt: new Date().toISOString() };
    pls.push(pl);

    await writeUserPlaylists(username, pls);
    res.json({ playlist: pl });
});

app.delete("/api/playlists/:id", requireAuth, async (req, res) => {
    const username = req.session.user.username;
    let pls = await readUserPlaylists(username);

    const before = pls.length;
    pls = pls.filter(p => p.id !== req.params.id);

    if (pls.length === before) return res.status(404).json({ error: "Playlist not found" });

    await writeUserPlaylists(username, pls);
    res.json({ ok: true });
});

app.post("/api/playlists/:id/items", requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { item } = req.body; // youtube item object
    if (!item || !item.videoId || !item.title) return res.status(400).json({ error: "Missing item data" });

    const pls = await readUserPlaylists(username);
    const pl = pls.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });

    // prevent duplicates across ALL playlists (same rule)
    const already = pls.some(p => (p.items || []).some(it => it.type !== "mp3" && it.videoId === item.videoId));
    if (already) return res.status(409).json({ error: "Video already exists in some playlist" });

    pl.items = pl.items || [];
    pl.items.push({
        type: "youtube",
        videoId: item.videoId,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl || "",
        duration: item.duration || "—",
        views: item.views || "—",
        rating: 0,
        addedAt: new Date().toISOString()
    });

    await writeUserPlaylists(username, pls);
    res.json({ ok: true });
});

app.delete("/api/playlists/:id/items/:itemId", requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const pls = await readUserPlaylists(username);
    const pl = pls.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });

    const before = (pl.items || []).length;
    pl.items = (pl.items || []).filter(it => it.id !== req.params.itemId);

    if (pl.items.length === before) return res.status(404).json({ error: "Item not found" });

    await writeUserPlaylists(username, pls);
    res.json({ ok: true });
});

app.patch("/api/playlists/:id/items/:itemId", requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const { rating } = req.body;

    const pls = await readUserPlaylists(username);
    const pl = pls.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });

    const it = (pl.items || []).find(x => x.id === req.params.itemId);
    if (!it) return res.status(404).json({ error: "Item not found" });

    it.rating = Number(rating || 0);
    await writeUserPlaylists(username, pls);
    res.json({ ok: true });
});

// ---------- Upload MP3 ----------
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const username = req.session.user.username;
        const dir = path.join(UPLOADS_DIR, username);
        await fs.mkdir(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // keep original name but make it safe-ish
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}_${safe}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ok = file.mimetype === "audio/mpeg" || file.originalname.toLowerCase().endsWith(".mp3");
        cb(ok ? null : new Error("Only MP3 files allowed"), ok);
    },
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

app.post("/api/playlists/:id/upload", requireAuth, upload.single("file"), async (req, res) => {
    const username = req.session.user.username;
    const pls = await readUserPlaylists(username);
    const pl = pls.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });

    const fileUrl = `/uploads/${encodeURIComponent(username)}/${encodeURIComponent(req.file.filename)}`;

    pl.items = pl.items || [];
    pl.items.push({
        id: makeId("item"),
        type: "mp3",
        title: req.body.title || req.file.originalname,
        fileUrl,
        rating: 0,
        addedAt: new Date().toISOString()
    });

    await writeUserPlaylists(username, pls);
    res.json({ ok: true, fileUrl });
});

// ---------- Start ----------
ensureDirs().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
