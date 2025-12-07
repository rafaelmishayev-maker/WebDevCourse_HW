// --- Get HTML DOM Element References ---
const form = document.getElementById('songForm');
const list = document.getElementById('songList');
const submitBtn = document.getElementById('submitBtn');
const searchInput = document.getElementById('search');

const tableView = document.getElementById('tableView');
const cardsView = document.getElementById('cardsView');
const viewToggleBtn = document.getElementById('viewToggleBtn');
const viewToggleIcon = document.getElementById('viewToggleIcon');

// Global songs array (will be loaded from localStorage)
let songs = [];

// Current sort option: 'date' | 'name' | 'rating'
let currentSort = 'date';

// Current view: 'table' | 'cards'
let currentView = 'table';


// --- Helper: extract YouTube video ID from URL ---
function extractYouTubeId(url) {
    try {
        const u = new URL(url);

        // Short link: https://youtu.be/VIDEO_ID
        if (u.hostname.includes('youtu.be')) {
            return u.pathname.slice(1);
        }

        // Standard link: https://www.youtube.com/watch?v=VIDEO_ID
        if (u.hostname.includes('youtube.com')) {
            return u.searchParams.get('v');
        }
    } catch (err) {
        // Fallback: simple regex if URL() failed
        const match = url.match(/(?:v=|be\/)([a-zA-Z0-9_-]{11})/);
        if (match) {
            return match[1];
        }
    }

    return null; // could not extract ID
}


// --- Get a sorted copy of songs array based on currentSort ---
function getSortedSongs(baseArray) {
    const arr = [...baseArray]; // copy so we don't mutate the original

    if (currentSort === 'name') {
        arr.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
    } else if (currentSort === 'rating') {
        arr.sort((a, b) => {
            const rA = a.rating ?? 0;
            const rB = b.rating ?? 0;
            return rB - rA; // highest rating first
        });
    } else {
        // default: sort by dateAdded (newest first)
        arr.sort((a, b) => {
            const dA = a.dateAdded ?? 0;
            const dB = b.dateAdded ?? 0;
            return dB - dA;
        });
    }

    return arr;
}


// --- Toggle between table view and cards view ---
viewToggleBtn.addEventListener('click', () => {
    if (currentView === 'table') {
        currentView = 'cards';
        tableView.classList.add('d-none');
        cardsView.classList.remove('d-none');

        // Change icon (image) to "cards"
        viewToggleIcon.classList.remove('fa-table');
        viewToggleIcon.classList.add('fa-th-large');
        viewToggleBtn.title = 'Switch to table view';
    } else {
        currentView = 'table';
        cardsView.classList.add('d-none');
        tableView.classList.remove('d-none');

        // Change icon (image) back to "table"
        viewToggleIcon.classList.remove('fa-th-large');
        viewToggleIcon.classList.add('fa-table');
        viewToggleBtn.title = 'Switch to cards view';
    }
});


// --- Load songs from localStorage when page loads ---
document.addEventListener('DOMContentLoaded', () => {
    const storedData = localStorage.getItem('songs');

    if (storedData) {
        // If data exists in localStorage, convert JSON string back to array
        songs = JSON.parse(storedData);
    } else {
        // If no data, start with an empty array
        songs = [];
    }

    // Attach listeners for sort radio buttons
    document.querySelectorAll('input[name="sortOption"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderSongs();
        });
    });

    // (Optional: search handler can be added later)

    // Render songs to the table and cards
    renderSongs();
});


// --- Handle Add / Update submit ---
form.addEventListener('submit', (e) => {
    // Prevent form from submitting to the server
    e.preventDefault();

    const titleInput = document.getElementById('title');
    const urlInput = document.getElementById('url');
    const ratingInput = document.getElementById('rating');
    const hiddenIdInput = document.getElementById('songId');

    const title = titleInput.value.trim();
    const url = urlInput.value.trim();
    const rating = ratingInput.value.trim();
    const id = hiddenIdInput.value; // hidden field contains id when editing

    if (!title || !url || !rating) {
        return;
    }

    // Try to extract YouTube video ID (for thumbnail and player)
    const videoId = extractYouTubeId(url);

    // ----- UPDATE MODE -----
    if (id) {
        const index = songs.findIndex(song => song.id === Number(id));

        if (index !== -1) {
            songs[index].title = title;
            songs[index].url = url;
            songs[index].rating = Number(rating);
            songs[index].videoId = videoId || null;
        }

        // Return button to ADD mode
        hiddenIdInput.value = '';
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        submitBtn.classList.remove('btn-warning');
        submitBtn.classList.add('btn-success');
    }

    // ----- ADD MODE -----
    else {
        const newSong = {
            id: Date.now(),        // unique ID
            title: title,
            url: url,
            rating: Number(rating),
            videoId: videoId || null,
            dateAdded: Date.now()  // used for sorting by date
        };

        songs.push(newSong);
    }

    // Save to localStorage and re-render table/cards
    saveAndRender();

    // Clear form fields
    form.reset();
});


// --- Save to localStorage and render UI table/cards ---
function saveAndRender() {
    localStorage.setItem('songs', JSON.stringify(songs));
    renderSongs();
}


// --- Display songs from array as table rows AND cards (with sorting) ---
function renderSongs() {
    // Clear current table body and cards container
    list.innerHTML = '';
    cardsView.innerHTML = '';

    // 1) sort according to currentSort
    const sortedSongs = getSortedSongs(songs);

    // 2) render after sorting
    sortedSongs.forEach(song => {
        // If videoId not stored (old records), try to derive it from URL
        let videoId = song.videoId;
        if (!videoId && song.url) {
            videoId = extractYouTubeId(song.url);
            song.videoId = videoId || null; // update in memory (will be saved next time)
        }

        const thumbnailUrl = videoId
            ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
            : '';

        // -------- TABLE ROW --------
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                ${thumbnailUrl
                ? `<img src="${thumbnailUrl}" alt="${song.title}" class="img-thumbnail" style="max-width: 120px;">`
                : ''
            }
            </td>
            <td>${song.title}</td>
            <td>${song.rating ?? ''}</td>
            <td><a href="${song.url}" target="_blank" class="text-info">Watch</a></td>
            <td class="text-end">
                <button class="btn btn-sm btn-info me-2" onclick="playSong(${song.id})">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn btn-sm btn-warning me-2" onclick="editSong(${song.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteSong(${song.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        list.appendChild(row);

        // -------- CARD VIEW --------
        const col = document.createElement('div');
        col.className = 'col-md-4';

        col.innerHTML = `
            <div class="card h-100 bg-secondary text-light">
                ${thumbnailUrl
                ? `<img src="${thumbnailUrl}" class="card-img-top" alt="${song.title}">`
                : ''
            }
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${song.title}</h5>
                    <p class="card-text mb-2">
                        Rating:
                        <span class="badge bg-info text-dark">
                            ${song.rating ?? 'N/A'}
                        </span>
                    </p>
                    <a href="${song.url}" target="_blank" class="text-info mb-2">
                        Open on YouTube
                    </a>
                    <div class="mt-auto d-flex justify-content-between">
                        <button class="btn btn-sm btn-info" onclick="playSong(${song.id})">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="editSong(${song.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSong(${song.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        cardsView.appendChild(col);
    });
}


// --- Delete song by id ---
function deleteSong(id) {
    if (!confirm('Are you sure?')) {
        return;
    }

    // Keep all songs except the one with the given id
    songs = songs.filter(song => song.id !== id);

    saveAndRender();
}


// --- Load selected song into form for editing ---
function editSong(id) {
    const songToEdit = songs.find(song => song.id === id);
    if (!songToEdit) return;

    document.getElementById('title').value = songToEdit.title;
    document.getElementById('url').value = songToEdit.url;
    document.getElementById('rating').value = songToEdit.rating ?? '';
    document.getElementById('songId').value = songToEdit.id; // set hidden ID

    // Change button to "Update" mode
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update';
    submitBtn.classList.remove('btn-success');
    submitBtn.classList.add('btn-warning');
}


// --- Play song in popup modal ---
function playSong(id) {
    const song = songs.find(s => s.id === id);
    if (!song) return;

    let videoId = song.videoId;
    if (!videoId && song.url) {
        videoId = extractYouTubeId(song.url);
        song.videoId = videoId || null;
    }

    if (!videoId) {
        alert('Cannot play this song. Invalid YouTube URL.');
        return;
    }

    const playerFrame = document.getElementById('playerFrame');
    const modalElement = document.getElementById('playerModal');

    // Set video src with autoplay
    playerFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    document.getElementById('playerModalLabel').textContent = song.title || 'Now Playing';

    // Show modal using Bootstrap
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    // When modal is closed – stop the video (clear src)
    modalElement.addEventListener('hidden.bs.modal', () => {
        playerFrame.src = '';
    }, { once: true });
}
