const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // autorise toutes les origines (Netlify inclut)
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
  gameStarted: false,
};

// Initialisation des 7 tables
for (let i = 1; i <= 7; i++) {
  gameState.scores[i] = 0;
  gameState.positions[i] = 0;
  gameState.attempts[i] = 0;
}

// Liste des tables connectées
let connectedTables = {};

// --- NOUVELLE PARTIE ---
function resetGame() {
  for (let i = 1; i <= 7; i++) {
    gameState.scores[i] = 0;
    gameState.positions[i] = 0;
    gameState.attempts[i] = 0;
  }
  gameState.currentTurn = 1;
  gameState.log = ["Nouvelle partie commencée !"];
  gameState.gameStarted = false;
  connectedTables = {};
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
  console.log("✅ Connexion :", socket.id);

  // Quand un joueur choisit une table
  socket.on("joinTable", (table) => {
    connectedTables[table] = true;
    console.log(`➡️ Table ${table} connectée`);
    io.emit("teacherUpdate", { connectedTables, gameState });
    socket.emit("gameState", gameState);
  });

  // Quand un joueur répond à une question
  socket.on("answerQuestion", ({ table, isCorrect }) => {
    if (!gameState.gameStarted) return;

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
        return; // 2e essai
      }
    }
    nextTurn();
  });

  // Quand le prof se connecte
  socket.on("joinAsTeacher", (password) => {
    if (password === "1234prof") {
      console.log("👨‍🏫 Professeur connecté !");
      socket.emit("teacherUpdate", { connectedTables, gameState });
    }
  });

  // Commandes du prof
  socket.on("teacherCommand", (cmd) => {
    if (cmd === "resetGame") {
      resetGame();
      io.emit("gameState", gameState);
      io.emit("teacherUpdate", { connectedTables, gameState });
    }
    if (cmd === "startGame") {
      gameState.gameStarted = true;
      gameState.log.push("🚀 La partie a commencé !");
      io.emit("gameState", gameState);
      io.emit("teacherUpdate", { connectedTables, gameState });
    }
  });

  // Déconnexion
  socket.on("disconnect", () => {
    console.log("❌ Déconnexion :", socket.id);
  });
});

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur en ligne sur le port ${PORT}`);
});
