import express from "express";
import { createServer as createViteServer } from "vite";
import { Server as SocketServer } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "AetherCAD Server is running" });
  });

  // Simulation WebSocket
  io.on("connection", (socket) => {
    console.log("Client connected to simulation stream");
    
    socket.on("simulate", (data) => {
      // Stub for simulation logic
      console.log("Received simulation request:", data);
      
      // Simulate real-time progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        socket.emit("simulation-progress", { progress, status: "running" });
        
        if (progress >= 100) {
          clearInterval(interval);
          socket.emit("simulation-complete", { 
            result: "Simulation successful",
            data: { time: [0, 1, 2, 3, 4, 5], voltage: [0, 1, 0.5, 0.8, 0.2, 0] }
          });
        }
      }, 500);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
