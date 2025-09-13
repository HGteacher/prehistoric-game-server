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
  currentTurn: 1,
  scores: {},
  positions: {},
  attempts: {},
  log: ["Bienvenue dans l’Odyssée préhistorique !"],
  gameStarted: false, // ✅ nouvelle variable
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
  gameState.gameStarted = false;
}

// --- CHANGEMENT DE TOUR ---
function nextTurn() {
  gameState.currentTurn++;
  if (gameState.currentTurn > 7) {
    gameState.currentTurn = 1;
  }
  io.emit("gameState", gameState);
}

// --- LISTE DES TABLES CONNECTÉES ---
const connectedTables = {}; // { tableNumber: socketId }

// --- SOCKET.IO ---
io.on("connection", (socket) => {
  console.log("✅ Un joueur s'est connecté :", socket.id);

  // ✅ Connexion d'un élève → associer à une table
  socket.on("joinTable", (tableNumber) => {
    socket.role = "player";
    socket.table = tableNumber;
    connectedTables[tableNumber] = socket.id;
    console.log(`🎲 Table ${tableNumber} connectée (socket ${socket.id})`);

    // informer le prof
    io.emit("teacherUpdate", { connectedTables, gameState });
  });

  // ✅ Connexion du professeur
  socket.on("joinAsTeacher", (password) => {
    if (password === "1234prof") { // 🔑 mot de passe simple
      socket.role = "teacher";
      console.log("👨‍🏫 Prof connecté :", socket.id);

      // envoie au prof l'état du jeu et les connexions
      socket.emit("teacherUpdate", { connectedTables, gameState });
    } else {
      console.log("❌ Tentative prof avec mauvais mot de passe !");
    }
  });

  // Quand une table répond
  socket.on("answerQuestion", ({ table, isCorrect }) => {
    if (socket.role !== "player" || socket.table !== table) {
      console.log(`❌ Tentative invalide par ${socket.id}`);
      return;
    }

    if (isCorrect) {
      gameState.scores[table] += 1;
      gameState.positions[table] += 1;
      gameState.attempts[table] = 0;
      gameState.log.push(
        `✅ Table ${table} a répondu juste et avance avec 1 point !`
      );
    } else {
      gameState.attempts[table] += 1;
      if (gameState.attempts[table] >= 2) {
        gameState.positions[table] += 1;
        gameState.attempts[table] = 0;
        gameState.log.push(
          `❌ Table ${table} a échoué 2 fois et avance sans point.`
        );
      } else {
        gameState.log.push(
          `⚠️ Table ${table} a échoué (${gameState.attempts[table]}/2).`
        );
        io.emit("gameState", gameState);
        return;
      }
    }

    nextTurn();
    io.emit("teacherUpdate", { connectedTables, gameState });
  });

  // ✅ Commandes spéciales du prof
  socket.on("teacherCommand", (cmd) => {
    if (socket.role !== "teacher") return;

    if (cmd === "startGame") {
      gameState.gameStarted = true;
      gameState.log.push("🚀 La partie a été lancée par le professeur !");
    }
    if (cmd === "resetGame") {
      resetGame();
    }

    io.emit("gameState", gameState);
    io.emit("teacherUpdate", { connectedTables, gameState });
  });

  // Déconnexion
  socket.on("disconnect", () => {
    console.log("❌ Déconnecté :", socket.id);
    if (socket.role === "player" && socket.table) {
      delete connectedTables[socket.table];
    }
    io.emit("teacherUpdate", { connectedTables, gameState });
  });
});

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Serveur en ligne sur http://localhost:${PORT}`);
});
