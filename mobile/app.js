// ============================================
// Botify Mobile PWA - Music Player
// ============================================

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker registration failed:', err));
}

// ============================================
// State Management
// ============================================
const state = {
    songs: [],
    currentSongIndex: -1,
    isPlaying: false,
    isLooping: false,
    isShuffling: false,
    audio: new Audio(),
    shuffleOrder: []
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    // File input
    fileInput: document.getElementById('file-input'),
    addSongsBtn: document.getElementById('add-songs-btn'),
    addSongsEmptyBtn: document.getElementById('add-songs-empty-btn'),

    // Song list
    songList: document.getElementById('song-list'),
    songCount: document.getElementById('song-count'),
    emptyState: document.getElementById('empty-state'),

    // Mini player (now playing bar)
    nowPlayingBar: document.getElementById('now-playing-bar'),
    miniTitle: document.getElementById('mini-title'),
    miniArtist: document.getElementById('mini-artist'),
    miniArt: document.getElementById('mini-art'),
    miniPlay: document.getElementById('mini-play'),
    miniPrev: document.getElementById('mini-prev'),
    miniNext: document.getElementById('mini-next'),

    // Full player
    fullPlayer: document.getElementById('full-player'),
    collapseBtn: document.getElementById('collapse-btn'),
    albumArt: document.getElementById('album-art'),
    songTitle: document.getElementById('song-title'),
    songArtist: document.getElementById('song-artist'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    currentTime: document.getElementById('current-time'),
    duration: document.getElementById('duration'),
    playBtn: document.getElementById('play-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    loopBtn: document.getElementById('loop-btn'),
    shuffleBtn: document.getElementById('shuffle-btn')
};

// ============================================
// File Handling
// ============================================
function openFilePicker() {
    elements.fileInput.click();
}

elements.addSongsBtn.addEventListener('click', openFilePicker);
elements.addSongsEmptyBtn.addEventListener('click', openFilePicker);

elements.fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => addSong(file));
    e.target.value = ''; // Reset input
});

function addSong(file) {
    const song = {
        id: Date.now() + Math.random(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        file: file,
        objectUrl: URL.createObjectURL(file),
        duration: 0
    };

    // Get duration
    const tempAudio = new Audio(song.objectUrl);
    tempAudio.addEventListener('loadedmetadata', () => {
        song.duration = tempAudio.duration;
        renderSongList();
    });

    state.songs.push(song);
    renderSongList();

    // Auto-play first song
    if (state.songs.length === 1) {
        playSong(0);
    }
}

// ============================================
// Playback Controls
// ============================================
function playSong(index) {
    if (index < 0 || index >= state.songs.length) return;

    state.currentSongIndex = index;
    const song = state.songs[index];

    state.audio.src = song.objectUrl;
    state.audio.play();
    state.isPlaying = true;

    updateNowPlaying(song);
    updatePlayButton();
    renderSongList();
    updateMediaSession(song);
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
    updateMediaSessionPlaybackState();
}

function playNext() {
    if (state.songs.length === 0) return;

    let nextIndex;

    if (state.isShuffling) {
        // Get random song (not current)
        do {
            nextIndex = Math.floor(Math.random() * state.songs.length);
        } while (nextIndex === state.currentSongIndex && state.songs.length > 1);
    } else {
        nextIndex = state.currentSongIndex + 1;
        if (nextIndex >= state.songs.length) {
            if (state.isLooping) {
                nextIndex = 0;
            } else {
                return;
            }
        }
    }

    playSong(nextIndex);
}

function playPrevious() {
    if (state.songs.length === 0) return;

    // If more than 3 seconds in, restart current song
    if (state.audio.currentTime > 3) {
        state.audio.currentTime = 0;
        return;
    }

    let prevIndex = state.currentSongIndex - 1;

    if (prevIndex < 0) {
        if (state.isLooping) {
            prevIndex = state.songs.length - 1;
        } else {
            state.audio.currentTime = 0;
            return;
        }
    }

    playSong(prevIndex);
}

function toggleLoop() {
    state.isLooping = !state.isLooping;
    elements.loopBtn.classList.toggle('active', state.isLooping);
}

function toggleShuffle() {
    state.isShuffling = !state.isShuffling;
    elements.shuffleBtn.classList.toggle('active', state.isShuffling);
}

function seekTo(percent) {
    if (state.audio.duration) {
        state.audio.currentTime = percent * state.audio.duration;
    }
}

// Event listeners for controls
elements.playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
});
elements.miniPlay.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
});
elements.nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playNext();
});
elements.miniNext.addEventListener('click', (e) => {
    e.stopPropagation();
    playNext();
});
elements.prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playPrevious();
});
elements.miniPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    playPrevious();
});
elements.loopBtn.addEventListener('click', toggleLoop);
elements.shuffleBtn.addEventListener('click', toggleShuffle);

// Progress bar interaction
elements.progressBar.addEventListener('click', (e) => {
    const rect = elements.progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent);
});

// Touch support for progress bar
let isDragging = false;

elements.progressBar.addEventListener('touchstart', (e) => {
    isDragging = true;
    handleProgressTouch(e);
});

elements.progressBar.addEventListener('touchmove', (e) => {
    if (isDragging) {
        handleProgressTouch(e);
    }
});

elements.progressBar.addEventListener('touchend', () => {
    isDragging = false;
});

function handleProgressTouch(e) {
    const touch = e.touches[0];
    const rect = elements.progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    seekTo(percent);
}

// ============================================
// Audio Events
// ============================================
state.audio.addEventListener('timeupdate', () => {
    updateProgress();
});

state.audio.addEventListener('ended', () => {
    if (state.isLooping && state.songs.length === 1) {
        // Loop single song
        state.audio.currentTime = 0;
        state.audio.play();
    } else {
        playNext();
    }
});

state.audio.addEventListener('loadedmetadata', () => {
    elements.duration.textContent = formatTime(state.audio.duration);
});

state.audio.addEventListener('play', () => {
    state.isPlaying = true;
    updatePlayButton();
    updateMediaSessionPlaybackState();
});

state.audio.addEventListener('pause', () => {
    state.isPlaying = false;
    updatePlayButton();
    updateMediaSessionPlaybackState();
});

// ============================================
// UI Updates
// ============================================
function renderSongList() {
    if (state.songs.length === 0) {
        elements.songList.innerHTML = '';
        elements.songList.appendChild(elements.emptyState);
        elements.emptyState.style.display = 'flex';
        elements.songCount.textContent = '0 songs';
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.songCount.textContent = `${state.songs.length} song${state.songs.length !== 1 ? 's' : ''}`;

    elements.songList.innerHTML = state.songs.map((song, index) => `
        <li class="song-item ${index === state.currentSongIndex ? 'playing' : ''}" data-index="${index}">
            <div class="song-item-icon">🎵</div>
            <div class="song-item-info">
                <div class="song-item-title">${escapeHtml(song.name)}</div>
                <div class="song-item-duration">${song.duration ? formatTime(song.duration) : '--:--'}</div>
            </div>
        </li>
    `).join('');

    // Add click listeners
    elements.songList.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('click', () => {
            playSong(parseInt(item.dataset.index));
        });
    });
}

function updateNowPlaying(song) {
    // Mini player
    elements.miniTitle.textContent = song.name;
    elements.miniArtist.textContent = 'Unknown Artist';

    // Full player
    elements.songTitle.textContent = song.name;
    elements.songArtist.textContent = 'Unknown Artist';
}

function updatePlayButton() {
    const playIcons = document.querySelectorAll('.play-icon');
    const pauseIcons = document.querySelectorAll('.pause-icon');

    if (state.isPlaying) {
        playIcons.forEach(icon => icon.style.display = 'none');
        pauseIcons.forEach(icon => icon.style.display = 'block');
    } else {
        playIcons.forEach(icon => icon.style.display = 'block');
        pauseIcons.forEach(icon => icon.style.display = 'none');
    }
}

function updateProgress() {
    const percent = (state.audio.currentTime / state.audio.duration) * 100 || 0;
    elements.progressFill.style.width = `${percent}%`;
    elements.currentTime.textContent = formatTime(state.audio.currentTime);
}

// ============================================
// Full Player Toggle
// ============================================
function openFullPlayer() {
    elements.fullPlayer.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFullPlayer() {
    elements.fullPlayer.classList.remove('active');
    document.body.style.overflow = '';
}

// Click on now playing bar to open full player
elements.nowPlayingBar.addEventListener('click', (e) => {
    // Don't open if clicking controls
    if (e.target.closest('.now-playing-controls')) return;
    openFullPlayer();
});

elements.collapseBtn.addEventListener('click', closeFullPlayer);

// Swipe down to close full player
let touchStartY = 0;
let touchCurrentY = 0;

elements.fullPlayer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

elements.fullPlayer.addEventListener('touchmove', (e) => {
    touchCurrentY = e.touches[0].clientY;
    const diff = touchCurrentY - touchStartY;

    if (diff > 0) {
        elements.fullPlayer.style.transform = `translateY(calc(-100% + ${diff}px))`;
    }
}, { passive: true });

elements.fullPlayer.addEventListener('touchend', () => {
    const diff = touchCurrentY - touchStartY;

    if (diff > 100) {
        closeFullPlayer();
    }

    elements.fullPlayer.style.transform = '';
    touchStartY = 0;
    touchCurrentY = 0;
});

// ============================================
// Media Session API (Lock Screen Controls)
// ============================================
function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.name,
            artist: 'Unknown Artist',
            album: 'Botify',
            artwork: [
                { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
                { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
            ]
        });

        // Action handlers
        navigator.mediaSession.setActionHandler('play', () => {
            state.audio.play();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            state.audio.pause();
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            playPrevious();
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            playNext();
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) {
                state.audio.currentTime = details.seekTime;
            }
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            const skipTime = details.seekOffset || 10;
            state.audio.currentTime = Math.max(state.audio.currentTime - skipTime, 0);
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            const skipTime = details.seekOffset || 10;
            state.audio.currentTime = Math.min(state.audio.currentTime + skipTime, state.audio.duration);
        });
    }
}

function updateMediaSessionPlaybackState() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
    }
}

// Update position state periodically for lock screen progress
setInterval(() => {
    if ('mediaSession' in navigator && state.isPlaying && state.audio.duration) {
        navigator.mediaSession.setPositionState({
            duration: state.audio.duration,
            playbackRate: state.audio.playbackRate,
            position: state.audio.currentTime
        });
    }
}, 1000);

// ============================================
// Utility Functions
// ============================================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Initialize
// ============================================
function init() {
    renderSongList();
    console.log('Botify Mobile initialized');
}

init();
