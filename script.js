
// Game Data
let categories = {};

// DOM Elements
const startScreen = document.getElementById('start-screen');
const createScreen = document.getElementById('create-screen');
const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

// Menu Buttons
const createGameMenuBtn = document.getElementById('create-game-menu-btn');
const joinGameMenuBtn = document.getElementById('join-game-menu-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const backToStartBtn = document.getElementById('back-to-start-btn');
const backFromCreateBtn = document.getElementById('back-from-create-btn');

// Inputs
const createNameInput = document.getElementById('create-name-input');
const joinNameInput = document.getElementById('join-name-input');
const roomCodeInput = document.getElementById('room-code-input');

// Lobby Elements
const displayRoomCode = document.getElementById('display-room-code');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const startGameBtn = document.getElementById('start-game-btn');
const waitingMsg = document.getElementById('waiting-msg');
const hostControls = document.getElementById('host-controls');
const categoryCards = document.querySelectorAll('.category-card');

// Game Elements
const currentPlayerNameEl = document.getElementById('current-player-name');
const resultCard = document.getElementById('result-card');
const cardContent = document.getElementById('card-content');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

// Game State
let myName = '';
let isHost = false;
let currentCategory = 'friends';
let gameState = {
    players: [], // { id, name }
    currentPlayerIndex: 0,
    status: 'WAITING', // 'TRUTH', 'DARE', 'WAITING'
    currentCardContent: null,
    cardColor: 'var(--neon-blue)'
};

// Network Manager
class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null; // For client
        this.connections = []; // For host
        this.roomId = null;
    }

    init(id = null) {
        this.peer = new Peer(id, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            if (isHost) {
                this.roomId = this.generateRoomCode();
                console.log('Room Created:', this.roomId);
                displayRoomCode.textContent = this.roomId;
                // Host listens for connections
                this.peer.on('connection', (conn) => {
                    this.handleConnection(conn);
                });
                // Add host to players
                this.addPlayer(this.peer.id, myName);
            } else {
                // Client connects to host
                this.connectToHost(roomCodeInput.value.toUpperCase());
            }
        });

        this.peer.on('error', (err) => {
            console.error(err);
            alert('Connection Error: ' + err.type);
        });
    }

    generateRoomCode() {
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    // Host Logic
    handleConnection(conn) {
        this.connections.push(conn);
        conn.on('data', (data) => {
            this.handleData(data, conn.peer);
        });
        conn.on('open', () => {
            // Send current state to new player
            conn.send({ type: 'STATE_UPDATE', state: gameState });
        });
    }

    addPlayer(id, name) {
        gameState.players.push({ id, name });
        this.broadcastState();
        renderLobbyPlayers();
    }

    broadcastState() {
        const data = { type: 'STATE_UPDATE', state: gameState };
        this.connections.forEach(conn => conn.send(data));
        // Update Host UI
        updateGameUI();
    }

    // Client Logic
    connectToHost(code) {
        // In a real app, we'd map code to PeerID. 
        // For this P2P demo without a server, we'll use the code AS the PeerID for the host if possible, 
        // OR we need a way to exchange IDs. 
        // SIMPLIFICATION: We will try to Connect to a Peer with ID = "TOD-" + Code
        // So Host must init with that ID.

        // RE-INIT Peer with specific ID for Host is tricky if taken.
        // Alternative: Host ID is random, but we need to share it.
        // TRICK: We will use a hash of the Room Code as the PeerID? No, collisions.

        // BETTER APPROACH for simple P2P:
        // Host ID = "TOD_GAME_" + RoomCode
        // Client connects to "TOD_GAME_" + RoomCode
    }

    // Unified Send
    sendAction(type, payload) {
        if (isHost) {
            this.handleData({ type, payload }, this.peer.id);
        } else {
            if (this.conn) {
                this.conn.send({ type, payload });
            }
        }
    }

    handleData(data, senderId) {
        console.log('Received:', data);
        if (isHost) {
            // Host processes actions
            switch (data.type) {
                case 'JOIN':
                    this.addPlayer(senderId, data.payload.name);
                    break;
                case 'NEXT_TURN':
                    nextTurn();
                    break;
                case 'SHOW_PUNISHMENT':
                    showPunishment();
                    break;
            }
        } else {
            // Client processes state updates
            if (data.type === 'STATE_UPDATE') {
                gameState = data.state;
                updateGameUI();
                renderLobbyPlayers();
            }
        }
    }
}

// FIX: We need a way for Clients to find the Host PeerID using just a 4-letter code.
// Since PeerJS requires a unique ID, we will force the Host's PeerID to be the Room Code.
// This might fail if the ID is taken, but for a demo it's acceptable.
// Prefix: "TOD_MN_"

const net = new NetworkManager();

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load Data
    if (typeof GAME_DATA !== 'undefined') {
        categories = GAME_DATA;
    }

    // Menu Interactions
    createGameMenuBtn.addEventListener('click', () => {
        showScreen(createScreen);
        createNameInput.focus();
    });

    joinGameMenuBtn.addEventListener('click', () => {
        showScreen(joinScreen);
        joinNameInput.focus();
    });

    backToStartBtn.addEventListener('click', () => {
        showScreen(startScreen);
    });

    backFromCreateBtn.addEventListener('click', () => {
        showScreen(startScreen);
    });

    createRoomBtn.addEventListener('click', () => {
        const name = createNameInput.value.trim();
        if (!name) {
            alert('Нэрээ оруулна уу!');
            return;
        }
        myName = name;
        isHost = true;

        // Generate Code first
        const code = Math.random().toString(36).substring(2, 6).toUpperCase();
        const hostId = "TOD_MN_" + code;

        net.roomId = code;
        net.peer = new Peer(hostId);

        net.peer.on('open', (id) => {
            showScreen(lobbyScreen);
            displayRoomCode.textContent = code;
            hostControls.classList.remove('hidden');
            startGameBtn.classList.remove('hidden');
            waitingMsg.classList.add('hidden');

            // Init Host State
            gameState.players = [{ id: hostId, name: myName }];
            renderLobbyPlayers();

            net.peer.on('connection', (conn) => {
                net.handleConnection(conn);
            });
        });

        net.peer.on('error', (err) => {
            alert('Error creating room. Try again.');
            console.error(err);
        });
    });

    joinRoomBtn.addEventListener('click', () => {
        const name = joinNameInput.value.trim();
        const code = roomCodeInput.value.trim().toUpperCase();

        if (!name || code.length !== 4) {
            alert('Нэр болон 4 оронтой кодоо оруулна уу.');
            return;
        }

        myName = name;
        isHost = false;

        net.peer = new Peer(); // Random ID for client
        net.peer.on('open', (id) => {
            const hostId = "TOD_MN_" + code;
            const conn = net.peer.connect(hostId);

            conn.on('open', () => {
                net.conn = conn;
                showScreen(lobbyScreen);
                displayRoomCode.textContent = code;
                hostControls.classList.add('hidden');
                startGameBtn.classList.add('hidden');
                waitingMsg.classList.remove('hidden');

                // Send Join Request
                conn.send({ type: 'JOIN', payload: { name: myName } });
            });

            conn.on('data', (data) => {
                net.handleData(data);
            });

            conn.on('error', (err) => {
                alert('Өрөө олдсонгүй!');
            });
        });
    });

    // Lobby Interactions
    const addPlayerInput = document.getElementById('add-player-input');
    const addPlayerBtn = document.getElementById('add-player-btn');

    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', () => {
            const name = addPlayerInput.value.trim();
            if (name) {
                // Generate a fake ID for local players
                const fakeId = 'local-' + Math.random().toString(36).substr(2, 9);
                net.addPlayer(fakeId, name);
                addPlayerInput.value = '';
                addPlayerInput.focus();
            }
        });
    }

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            if (!isHost) return;
            categoryCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentCategory = card.dataset.category;
        });
    });

    startGameBtn.addEventListener('click', () => {
        if (!isHost) return;
        if (gameState.players.length < 2) {
            alert('Тоглохын тулд дор хаяж 2 тоглогч хэрэгтэй!');
            return;
        }

        // Initial Game Start
        currentPlayerIndex = 0;
        nextTurn(); // Will generate question and broadcast
    });

    // Game Interactions (Swipe)
    resultCard.addEventListener('mousedown', startDrag);
    resultCard.addEventListener('touchstart', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);

    backToMenuBtn.addEventListener('click', () => {
        location.reload(); // Simple reset
    });
});

// UI Helpers
function showScreen(screen) {
    [startScreen, createScreen, joinScreen, lobbyScreen, gameScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
    screen.style.display = 'block'; // Ensure block display
}

function renderLobbyPlayers() {
    lobbyPlayerList.innerHTML = '';
    gameState.players.forEach(p => {
        const tag = document.createElement('div');
        tag.className = 'player-tag';
        tag.textContent = p.name;
        lobbyPlayerList.appendChild(tag);
    });
}

function updateGameUI() {
    // Only switch to game screen if game has started
    if (gameState.status === 'WAITING') {
        if (!lobbyScreen.classList.contains('hidden') || !createScreen.classList.contains('hidden') || !joinScreen.classList.contains('hidden')) {
            // Still in lobby/menu, do nothing
            return;
        }
    } else {
        // Game is running
        if (gameScreen.classList.contains('hidden')) {
            showScreen(gameScreen);
        }
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer) {
        currentPlayerNameEl.textContent = currentPlayer.name;
    }

    // Update Card
    if (gameState.currentCardContent) {
        cardContent.innerHTML = `
            <h2 style="color: ${gameState.cardColor}; margin-bottom: 20px;">${gameState.status === 'TRUTH' ? 'АСУУЛТ' : 'ШИЙТГЭЛ'}</h2>
            <p>${gameState.currentCardContent}</p>
            <br><br>
            <div style="display: flex; justify-content: space-between; width: 100%; padding: 0 20px; font-size: 0.8rem; color: rgba(255,255,255,0.6);">
                ${gameState.status === 'TRUTH' ? '<span><- ШИЙТГЭЛ</span><span>ДАРААГИЙНХ -></span>' : '<span class="swipe-hint">Дараагийн хүн рүү -> Swipe</span>'}
            </div>
        `;

        resultCard.style.borderColor = gameState.cardColor;
        resultCard.style.transform = 'translate(0, 0) rotate(0deg)';
        resultCard.style.opacity = '1';
    }

    // Disable interaction if not my turn
    // Allow Host to control "local-" players
    const isMyTurn = currentPlayer && currentPlayer.id === net.peer.id;
    const isLocalPlayerTurn = currentPlayer && currentPlayer.id.startsWith('local-') && isHost;

    if (isMyTurn || isLocalPlayerTurn) {
        resultCard.style.pointerEvents = 'auto';
        resultCard.style.opacity = '1';
    } else {
        resultCard.style.pointerEvents = 'none';
        resultCard.style.opacity = '0.7';
    }
}

// Game Logic (Host Only)
function getCategoryData() {
    if (currentCategory === 'mix') {
        const allQuestions = [];
        const allDares = [];
        Object.values(categories).forEach(cat => {
            if (cat.questions) allQuestions.push(...cat.questions);
            if (cat.dares) allDares.push(...cat.dares);
        });
        return { questions: allQuestions, dares: allDares };
    }
    return categories[currentCategory];
}

function nextTurn() {
    // Only Host calculates next state
    if (!isHost) {
        net.sendAction('NEXT_TURN', {});
        return;
    }

    // Update Index
    // If it's start of game, index is 0. If continuing, increment.
    // But we need to handle the very first call separately or just init with -1?
    // Let's assume nextTurn moves to NEXT player.
    // Ideally we want to show question for CURRENT player first.

    // Logic:
    // 1. Determine Player (Round Robin)
    // 2. Pick Question
    // 3. Update State
    // 4. Broadcast

    // If game just started (status waiting), don't increment yet? 
    // Or just start with Player 0.

    if (gameState.status !== 'WAITING') {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    }

    gameState.status = 'TRUTH';
    const data = getCategoryData();
    const q = data.questions[Math.floor(Math.random() * data.questions.length)];

    gameState.currentCardContent = q;
    gameState.cardColor = 'var(--neon-blue)';

    net.broadcastState();
}

function showPunishment() {
    if (!isHost) {
        net.sendAction('SHOW_PUNISHMENT', {});
        return;
    }

    gameState.status = 'DARE';
    const data = getCategoryData();
    const d = data.dares[Math.floor(Math.random() * data.dares.length)];

    gameState.currentCardContent = d;
    gameState.cardColor = 'var(--neon-pink)';

    net.broadcastState();
}

// Swipe Logic (Client & Host)
let isDragging = false;
let startX = 0;
let currentX = 0;

function startDrag(e) {
    // Check if my turn
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return;

    const isMyTurn = currentPlayer.id === net.peer.id;
    const isLocalPlayerTurn = currentPlayer.id.startsWith('local-') && isHost;

    if (!isMyTurn && !isLocalPlayerTurn) return;

    isDragging = true;
    startX = getClientX(e);
    resultCard.style.transition = 'none';
}

function drag(e) {
    if (!isDragging) return;
    currentX = getClientX(e);
    const diffX = currentX - startX;
    const rotate = diffX * 0.1;
    resultCard.style.transform = `translate(${diffX}px, 0) rotate(${rotate}deg)`;
}

function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    resultCard.style.transition = 'transform 0.3s ease-out';

    const diffX = currentX - startX;
    const threshold = 100;

    if (diffX > threshold) {
        // Right Swipe
        flyOut('right');
        setTimeout(() => {
            nextTurn();
        }, 300);
    } else if (diffX < -threshold) {
        // Left Swipe
        flyOut('left');
        setTimeout(() => {
            if (gameState.status === 'TRUTH') {
                showPunishment();
            } else {
                nextTurn();
            }
        }, 300);
    } else {
        resultCard.style.transform = 'translate(0, 0) rotate(0deg)';
    }
}

function getClientX(e) {
    return e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
}

function flyOut(direction) {
    const moveX = direction === 'right' ? 1000 : -1000;
    resultCard.style.transform = `translate(${moveX}px, 0) rotate(${moveX * 0.1}deg)`;
    resultCard.style.opacity = '0';
}
