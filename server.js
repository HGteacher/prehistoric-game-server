const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --- ÉTAT DU JEU ---
let gameState = {
  currentTurn: 1, // Table 1 commence
  scores: {},
  positions: {},
  attempts: {}, // Nombre d'échecs par table
  log: ["Bienvenue dans l’Odyssée préhistorique !"],
};

// Initialisation des 7 tables
for (let i = 1; i <= 7; i++) {
  gameState.scores[i] = 0;
  gameState.positions[i] = 0;
  gameState.attempts[i] = 0;
}

// --- NOUVELLE PARTIE ---
function resetGame() {
  for (let i = 1; i <= 7; i++) {
    gameState.scores[i] = 0;
    gameState.positions[i] = 0;
    gameState.attempts[i] = 0;
  }
  gameState.currentTurn = 1;
  gameState.log = ["Nouvelle partie commencée !"];
}

// --- CHANGEMENT DE TOUR ---
function nextTurn() {
  gameState.currentTurn++;
  if (gameState.currentTurn > 7) {
    gameState.currentTurn = 1;
  }
  io.emit("gameState", gameState);
}

// --- SOCKET.IO ---
io.on("connection", (socket) => {
  console.log("✅ Un joueur s'est connecté :", socket.id);

  // Envoie l'état du jeu au nouveau joueur
  socket.emit("gameState", gameState);

  // Quand une table répond
  socket.on("answerQuestion", ({ table, isCorrect }) => {
    if (isCorrect) {
      gameState.scores[table] += 1;
      gameState.positions[table] += 1;
      gameState.attempts[table] = 0; // reset les échecs
      gameState.log.push(`✅ Table ${table} a répondu juste et avance avec 1 point !`);
    } else {
      gameState.attempts[table] += 1;
      if (gameState.attempts[table] >= 2) {
        gameState.positions[table] += 1;
        gameState.attempts[table] = 0;
        gameState.log.push(`❌ Table ${table} a échoué 2 fois et avance sans point.`);
      } else {
        gameState.log.push(`⚠️ Table ${table} a échoué (${gameState.attempts[table]}/2).`);
        io.emit("gameState", gameState);
        return; // On reste sur la même table pour un 2e essai
      }
    }

    nextTurn();
  });

  // Réinitialisation du jeu
  socket.on("resetGame", () => {
    resetGame();
    io.emit("gameState", gameState);
  });

  socket.on("disconnect", () => {
    console.log("❌ Un joueur s'est déconnecté :", socket.id);
  });
});

// --- LANCEMENT DU SERVEUR ---
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur en ligne sur http://localhost:${PORT}`);
});
