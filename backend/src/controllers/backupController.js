const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

const BACKUP_DIR = path.join(__dirname, '../../uploads/backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const TABLES = [
  'usuarios', 'planes', 'clientes', 'conexiones', 'facturas',
  'equipos', 'configuracion_isp', 'ordenes_trabajo', 'partes_tecnicos',
  'notificaciones', 'notificaciones_leidas', 'sesiones_clientes',
  'ofertas_instalacion', 'request_logs', 'error_logs', 'audit_logs', 'performance_logs'
];

async function generateBackup() {
  const data = { version: 1, created_at: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    try {
      const result = await query(`SELECT * FROM ${table} ORDER BY id`);
      data.tables[table] = result.rows;
    } catch {
      data.tables[table] = [];
    }
  }
  return data;
}

// GET /api/backup/download — genera y descarga backup JSON
const download = async (req, res) => {
  try {
    const data = await generateBackup();
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error generando backup', detail: err.message });
  }
};

// POST /api/backup/save — genera y guarda backup en servidor
const save = async (req, res) => {
  try {
    const data = await generateBackup();
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    res.json({ ok: true, filename, size: fs.statSync(filepath).size });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando backup', detail: err.message });
  }
};

// GET /api/backup/list — lista backups guardados en servidor
const list = async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: stat.size, created_at: stat.mtime };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Error listando backups', detail: err.message });
  }
};

// GET /api/backup/server/:filename — descarga backup guardado en servidor
const downloadServer = async (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, path.basename(req.params.filename));
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup no encontrado' });
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(filepath);
  } catch (err) {
    res.status(500).json({ error: 'Error descargando backup', detail: err.message });
  }
};

// DELETE /api/backup/server/:filename — elimina backup del servidor
const deleteServer = async (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, path.basename(req.params.filename));
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup no encontrado' });
    fs.unlinkSync(filepath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando backup', detail: err.message });
  }
};

// POST /api/backup/restore — restaura desde JSON subido
const restore = async (req, res) => {
  try {
    const backup = req.body;
    if (!backup?.tables || backup?.version !== 1) {
      return res.status(400).json({ error: 'Archivo de backup inválido' });
    }

    const results = {};

    // Orden de restauración respetando foreign keys
    const restoreOrder = [
      'configuracion_isp', 'equipos', 'planes', 'usuarios',
      'clientes', 'conexiones', 'facturas', 'sesiones_clientes',
      'ordenes_trabajo', 'partes_tecnicos', 'notificaciones',
      'notificaciones_leidas', 'ofertas_instalacion',
      'request_logs', 'error_logs', 'audit_logs', 'performance_logs'
    ];

    for (const table of restoreOrder) {
      const rows = backup.tables[table];
      if (!rows || rows.length === 0) { results[table] = 0; continue; }

      // Limpiar tabla
      await query(`TRUNCATE TABLE ${table} CASCADE`);

      // Insertar filas
      let inserted = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        await query(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          vals
        );
        inserted++;
      }

      // Resetear secuencias
      try {
        await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
      } catch { /* tabla sin id serial */ }

      results[table] = inserted;
    }

    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: 'Error restaurando backup', detail: err.message });
  }
};

// GET /api/backup/schedule — obtiene configuración de backup automático
const getSchedule = async (req, res) => {
  try {
    const configPath = path.join(BACKUP_DIR, 'schedule.json');
    if (!fs.existsSync(configPath)) return res.json({ enabled: false, frequency: 'daily', hour: 2 });
    res.json(JSON.parse(fs.readFileSync(configPath, 'utf8')));
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo configuración', detail: err.message });
  }
};

// POST /api/backup/schedule — guarda configuración de backup automático
const setSchedule = async (req, res) => {
  try {
    const { enabled, frequency, hour } = req.body;
    const config = { enabled: !!enabled, frequency: frequency || 'daily', hour: hour ?? 2 };
    fs.writeFileSync(path.join(BACKUP_DIR, 'schedule.json'), JSON.stringify(config, null, 2));
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando configuración', detail: err.message });
  }
};

module.exports = { download, save, list, downloadServer, deleteServer, restore, getSchedule, setSchedule };
