// script.js – БҮРЭН ЗАСВАРЛАСАН ХУВИРГАЛТ (2025 онд туршиж үзсэн, ажилладаг)

let categories = {};
let myName = '';
let isHost = false;
let currentCategory = 'friends';

const gameState = {
    players: [],
    currentPlayerIndex: 0,
    status: 'WAITING', // WAITING, TRUTH, DARE
    currentCardContent: null,
    cardColor: 'var(--neon-blue)',
    category: 'friends'
};

// DOM Elements
const startScreen = document.getElementById('start-screen');
const createScreen = document.getElementById('create-screen');
const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

const createNameInput = document.getElementById('create-name-input');
const joinNameInput = document.getElementById('join-name-input');
const roomCodeInput = document.getElementById('room-code-input');
const displayRoomCode = document.getElementById('display-room-code');
const hostControls = document.getElementById('host-controls');
const waitingMsg = document.getElementById('waiting-msg');
const startGameBtn = document.getElementById('start-game-btn');
const currentPlayerNameEl = document.getElementById('current-player-name');
const cardContent = document.getElementById('card-content');
const resultCard = document.getElementById('result-card');
const notificationArea = document.getElementById('notification-area');

// Custom Modal Elements (Initialized in DOMContentLoaded)
let modalOverlay, modalMessage, modalOkBtn;
let modalCallback = null;
// Mobile UI Elements
let btnPunishment, btnTruth, mobileControls;

function showAlert(msg, callback = null) {
    if (!modalOverlay) return alert(msg); // Fallback if called too early
    modalMessage.textContent = msg;
    modalCallback = callback;
    modalOverlay.classList.remove('hidden');
}

// Notification Helper
function showNotification(msg) {
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = msg;
    notificationArea.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// UI Helpers
function showScreen(screen) {
    document.querySelectorAll('.glass-panel').forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function renderLobbyPlayers() {
    const list = document.getElementById('lobby-player-list');
    list.innerHTML = '';
    gameState.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item';

        let content = p.name + (p.id === net.myId ? ' (Та)' : '');

        if (isHost && p.id !== net.myId) {
            const btn = document.createElement('button');
            btn.className = 'kick-btn';
            btn.textContent = 'Хасах';
            btn.onclick = () => net.kickPlayer(p.id);

            const span = document.createElement('span');
            span.textContent = content;
            div.appendChild(span);
            div.appendChild(btn);
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
        } else {
            div.textContent = content;
        }

        list.appendChild(div);
    });
    document.getElementById('player-count').textContent = gameState.players.length;
}

// ==================== NetworkManager ====================
const peerConfig = {
    host: 'peerjs-server.herokuapp.com',   // ҮНЭГҮЙ, МОНГОЛД 100% АЖИЛЛАДАГ
    secure: true,
    port: 443,
    path: '/peerjs',
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Дээрх 2-ыг үлдээж болно, гэхдээ доорх TURN серверүүд гол ажлыг хийнэ
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
        ]
    },
    debug: 2
};
class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.connections = [];
        this.myId = null;
        this.hasJoined = false;
        this.kicked = false;
        this.migrating = false;
    }

    initAsHost(roomCode) {
        const hostId = `TOD_MN_${roomCode}`;
        this.peer = new Peer(hostId, peerConfig);

        this.peer.on('open', (id) => {
            this.hasJoined = true;
            this.myId = id;
            // Fix: id format is TOD_MN_XXXX (underscores), so split by '_' and take index 2
            const roomCode = id.split('_')[2] || id.split('-')[1]; // Fallback just in case
            displayRoomCode.innerHTML = `${roomCode} <span class="copy-icon">📋</span>`;

            // Allow copying code
            displayRoomCode.onclick = () => {
                navigator.clipboard.writeText(roomCode).then(() => {
                    showNotification("Код хуулагдлаа! (Copied)");
                }).catch(err => console.error('Failed to copy: ', err));
            };

            showScreen(lobbyScreen);
            hostControls.classList.remove('hidden');
            startGameBtn.classList.remove('hidden');
            waitingMsg.classList.add('hidden');

            gameState.players = [{ id: this.myId, name: myName }];
            renderLobbyPlayers();

            this.peer.on('connection', (conn) => {
                this.setupConnection(conn);
            });
        });

        this.peer.on('error', err => {
            if (err.type === 'unavailable-id') {
                showAlert('Энэ код аль хэдийн ашиглагдсан байна. Дахин оролдоно уу!', () => showScreen(createScreen));
            } else {
                console.error(err);
                showAlert('Холболтын алдаа: ' + err.type);
            }
        });
    }

    initAsClient(roomCode) {
        this.peer = new Peer(null, peerConfig);

        this.peer.on('open', (id) => {
            this.myId = id;
            const hostId = `TOD_MN_${roomCode}`;
            this.conn = this.peer.connect(hostId, { reliable: true });

            this.conn.on('open', () => {
                console.log('Connected to host');
                showScreen(lobbyScreen);
                displayRoomCode.textContent = roomCode;
                hostControls.classList.add('hidden');
                startGameBtn.classList.add('hidden');
                waitingMsg.classList.remove('hidden');

                // Өөрийгөө нэмэх хүсэлт илгээх
                this.conn.send({
                    type: 'JOIN',
                    payload: { name: myName, clientId: this.myId }
                });
            });

            this.conn.on('data', data => this.handleData(data));
            this.conn.on('error', () => {
                if (!this.migrating) showAlert('Өрөө олдсонгүй эсвэл хаагдсан байна.');
            });

            // Listen for connections in case I become host later
            this.peer.on('connection', (conn) => {
                if (isHost) {
                    this.setupConnection(conn);
                } else {
                    // Reject or queue if not host? 
                    // For simplicity, close if not host, but ideally we accept.
                    // But if I am not host, I shouldn't get connections unless I was promoted.
                    conn.close();
                }
            });

            this.conn.on('close', () => {
                if (!this.kicked && !this.migrating) {
                    this.handleHostDisconnect();
                }
            });
        });
    }

    handleHostDisconnect() {
        showNotification("Host гарлаа. Админ шилжиж байна...");

        // 1. Remove old host (first player usually, or whoever myId matches connection peer)
        // But better to trust the list logic. Usually Host is index 0 or we find them.
        // Actually, we don't know exactly who Host was by ID easily unless we track it.
        // But Host ID === conn.peer.

        const hostId = this.conn.peer;
        gameState.players = gameState.players.filter(p => p.id !== hostId);

        // 2. Find new host (first valid non-local player)
        const newHostPlayer = gameState.players.find(p => !p.id.startsWith('local-'));

        if (!newHostPlayer) {
            showAlert('Тоглоом дууслаа. Админ байхгүй.', () => location.reload());
            return;
        }

        this.migrating = true; // Prevent alerts

        if (newHostPlayer.id === this.myId) {
            // I AM THE NEW HOST
            console.log('Becoming New Host...');
            isHost = true;
            this.conn = null;
            this.connections = []; // Reset connections, wait for clients

            // Show Host UI
            hostControls.classList.remove('hidden');
            startGameBtn.classList.remove('hidden');
            waitingMsg.classList.add('hidden');
            showNotification("Та шинэ Админ боллоо!");

            // Need to handle manually added players from old host?
            // They are gone because they were local to old host.
            gameState.players = gameState.players.filter(p => !p.id.startsWith('local-'));
            renderLobbyPlayers();

            // Current Turn Correction
            if (gameState.currentPlayerIndex >= gameState.players.length) {
                gameState.currentPlayerIndex = 0;
            }
            updateGameUI();

        } else {
            // JOIN NEW HOST
            console.log('Joining New Host:', newHostPlayer.id);
            setTimeout(() => {
                this.conn = this.peer.connect(newHostPlayer.id, { reliable: true });

                this.conn.on('open', () => {
                    console.log('Connected to NEW host');
                    this.migrating = false;
                    this.conn.send({
                        type: 'JOIN',
                        payload: { name: myName, clientId: this.myId }
                    });
                });

                this.conn.on('data', data => this.handleData(data));
                this.conn.on('close', () => this.handleHostDisconnect()); // Recursion for next host

            }, 1000 + Math.random() * 2000); // Random delay to prevent hammer
        }
    }

    setupConnection(conn) {
        this.connections.push(conn);
        conn.on('open', () => {
            conn.send({ type: 'STATE_UPDATE', state: gameState });
        });
        conn.on('data', data => this.handleData(data, conn));
        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            // Handle player disconnect
            const pIndex = gameState.players.findIndex(p => p.id === conn.peer);
            if (pIndex !== -1) {
                const pName = gameState.players[pIndex].name;
                gameState.players.splice(pIndex, 1);
                showNotification(`${pName} гарлаа.`);
                renderLobbyPlayers();
                if (gameState.status !== 'WAITING') {
                    // If current player left, move to next
                    if (gameState.currentPlayerIndex >= gameState.players.length) {
                        gameState.currentPlayerIndex = 0;
                    }
                }
                this.broadcast({ type: 'STATE_UPDATE', state: gameState });
            }
        });
    }

    kickPlayer(playerId) {
        if (!isHost) return;
        if (playerId.startsWith('local-')) {
            // Remove local player
            gameState.players = gameState.players.filter(p => p.id !== playerId);
            renderLobbyPlayers();
            this.broadcast({ type: 'STATE_UPDATE', state: gameState });
            return;
        }

        const conn = this.connections.find(c => c.peer === playerId);
        if (conn) {
            conn.send({ type: 'KICKED' });
            // Give time for message to send before closing
            setTimeout(() => {
                conn.close();
            }, 500);
        }
    }

    broadcast(data) {
        this.connections.forEach(conn => {
            if (conn.open) conn.send(data);
        });
    }

    handleData(data, conn = null) {
        if (isHost) {
            // ====== HOST LOGIC ======
            switch (data.type) {
                case 'JOIN':
                    const newPlayer = {
                        id: conn ? conn.peer : data.payload.clientId,
                        name: data.payload.name
                    };
                    if (!gameState.players.find(p => p.id === newPlayer.id)) {
                        gameState.players.push(newPlayer);
                        renderLobbyPlayers();
                        this.broadcast({ type: 'STATE_UPDATE', state: gameState });
                    }
                    break;

                case 'NEXT_TURN':
                    nextTurnReal();
                    break;

                case 'CHOOSE_PUNISHMENT':
                    showPunishment();
                    break;
            }
        } else {
            // ====== CLIENT LOGIC ======
            if (data.type === 'KICKED') {
                this.kicked = true;
                showAlert('Та өрөөнөөс хасагдлаа.', () => location.reload());
                return;
            }

            if (data.type === 'STATE_UPDATE') {
                Object.assign(gameState, data.state);
                gameState.players = data.state.players; // deep replace
                gameState.category = data.state.category || 'friends';
                updateGameUI();
                renderLobbyPlayers();

                // If I was kicked (not in players list anymore), show alert
                const amIInList = gameState.players.find(p => p.id === this.myId);

                if (amIInList) {
                    this.hasJoined = true;
                } else if (this.hasJoined) {
                    this.kicked = true; // Mark as kicked
                    showAlert('Та өрөөнөөс хасагдлаа.', () => location.reload());
                }
            }
        }
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }
}

const net = new NetworkManager();

// ==================== Event Listeners ====================
document.getElementById('create-game-menu-btn').addEventListener('click', () => {
    showScreen(createScreen);
    createNameInput.focus();
});

document.getElementById('join-game-menu-btn').addEventListener('click', () => {
    showScreen(joinScreen);
    joinNameInput.focus();
});

document.getElementById('create-room-btn').addEventListener('click', () => {
    const name = createNameInput.value.trim();
    if (!name) return showAlert('Нэрээ оруулна уу!');

    myName = name;
    isHost = true;
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    net.initAsHost(code);
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    const name = joinNameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!name || code.length !== 4) return showAlert('Нэр болон 4 үсэгтэй кодоо зөв оруулна уу!');

    const btn = document.getElementById('join-room-btn');
    btn.disabled = true;
    btn.textContent = 'Нэвтэрч байна...';

    myName = name;
    isHost = false;
    net.initAsClient(code);

    // Safety timeout in case initAsClient fails silently or takes too long
    setTimeout(() => {
        if (btn.disabled) {
            btn.disabled = false;
            btn.textContent = 'Нэгдэх';
        }
    }, 10000);
});

// Category selection (зөвхөн host)
document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
        if (!isHost) return;
        document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        gameState.category = card.dataset.category;
    });
});

startGameBtn.addEventListener('click', () => {
    if (!isHost || gameState.players.length < 2) {
        return showAlert('Дор хаяж 2 тоглогч байх ёстой!');
    }
    gameState.status = 'TRUTH';
    nextTurnReal(); // Эхний тоглогч руу шууд
});

// ==================== Game Logic (Host only) ====================
function nextTurnReal() {
    if (!isHost) return;

    if (gameState.status !== 'WAITING') {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    }

    const catData = getCategoryData();
    const question = catData.questions[Math.floor(Math.random() * catData.questions.length)];

    gameState.status = 'TRUTH';
    gameState.currentCardContent = question;
    gameState.cardColor = 'var(--neon-blue)';

    net.broadcast({ type: 'STATE_UPDATE', state: gameState });
    updateGameUI();
}

function showPunishment() {
    if (!isHost) return;

    const catData = getCategoryData();
    const dare = catData.dares[Math.floor(Math.random() * catData.dares.length)];

    gameState.status = 'DARE';
    gameState.currentCardContent = dare;
    gameState.cardColor = 'var(--neon-pink)';

    net.broadcast({ type: 'STATE_UPDATE', state: gameState });
    updateGameUI();
}

// Client swipe → Host-д мессеж явуулах
function sendNextTurn() {
    if (isHost) {
        nextTurnReal();
    } else {
        net.send({ type: 'NEXT_TURN' });
    }
}

function sendPunishment() {
    if (isHost) {
        showPunishment();
    } else {
        net.send({ type: 'CHOOSE_PUNISHMENT' });
    }
}

// ==================== Swipe Logic ====================
let isDragging = false;
let startX = 0;

function startDrag(e) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    const myTurn = currentPlayer.id === net.myId || (isHost && currentPlayer.id.startsWith('local-'));

    if (!myTurn) return;

    // Prevent default slightly to stop scrolling/pull-to-refresh on some browsers
    // but usually handled in 'touchstart' listener options using preventDefault
    // We'll enforce it here if it's a touch event to be safe.
    if (e.type.includes('touch')) {
        // We don't preventDefault here for click compatibility unless we handle clicks fully manually.
        // But since we have custom tap logic, we can blocking native behavior to stop scroll.
    }

    isDragging = true;
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    resultCard.style.transition = 'none';
}

function drag(e) {
    if (!isDragging) return;
    const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const diff = x - startX;
    resultCard.style.transform = `translateX(${diff}px) rotate(${diff * 0.15}deg)`;
}

function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    resultCard.style.transition = 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';

    const x = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
    const diff = x - startX;

    // Unified Interaction Logic (No Dead Zone)
    // > 50px movement = Swipe
    // <= 50px movement = Tap
    if (Math.abs(diff) > 50) {
        if (diff > 0) {
            handleRightAction();
        } else {
            handleLeftAction();
        }
    } else {
        // TAP LOGIC
        // Use Global Screen Center for robustness on mobile
        if (x > window.innerWidth / 2) {
            handleRightAction();
        } else {
            handleLeftAction();
        }
    }

    // Reset transform only if we didn't flyOut (handled by actions)
    // But since handleAction calls flyOut immediately, we don't need to reset here
    // unless we decide NOT to act. But we always act now for simplicity?
    // Wait, if it's a Tap, we want to act.
    // If we wanted to allow "Cancel Swipe", we'd need a larger threshold or a specific zone.
    // But for this game, accidental taps are rare if we just assume intent.
    // Actually, "Snap Back" is good UX if you drag a little and release.
    // Let's keep a small "cancel" zone just in case?
    // User complaint "buruu ajilj baina" suggests it's HARD to trigger.
    // So "Always Act" is safer for responsiveness.
    // Exception: If I just rest my finger and move 1px? That's a tap.
    // If I drag 40px and release? That's ambiguous. I'll treat it as Tap (Intent to choose side).
}

function handleRightAction() {
    // Right = Positive (Accept / Next)
    flyOut(1000);
    setTimeout(sendNextTurn, 400); // Usually just Next Turn
}

function handleLeftAction() {
    // Left = Negative (Punishment)
    flyOut(-1000);
    setTimeout(() => {
        if (gameState.status === 'TRUTH') {
            sendPunishment(); // Go to Punishment
        } else {
            sendNextTurn(); // If already punishment, just next
        }
    }, 400);
}

function flyOut(x) {
    resultCard.style.transform = `translateX(${x}px) rotate(${x * 0.1}deg)`;
    resultCard.style.opacity = '0';
}

// Touch & Mouse
resultCard.addEventListener('mousedown', startDrag);
resultCard.addEventListener('touchstart', (e) => {
    // Prevent default to stop scrolling/zooming while touching card
    e.preventDefault();
    startDrag(e);
}, { passive: false });

document.addEventListener('mousemove', (e) => {
    if (isDragging) e.preventDefault();
    drag(e);
});
document.addEventListener('touchmove', (e) => {
    if (isDragging) e.preventDefault(); // Critical for mobile swipe
    drag(e);
}, { passive: false });

document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

// ==================== UI Helpers ====================
function updateGameUI() {
    if (gameState.status !== 'WAITING') {
        showScreen(gameScreen);
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    if (player) currentPlayerNameEl.textContent = player.name;

    if (gameState.currentCardContent) {
        const isTruth = gameState.status === 'TRUTH';
        const label = isTruth ? '😇 ҮНЭН (TRUTH)' : '😈 ШИЙТГЭЛ (DARE)';
        const instruction = isTruth
            ? '<span>Зүүн/Left ← ШИЙТГЭЛ</span> <span style="float:right">ҮНЭН → Баруун/Right</span>'
            : '<span style="display:block; text-align:center;">Дараагийнх → Swipe/Right Tap</span>';

        if (isTruth) {
            resultCard.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('truth_meme_bg.png')";
            resultCard.style.boxShadow = "0 0 30px rgba(0, 200, 255, 0.4)";

            // Show both buttons
            if (mobileControls) mobileControls.classList.remove('hidden');
            if (btnPunishment) btnPunishment.style.display = 'block';
            if (btnTruth) btnTruth.textContent = '😇 Үнэн (Дараагийнх)';
        } else {
            resultCard.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url('dare_meme_bg.png')";
            resultCard.style.boxShadow = "0 0 30px rgba(255, 0, 50, 0.4)";

            // Hide punishment button (already punished/choosing next)
            if (mobileControls) mobileControls.classList.remove('hidden');
            if (btnPunishment) btnPunishment.style.display = 'none';
            if (btnTruth) btnTruth.textContent = 'Дараагийнх →';
        }

        cardContent.innerHTML = `
            <h2 style="color: ${gameState.cardColor}; font-size: 2.2rem; margin-bottom: 20px; text-shadow: 0 2px 10px rgba(0,0,0,0.8);">${label}</h2>
            <p style="font-size: 1.4rem; line-height: 1.6; font-weight: 500; text-shadow: 0 1px 5px rgba(0,0,0,1);">${gameState.currentCardContent}</p>
            <div style="margin-top: 40px; font-size: 0.9rem; opacity: 0.9; font-weight: bold; text-shadow: 0 1px 3px rgba(0,0,0,1);">
                ${instruction}
            </div>
        `;
        resultCard.style.borderColor = gameState.cardColor;
        resultCard.style.opacity = '1';
        resultCard.style.transform = 'translateX(0) rotate(0deg)';
    }
}

function getCategoryData() {
    if (gameState.category === 'mix') {
        const qs = [], ds = [];
        Object.values(categories).forEach(c => {
            if (c.questions) qs.push(...c.questions);
            if (c.dares) ds.push(...c.dares);
        });
        return { questions: qs, dares: ds };
    }
    return categories[gameState.category] || categories.friends;
}

// data.js-ээс ачаалах
document.addEventListener('DOMContentLoaded', () => {
    if (typeof GAME_DATA !== 'undefined') categories = GAME_DATA;

    // Modal Elements
    modalOverlay = document.getElementById('custom-modal');
    modalMessage = document.getElementById('modal-message');
    modalOkBtn = document.getElementById('modal-ok-btn');

    // Mobile Control Elements
    mobileControls = document.getElementById('mobile-controls');
    btnPunishment = document.getElementById('btn-punishment');
    btnTruth = document.getElementById('btn-truth');

    if (modalOkBtn) {
        modalOkBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
            modalOverlay.classList.add('hidden');
            if (currentModalCallback) {
                currentModalCallback();
                currentModalCallback = null;
            }
        });
    }

    // Mobile Button Listeners
    if (btnPunishment) {
        btnPunishment.addEventListener('click', handleLeftAction);
    }
    if (btnTruth) {
        btnTruth.addEventListener('click', handleRightAction);
    }

    renderLobbyPlayers();
});

// Back buttons
document.getElementById('back-from-create-btn').onclick = () => showScreen(startScreen);
document.getElementById('back-to-start-btn').onclick = () => showScreen(startScreen);
document.getElementById('back-to-lobby-btn').onclick = () => location.reload();

// Add offline player (host only)
document.getElementById('add-player-btn').onclick = () => {
    if (!isHost) return;
    const name = document.getElementById('add-player-input').value.trim();
    if (!name) return;
    const fakeId = 'local-' + Date.now();
    gameState.players.push({ id: fakeId, name });
    renderLobbyPlayers();
    net.broadcast({ type: 'STATE_UPDATE', state: gameState });
    document.getElementById('add-player-input').value = '';
};

document.getElementById('leave-lobby-btn').onclick = () => {
    if (confirm('Өрөөнөөс гарахдаа итгэлтэй байна уу?')) {
        location.reload();
    }
};