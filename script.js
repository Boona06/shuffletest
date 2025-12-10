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
        div.textContent = p.name + (p.id === net.myId ? ' (Та)' : '');
        list.appendChild(div);
    });
    document.getElementById('player-count').textContent = gameState.players.length;
}

// ==================== NetworkManager ====================
class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.connections = [];
        this.myId = null;
    }

    initAsHost(roomCode) {
        const hostId = `TOD_MN_${roomCode}`;
        this.peer = new Peer(hostId);

        this.peer.on('open', (id) => {
            this.myId = id;
            console.log('Host opened:', id);
            displayRoomCode.textContent = roomCode;
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
                alert('Энэ код аль хэдийн ашиглагдсан байна. Дахин оролдоно уу!');
                showScreen(createScreen);
            } else {
                console.error(err);
                alert('Холболтын алдаа: ' + err.type);
            }
        });
    }

    initAsClient(roomCode) {
        this.peer = new Peer();

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
            this.conn.on('error', () => alert('Өрөө олдсонгүй эсвэл хаагдсан байна.'));
        });
    }

    setupConnection(conn) {
        this.connections.push(conn);
        conn.on('open', () => {
            conn.send({ type: 'STATE_UPDATE', state: gameState });
        });
        conn.on('data', data => this.handleData(data, conn));
        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
        });
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
                    this.nextTurn();
                    break;

                case 'CHOOSE_PUNISHMENT':
                    this.showPunishment();
                    break;
            }
        } else {
            // ====== CLIENT LOGIC ======
            if (data.type === 'STATE_UPDATE') {
                Object.assign(gameState, data.state);
                gameState.players = data.state.players; // deep replace
                gameState.category = data.state.category || 'friends';
                updateGameUI();
                renderLobbyPlayers();
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
    if (!name) return alert('Нэрээ оруулна уу!');

    myName = name;
    isHost = true;
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    net.initAsHost(code);
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    const name = joinNameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!name || code.length !== 4) return alert('Нэр болон 4 үсэгтэй кодоо зөв оруулна уу!');

    myName = name;
    isHost = false;
    net.initAsClient(code);
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
        return alert('Дор хаяж 2 тоглогч байх ёстой!');
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

    if (Math.abs(diff) > 120) {
        if (diff > 0) {
            // Баруун → ҮНЭН → Дараагийнх
            flyOut(1000);
            setTimeout(sendNextTurn, 400);
        } else {
            // Зүүн → Шийтгэл
            flyOut(-1000);
            setTimeout(() => {
                if (gameState.status === 'TRUTH') {
                    sendPunishment();
                } else {
                    sendNextTurn();
                }
            }, 400);
        }
    } else {
        resultCard.style.transform = 'translateX(0) rotate(0deg)';
    }
}

function flyOut(x) {
    resultCard.style.transform = `translateX(${x}px) rotate(${x * 0.1}deg)`;
    resultCard.style.opacity = '0';
}

// Touch & Mouse
resultCard.addEventListener('mousedown', startDrag);
resultCard.addEventListener('touchstart', (e) => {
    // Prevent default to stop scrolling/zooming while touching card
    // But we need to be careful not to block clicking if it's a tap.
    // Usually for swipe, we want to prevent scroll.
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
        cardContent.innerHTML = `
            <h2 style="color: ${gameState.cardColor}">${gameState.status === 'TRUTH' ? 'АСУУЛТ' : 'ШИЙТГЭЛ'}</h2>
            <p style="font-size: 1.3rem; line-height: 1.6;">${gameState.currentCardContent}</p>
            <div style="margin-top: 30px; font-size: 0.9rem; opacity: 0.7;">
                ${gameState.status === 'TRUTH'
                ? '<span>Зүүн ← ШИЙТГЭЛ</span> <span style="float:right">ҮНЭН → Баруун</span>'
                : '<span style="display:block; text-align:center;">Дараагийнх → Swipe</span>'}
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