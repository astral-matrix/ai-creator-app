import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import { workspaceRouter } from './routes/workspaces.js';
import { streamRouter } from './routes/stream.js';

const PORT = parseInt(process.env.PORT || '4050', 10);

const app = express();
const wsInstance = expressWs(app);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Workspace routes
app.use('/runner/workspaces', workspaceRouter);

// WebSocket stream routes
wsInstance.app.use('/runner/workspaces', streamRouter);

app.listen(PORT, () => {
  console.log(`🚀 Runner service listening on port ${PORT}`);
});
