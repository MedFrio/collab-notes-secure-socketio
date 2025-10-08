import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Utils chemin ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// --- Données en mémoire (POC/TP) ---
/** @type {{id:string, username:string, passwordHash:string}[]} */
const users = [];
/** @type {{id:string, content:string, authorId:string}[]} */
const notes = [];

// --- App / HTTP / IO ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // CORS permissif pour le TP (adapter si besoin)
  cors: { origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// --- Middlewares HTTP ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
const genId = () => Math.random().toString(36).slice(2, 10);
const publicNote = (n) => ({ id: n.id, content: n.content, authorId: n.authorId });

// --- Auth HTTP (JWT) ---
function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// --- Routes Auth ---
app.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });

  const exists = users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (exists) return res.status(409).json({ error: 'username already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: genId(), username, passwordHash };
  users.push(user);
  return res.status(201).json({ id: user.id, username: user.username });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });

  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '2h' });
  return res.json({ token, user: { id: user.id, username: user.username } });
});

// --- Routes Notes ---
// Accès lecture public (non authentifié autorisé)
app.get('/notes', (req, res) => {
  res.json(notes.map(publicNote));
});

// Création (auth requise)
app.post('/notes', authRequired, (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content required' });

  const note = { id: genId(), content: String(content), authorId: req.userId };
  notes.push(note);

  io.emit('notes_updated', notes.map(publicNote)); // diffusion temps réel
  return res.status(201).json(publicNote(note));
});

// Modification (auth requise + ownership)
app.put('/notes/:id', authRequired, (req, res) => {
  const { id } = req.params;
  const { content } = req.body || {};
  const note = notes.find(n => n.id === id);
  if (!note) return res.status(404).json({ error: 'note not found' });
  if (note.authorId !== req.userId) return res.status(403).json({ error: 'forbidden' });
  if (!content) return res.status(400).json({ error: 'content required' });

  note.content = String(content);
  io.emit('notes_updated', notes.map(publicNote));
  return res.json(publicNote(note));
});

// Suppression (auth requise + ownership)
app.delete('/notes/:id', authRequired, (req, res) => {
  const { id } = req.params;
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return res.status(404).json({ error: 'note not found' });
  if (notes[idx].authorId !== req.userId) return res.status(403).json({ error: 'forbidden' });

  const removed = notes.splice(idx, 1)[0];
  io.emit('notes_updated', notes.map(publicNote));
  return res.json(publicNote(removed));
});

// --- Auth Socket.IO (optionnelle mais montrée) ---
io.use((socket, next) => {
  // Le client peut passer { auth: { token: '...' } } ou query ?token=...
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    // On peut autoriser en lecture seule : on laisse passer sans userId
    socket.data.userId = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.data.userId = payload.userId;
    return next();
  } catch {
    // Rejeter si on veut des WS strictement authentifiés
    // return next(new Error('Unauthorized'));
    socket.data.userId = null;
    return next();
  }
});

// --- Connexions WS ---
io.on('connection', (socket) => {
  console.log('Socket connected', socket.id, 'userId=', socket.data.userId || 'anonymous');

  // À la connexion, on peut pousser l’état actuel
  socket.emit('notes_updated', notes.map(publicNote));

  socket.on('disconnect', () => {
    // Rien de spécial ici pour le TP
  });

  // (Optionnel) Si tu veux gérer des modifications directes via WS,
  // réimplémente les mêmes checks d’auth + ownership ici
  // et re-émets 'notes_updated' après mise à jour.
});

// --- Lancer ---
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
