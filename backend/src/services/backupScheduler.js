const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../../uploads/backups');
const MAX_BACKUPS = 10;

let schedulerInterval = null;

function getScheduleConfig() {
  const configPath = path.join(BACKUP_DIR, 'schedule.json');
  if (!fs.existsSync(configPath)) return { enabled: false, frequency: 'daily', hour: 2 };
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

async function runBackup() {
  // Importar acá para evitar circular dependency
  const { query } = require('../config/database');
  const TABLES = [
    'usuarios', 'planes', 'clientes', 'conexiones', 'facturas',
    'equipos', 'configuracion_isp', 'ordenes_trabajo', 'partes_tecnicos',
    'notificaciones', 'notificaciones_leidas', 'sesiones_clientes',
    'ofertas_instalacion', 'request_logs', 'error_logs', 'audit_logs', 'performance_logs'
  ];

  const data = { version: 1, created_at: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    try {
      const result = await query(`SELECT * FROM ${table} ORDER BY id`);
      data.tables[table] = result.rows;
    } catch {
      data.tables[table] = [];
    }
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = `auto_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(data, null, 2));
  console.log(`✓ Backup automático guardado: ${filename}`);

  // Mantener solo los últimos MAX_BACKUPS
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('auto_backup_') && f.endsWith('.json'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  files.slice(MAX_BACKUPS).forEach(f => {
    fs.unlinkSync(path.join(BACKUP_DIR, f.name));
    console.log(`✓ Backup antiguo eliminado: ${f.name}`);
  });
}

function getIntervalMs(frequency) {
  switch (frequency) {
    case 'hourly': return 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    case 'daily':
    default: return 24 * 60 * 60 * 1000;
  }
}

function iniciarBackupScheduler() {
  // Revisar cada hora si hay que correr un backup
  setInterval(async () => {
    const config = getScheduleConfig();
    if (!config.enabled) return;

    const now = new Date();
    const currentHour = now.getHours();

    if (config.frequency === 'hourly' || currentHour === (config.hour ?? 2)) {
      // Verificar que no se haya corrido ya en esta ventana
      const files = fs.existsSync(BACKUP_DIR)
        ? fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('auto_backup_'))
        : [];

      if (files.length > 0) {
        const lastFile = files.sort().pop();
        const lastTime = fs.statSync(path.join(BACKUP_DIR, lastFile)).mtime.getTime();
        const elapsed = Date.now() - lastTime;
        if (elapsed < getIntervalMs(config.frequency) - 60 * 60 * 1000) return;
      }

      try {
        await runBackup();
      } catch (err) {
        console.error('Error en backup automático:', err.message);
      }
    }
  }, 60 * 60 * 1000); // Revisar cada hora

  console.log('✓ Backup scheduler iniciado');
}

module.exports = { iniciarBackupScheduler, runBackup };
