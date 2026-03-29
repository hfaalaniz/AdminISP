require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initSchema } = require('./config/database');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/monitor');
const { iniciarScheduler } = require('./controllers/facturasController');
const { iniciarBackupScheduler } = require('./services/backupScheduler');

// Validate critical env vars
const required = ['DATABASE_URL', 'JWT_SECRET'];
required.forEach((k) => {
  if (!process.env[k]) {
    console.warn(`WARN: variable de entorno ${k} no definida`);
  }
});

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['*'];
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*')) return cb(null, true);
    if (isDev && origin.startsWith('http://localhost')) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(requestLogger);

// Rate limit on auth
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Demasiados intentos, espere unos minutos' } }));

// Serve uploaded images
const uploadsPath = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

app.use('/api', routes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  await initSchema();
  if (process.env.RUN_SEED === 'true') {
    const bcrypt = require('bcryptjs');
    const { query } = require('./config/database');
    const hash = await bcrypt.hash('admin123', 10);
    await query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Administrador', 'admin@isp.com', $1, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [hash]
    );
    console.log('✓ Seed ejecutado: admin@isp.com / admin123');
  }
  iniciarScheduler();
  iniciarBackupScheduler();
  app.listen(PORT, () => console.log(`✓ Servidor corriendo en http://localhost:${PORT}`));
};

start().catch((err) => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
