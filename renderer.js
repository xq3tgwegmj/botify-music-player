// ============================================
// State Management
// ============================================
const state = {
    songs: [],
    playlists: [{ id: 'all', name: 'All Songs', songs: [] }],
    currentPlaylist: 'all',
    currentSongIndex: -1,
    isPlaying: false,
    loopSong: false,
    loopPlaylist: false,
    audio: new Audio(),
    contextMenuSongId: null,
    previousVolume: 100,
    isMuted: false
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Window controls
    minimizeBtn: document.getElementById('minimize-btn'),
    maximizeBtn: document.getElementById('maximize-btn'),
    closeBtn: document.getElementById('close-btn'),

    // File handling
    openFileBtn: document.getElementById('open-file-btn'),

    // Playlists
    playlistList: document.getElementById('playlist-list'),
    newPlaylistBtn: document.getElementById('new-playlist-btn'),
    playlistModal: document.getElementById('playlist-modal'),
    playlistNameInput: document.getElementById('playlist-name-input'),
    cancelPlaylistBtn: document.getElementById('cancel-playlist-btn'),
    confirmPlaylistBtn: document.getElementById('confirm-playlist-btn'),

    // Song list
    songList: document.getElementById('song-list'),

    // Now playing
    albumArt: document.getElementById('album-art'),
    songTitle: document.getElementById('song-title'),
    songArtist: document.getElementById('song-artist'),

    // Progress
    currentTime: document.getElementById('current-time'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    progressThumb: document.getElementById('progress-thumb'),
    duration: document.getElementById('duration'),

    // Controls
    prevBtn: document.getElementById('prev-btn'),
    playBtn: document.getElementById('play-btn'),
    nextBtn: document.getElementById('next-btn'),
    loopSongBtn: document.getElementById('loop-song-btn'),
    loopPlaylistBtn: document.getElementById('loop-playlist-btn'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeBtn: document.getElementById('volume-btn'),
    volumeIcon: document.getElementById('volume-icon'),
    contextMenu: document.getElementById('context-menu'),
    contextMenuList: document.getElementById('context-menu-list')
};

// ============================================
// Window Controls
// ============================================
elements.minimizeBtn.addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
});

elements.maximizeBtn.addEventListener('click', () => {
    window.electronAPI.maximizeWindow();
});

elements.closeBtn.addEventListener('click', () => {
    window.electronAPI.closeWindow();
});

// ============================================
// File Handling
// ============================================
elements.openFileBtn.addEventListener('click', async () => {
    const filePaths = await window.electronAPI.openFileDialog();
    if (filePaths && filePaths.length > 0) {
        filePaths.forEach(filePath => addSong(filePath));
    }
});

function addSong(filePath) {
    const fileName = filePath.split('\\').pop().split('/').pop();
    const songName = fileName.replace(/\.[^/.]+$/, '');

    const song = {
        id: Date.now() + Math.random(),
        name: songName,
        path: filePath,
        duration: 0
    };

    // Get duration
    const tempAudio = new Audio(filePath);
    tempAudio.addEventListener('loadedmetadata', () => {
        song.duration = tempAudio.duration;
        renderSongList();
    });

    state.songs.push(song);
    renderSongList();
    saveLibrary();

    // Auto-play first song
    if (state.songs.length === 1) {
        playSong(0);
    }
}

// ============================================
// Data Persistence
// ============================================
async function saveLibrary() {
    const data = {
        songs: state.songs,
        playlists: state.playlists
    };
    await window.electronAPI.saveLibrary(data);
}

async function loadLibrary() {
    const result = await window.electronAPI.loadLibrary();
    if (result.success && result.data) {
        state.songs = result.data.songs || [];
        state.playlists = result.data.playlists || [{ id: 'all', name: 'All Songs', songs: [] }];
        renderPlaylistList();
        renderSongList();
    }
}

// ============================================
// Playback Controls
// ============================================
function playSong(index) {
    if (index < 0 || index >= getCurrentPlaylistSongs().length) return;

    const songs = getCurrentPlaylistSongs();
    state.currentSongIndex = index;
    const song = songs[index];

    state.audio.src = song.path;
    state.audio.play();
    state.isPlaying = true;

    updateNowPlaying(song);
    updatePlayButton();
    renderSongList();
}

function togglePlay() {
    if (state.currentSongIndex === -1 && state.songs.length > 0) {
        playSong(0);
        return;
    }

    if (state.isPlaying) {
        state.audio.pause();
        state.isPlaying = false;
    } else {
        state.audio.play();
        state.isPlaying = true;
    }

    updatePlayButton();
}

function playNext() {
    const songs = getCurrentPlaylistSongs();
    if (songs.length === 0) return;

    let nextIndex = state.currentSongIndex + 1;

    if (nextIndex >= songs.length) {
        if (state.loopPlaylist) {
            nextIndex = 0;
        } else {
            return;
        }
    }

    playSong(nextIndex);
}

function playPrevious() {
    const songs = getCurrentPlaylistSongs();
    if (songs.length === 0) return;

    // If more than 3 seconds in, restart current song
    if (state.audio.currentTime > 3) {
        state.audio.currentTime = 0;
        return;
    }

    let prevIndex = state.currentSongIndex - 1;

    if (prevIndex < 0) {
        if (state.loopPlaylist) {
            prevIndex = songs.length - 1;
        } else {
            state.audio.currentTime = 0;
            return;
        }
    }

    playSong(prevIndex);
}

function toggleLoopSong() {
    state.loopSong = !state.loopSong;
    state.audio.loop = state.loopSong;
    elements.loopSongBtn.classList.toggle('active', state.loopSong);
}

function toggleLoopPlaylist() {
    state.loopPlaylist = !state.loopPlaylist;
    elements.loopPlaylistBtn.classList.toggle('active', state.loopPlaylist);
}

// Event listeners for controls
elements.playBtn.addEventListener('click', togglePlay);
elements.nextBtn.addEventListener('click', playNext);
elements.prevBtn.addEventListener('click', playPrevious);
elements.loopSongBtn.addEventListener('click', toggleLoopSong);
elements.loopPlaylistBtn.addEventListener('click', toggleLoopPlaylist);

// Volume control
elements.volumeSlider.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    state.audio.volume = volume;
    state.previousVolume = e.target.value;
    state.isMuted = volume === 0;
    updateVolumeIcon();
});

// Mute toggle
elements.volumeBtn.addEventListener('click', () => {
    if (state.isMuted) {
        // Unmute - restore previous volume
        state.audio.volume = state.previousVolume / 100;
        elements.volumeSlider.value = state.previousVolume;
        state.isMuted = false;
    } else {
        // Mute - save current volume and set to 0
        state.previousVolume = elements.volumeSlider.value;
        state.audio.volume = 0;
        elements.volumeSlider.value = 0;
        state.isMuted = true;
    }
    updateVolumeIcon();
});

function updateVolumeIcon() {
    elements.volumeBtn.classList.toggle('muted', state.isMuted);
    // Update icon path based on mute state
    const iconPath = state.isMuted
        ? 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z'
        : 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z';
    elements.volumeIcon.innerHTML = `<path d="${iconPath}" />`;
}

// ============================================
// Audio Events
// ============================================
state.audio.addEventListener('timeupdate', () => {
    updateProgress();
});

state.audio.addEventListener('ended', () => {
    if (!state.loopSong) {
        playNext();
    }
});

state.audio.addEventListener('loadedmetadata', () => {
    elements.duration.textContent = formatTime(state.audio.duration);
});

// Progress bar click to seek
elements.progressBar.addEventListener('click', (e) => {
    const rect = elements.progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    state.audio.currentTime = percent * state.audio.duration;
});

// ============================================
// Playlist Management
// ============================================
elements.newPlaylistBtn.addEventListener('click', () => {
    elements.playlistModal.classList.add('active');
    elements.playlistNameInput.focus();
});

elements.cancelPlaylistBtn.addEventListener('click', () => {
    elements.playlistModal.classList.remove('active');
    elements.playlistNameInput.value = '';
});

elements.confirmPlaylistBtn.addEventListener('click', () => {
    const name = elements.playlistNameInput.value.trim();
    if (name) {
        createPlaylist(name);
        elements.playlistModal.classList.remove('active');
        elements.playlistNameInput.value = '';
    }
});

elements.playlistNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.confirmPlaylistBtn.click();
    }
});

function createPlaylist(name) {
    const playlist = {
        id: 'playlist-' + Date.now(),
        name: name,
        songs: []
    };

    state.playlists.push(playlist);
    renderPlaylistList();
    saveLibrary();
}

function selectPlaylist(playlistId) {
    state.currentPlaylist = playlistId;
    state.currentSongIndex = -1;
    renderPlaylistList();
    renderSongList();
}

function getCurrentPlaylistSongs() {
    if (state.currentPlaylist === 'all') {
        return state.songs;
    }

    const playlist = state.playlists.find(p => p.id === state.currentPlaylist);
    if (!playlist) return [];

    return playlist.songs.map(songId => state.songs.find(s => s.id === songId)).filter(Boolean);
}

// ============================================
// UI Rendering
// ============================================
function renderPlaylistList() {
    elements.playlistList.innerHTML = state.playlists.map(playlist => `
    <li class="playlist-item ${state.currentPlaylist === playlist.id ? 'active' : ''}" 
        data-playlist="${playlist.id}">
      <span class="playlist-icon">${playlist.id === 'all' ? '🎵' : '📁'}</span>
      <span class="playlist-name">${playlist.name}</span>
    </li>
  `).join('');

    // Add click listeners
    elements.playlistList.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            selectPlaylist(item.dataset.playlist);
        });
    });
}

function renderSongList() {
    const songs = getCurrentPlaylistSongs();

    if (songs.length === 0) {
        elements.songList.innerHTML = '<li class="empty-state">No songs added yet</li>';
        return;
    }

    elements.songList.innerHTML = songs.map((song, index) => `
    <li class="song-item ${index === state.currentSongIndex ? 'playing' : ''}" 
        data-index="${index}">
      <div class="song-item-icon">🎵</div>
      <div class="song-item-info">
        <div class="song-item-title">${song.name}</div>
        <div class="song-item-duration">${song.duration ? formatTime(song.duration) : '--:--'}</div>
      </div>
    </li>
  `).join('');

    // Add click listeners
    elements.songList.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('click', () => {
            playSong(parseInt(item.dataset.index));
        });

        // Right-click to add to playlist
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const songs = getCurrentPlaylistSongs();
            const song = songs[parseInt(item.dataset.index)];
            showContextMenu(e.clientX, e.clientY, song.id);
        });
    });
}

// ============================================
// Context Menu
// ============================================
function showContextMenu(x, y, songId) {
    state.contextMenuSongId = songId;

    let menuHTML = '';

    // If we're in a custom playlist, show "Remove from playlist" option
    if (state.currentPlaylist !== 'all') {
        menuHTML = `
            <li class="context-menu-item remove-item" data-action="remove">
                <span class="icon">🗑️</span>
                <span>Remove from Playlist</span>
            </li>
            <li class="context-menu-divider"></li>
        `;
    }

    // Render playlist options (exclude 'All Songs')
    const playlists = state.playlists.filter(p => p.id !== 'all');

    if (playlists.length === 0) {
        menuHTML += '<li class="context-menu-item" style="color: var(--text-muted); cursor: default;">No playlists created</li>';
    } else {
        menuHTML += playlists.map(playlist => `
            <li class="context-menu-item" data-playlist-id="${playlist.id}">
                <span class="icon">📁</span>
                <span>${playlist.name}</span>
            </li>
        `).join('');
    }

    elements.contextMenuList.innerHTML = menuHTML;

    // Add click listeners for remove
    const removeItem = elements.contextMenuList.querySelector('.remove-item');
    if (removeItem) {
        removeItem.addEventListener('click', () => {
            removeSongFromPlaylist(state.contextMenuSongId, state.currentPlaylist);
            hideContextMenu();
        });
    }

    // Add click listeners for add to playlist
    elements.contextMenuList.querySelectorAll('.context-menu-item[data-playlist-id]').forEach(item => {
        item.addEventListener('click', () => {
            const playlistId = item.dataset.playlistId;
            if (playlistId) {
                addSongToPlaylist(state.contextMenuSongId, playlistId);
            }
            hideContextMenu();
        });
    });

    // Position and show menu
    elements.contextMenu.style.left = `${x}px`;
    elements.contextMenu.style.top = `${y}px`;
    elements.contextMenu.classList.add('active');
}

function hideContextMenu() {
    elements.contextMenu.classList.remove('active');
    state.contextMenuSongId = null;
}

function addSongToPlaylist(songId, playlistId) {
    const playlist = state.playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    // Check if song already in playlist
    if (playlist.songs.includes(songId)) {
        return; // Already in playlist
    }

    playlist.songs.push(songId);
    renderSongList();
    saveLibrary();
}

function removeSongFromPlaylist(songId, playlistId) {
    const playlist = state.playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const index = playlist.songs.indexOf(songId);
    if (index > -1) {
        playlist.songs.splice(index, 1);
        renderSongList();
        saveLibrary();
    }
}

// Hide context menu when clicking elsewhere
document.addEventListener('click', (e) => {
    if (!elements.contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

function updateNowPlaying(song) {
    elements.songTitle.textContent = song.name;
    elements.songArtist.textContent = 'Unknown Artist';
}

function updatePlayButton() {
    const playIcon = elements.playBtn.querySelector('.play-icon');
    const pauseIcon = elements.playBtn.querySelector('.pause-icon');

    if (state.isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

function updateProgress() {
    const percent = (state.audio.currentTime / state.audio.duration) * 100 || 0;
    elements.progressFill.style.width = `${percent}%`;
    elements.progressThumb.style.left = `${percent}%`;
    elements.currentTime.textContent = formatTime(state.audio.currentTime);
}

// ============================================
// Utility Functions
// ============================================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// Keyboard Shortcuts
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            togglePlay();
            break;
        case 'ArrowRight':
            playNext();
            break;
        case 'ArrowLeft':
            playPrevious();
            break;
    }
});

// ============================================
// Initialize
// ============================================
async function init() {
    await loadLibrary();
    renderPlaylistList();
    renderSongList();
}

init();
