require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { query, initSchema } = require('../config/database');

const seed = async () => {
  await initSchema();

  const hash = await bcrypt.hash('admin123', 10);
  await query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ('Administrador', 'admin@isp.com', $1, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [hash]
  );

  const planes = [
    ['Básico 10 Mbps', 10, 5, 1500.00, 'Plan económico para uso básico'],
    ['Estándar 50 Mbps', 50, 20, 2500.00, 'Ideal para familias'],
    ['Fibra 100 Mbps', 100, 50, 3500.00, 'Alta velocidad simétrica'],
    ['Empresarial 500 Mbps', 500, 500, 8000.00, 'Para empresas y comercios'],
  ];

  for (const [nombre, vd, vu, precio, desc] of planes) {
    await query(
      `INSERT INTO planes (nombre, velocidad_down, velocidad_up, precio_mensual, descripcion)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [nombre, vd, vu, precio, desc]
    );
  }

  console.log('✓ Seed completado');
  console.log('  Usuario: admin@isp.com / admin123');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
