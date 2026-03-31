const { query } = require('../config/database');

const MODULOS = [
  { key: 'clientes',      label: 'Clientes',       acciones: ['ver','crear','editar','eliminar'] },
  { key: 'facturas',      label: 'Facturas',        acciones: ['ver','crear','cobrar'] },
  { key: 'ordenes',       label: 'Órdenes de trabajo', acciones: ['ver','crear','asignar'] },
  { key: 'planes',        label: 'Planes',          acciones: ['ver','editar'] },
  { key: 'reportes',      label: 'Reportes',        acciones: ['ver'] },
  { key: 'configuracion', label: 'Configuración',   acciones: ['ver','editar'] },
  { key: 'usuarios',      label: 'Usuarios',        acciones: ['ver','gestionar'] },
  { key: 'backup',        label: 'Backup',          acciones: ['crear','descargar'] },
  { key: 'monitor',       label: 'Monitor',         acciones: ['ver'] },
];

const ROLES = ['admin', 'operador', 'tecnico'];

// GET /roles — devuelve la matriz completa de permisos
const listar = async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT rol, modulo, accion, habilitado FROM permisos_roles ORDER BY rol, modulo, accion'
    );

    // Estructurar como { rol: { modulo: { accion: bool } } }
    const matriz = {};
    for (const rol of ROLES) {
      matriz[rol] = {};
      for (const mod of MODULOS) {
        matriz[rol][mod.key] = {};
        for (const acc of mod.acciones) {
          matriz[rol][mod.key][acc] = false;
        }
      }
    }
    for (const row of rows) {
      if (matriz[row.rol]?.[row.modulo]) {
        matriz[row.rol][row.modulo][row.accion] = row.habilitado;
      }
    }

    res.json({ modulos: MODULOS, roles: ROLES, permisos: matriz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
};

// PUT /roles/:rol/:modulo/:accion — actualiza un permiso individual
const actualizar = async (req, res) => {
  const { rol, modulo, accion } = req.params;
  const { habilitado } = req.body;

  if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  if (typeof habilitado !== 'boolean') return res.status(400).json({ error: 'habilitado debe ser boolean' });

  const moduloValido = MODULOS.find(m => m.key === modulo);
  if (!moduloValido) return res.status(400).json({ error: 'Módulo inválido' });
  if (!moduloValido.acciones.includes(accion)) return res.status(400).json({ error: 'Acción inválida' });

  try {
    await query(
      `INSERT INTO permisos_roles (rol, modulo, accion, habilitado, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (rol, modulo, accion)
       DO UPDATE SET habilitado = $4, updated_at = NOW()`,
      [rol, modulo, accion, habilitado]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar permiso' });
  }
};

// GET /roles/:rol/permisos — devuelve permisos de un rol específico (usado por el middleware)
const obtenerPorRol = async (rol) => {
  const { rows } = await query(
    'SELECT modulo, accion FROM permisos_roles WHERE rol = $1 AND habilitado = true',
    [rol]
  );
  const mapa = {};
  for (const row of rows) {
    if (!mapa[row.modulo]) mapa[row.modulo] = new Set();
    mapa[row.modulo].add(row.accion);
  }
  return mapa;
};

module.exports = { listar, actualizar, obtenerPorRol };
