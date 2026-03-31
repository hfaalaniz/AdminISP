const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const query = (text, params) => pool.query(text, params);

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const initSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id            SERIAL PRIMARY KEY,
      nombre        TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol           TEXT NOT NULL DEFAULT 'operador',
      activo        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS planes (
      id              SERIAL PRIMARY KEY,
      nombre          TEXT NOT NULL,
      velocidad_down  INTEGER NOT NULL,
      velocidad_up    INTEGER NOT NULL,
      precio_mensual  NUMERIC(10,2) NOT NULL,
      descripcion     TEXT,
      activo          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id              SERIAL PRIMARY KEY,
      nombre          TEXT NOT NULL,
      email           TEXT UNIQUE,
      telefono        TEXT,
      dni             TEXT UNIQUE,
      direccion       TEXT,
      barrio          TEXT,
      ciudad          TEXT,
      coordenadas     TEXT,
      plan_id         INTEGER REFERENCES planes(id) ON DELETE SET NULL,
      estado          TEXT NOT NULL DEFAULT 'activo',
      fecha_alta      DATE NOT NULL DEFAULT CURRENT_DATE,
      notas           TEXT,
      password_hash   TEXT,
      contrato_listo  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Migrations for clientes
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS password_hash  TEXT;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contrato_listo BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dni_frente_url TEXT;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dni_dorso_url  TEXT;
    ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sesion_activa  BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS sesiones_clientes (
      id          SERIAL PRIMARY KEY,
      cliente_id  INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      inicio      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fin         TIMESTAMPTZ,
      duracion_seg INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sesiones_cliente ON sesiones_clientes(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_sesiones_inicio  ON sesiones_clientes(inicio DESC);

    CREATE TABLE IF NOT EXISTS notificaciones (
      id            SERIAL PRIMARY KEY,
      tipo          TEXT NOT NULL CHECK (tipo IN ('corte_programado','suspension','problema_red','mantenimiento','aviso_pago','personalizado')),
      titulo        TEXT NOT NULL,
      mensaje       TEXT NOT NULL,
      destinatarios TEXT NOT NULL DEFAULT 'todos' CHECK (destinatarios IN ('todos','activos','suspendidos','cliente')),
      cliente_id    INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      enviado_por   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      emails_enviados INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notificaciones_leidas (
      cliente_id       INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      notificacion_id  INTEGER NOT NULL REFERENCES notificaciones(id) ON DELETE CASCADE,
      leida_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (cliente_id, notificacion_id)
    );

    CREATE INDEX IF NOT EXISTS idx_notificaciones_cliente ON notificaciones(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_notificaciones_created ON notificaciones(created_at DESC);

    CREATE TABLE IF NOT EXISTS conexiones (
      id              SERIAL PRIMARY KEY,
      cliente_id      INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      ip_asignada     TEXT,
      mac_address     TEXT,
      puerto_olt      TEXT,
      tecnologia      TEXT DEFAULT 'fibra',
      estado          TEXT NOT NULL DEFAULT 'conectado',
      ultimo_ping     TIMESTAMPTZ,
      velocidad_real  INTEGER,
      observaciones   TEXT,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS facturas (
      id                SERIAL PRIMARY KEY,
      cliente_id        INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      plan_id           INTEGER REFERENCES planes(id) ON DELETE SET NULL,
      periodo           TEXT NOT NULL,
      monto             NUMERIC(10,2) NOT NULL,
      estado_pago       TEXT NOT NULL DEFAULT 'pendiente',
      fecha_vencimiento DATE NOT NULL,
      fecha_pago        TIMESTAMPTZ,
      metodo_pago       TEXT,
      referencia_pago   TEXT,
      notas             TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_conexiones_cliente   ON conexiones(cliente_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_periodo     ON facturas(cliente_id, periodo);
    CREATE INDEX IF NOT EXISTS idx_clientes_estado             ON clientes(estado);
    CREATE INDEX IF NOT EXISTS idx_clientes_plan              ON clientes(plan_id);
    CREATE INDEX IF NOT EXISTS idx_facturas_estado             ON facturas(estado_pago);
    CREATE INDEX IF NOT EXISTS idx_facturas_vencimiento        ON facturas(fecha_vencimiento);
    CREATE INDEX IF NOT EXISTS idx_conexiones_estado           ON conexiones(estado);

    CREATE TABLE IF NOT EXISTS equipos (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT NOT NULL,
      marca       TEXT,
      modelo      TEXT,
      descripcion TEXT,
      activo      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS configuracion_isp (
      id              SERIAL PRIMARY KEY,
      nombre_empresa  TEXT NOT NULL DEFAULT 'AdminISP',
      cuit            TEXT,
      domicilio       TEXT,
      telefono        TEXT,
      email           TEXT,
      localidad       TEXT NOT NULL DEFAULT 'Villa Santa Cruz del Lago',
      provincia       TEXT NOT NULL DEFAULT 'Córdoba',
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE configuracion_isp ADD COLUMN IF NOT EXISTS logo_url TEXT;

    INSERT INTO configuracion_isp (id, nombre_empresa, localidad, provincia)
    VALUES (1, 'AdminISP', 'Villa Santa Cruz del Lago', 'Córdoba')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO equipos (nombre, marca, modelo, descripcion)
    SELECT 'ONT', 'Huawei', 'HG8310M', 'Convertidor de fibra óptica'
    WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE modelo = 'HG8310M');

    INSERT INTO equipos (nombre, marca, modelo, descripcion)
    SELECT 'Router WiFi', 'TP-Link', 'Archer C6', 'Router inalámbrico doble banda'
    WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE modelo = 'Archer C6');

    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('admin','operador','tecnico'));

    CREATE TABLE IF NOT EXISTS ordenes_trabajo (
      id               SERIAL PRIMARY KEY,
      cliente_id       INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      tecnico_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_by       INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
      tipo             TEXT NOT NULL CHECK (tipo IN ('conexion','instalacion','reparacion','diagnostico','otro')),
      descripcion      TEXT,
      estado           TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','en_curso','completada','cancelada')),
      prioridad        TEXT NOT NULL DEFAULT 'normal'
                         CHECK (prioridad IN ('baja','normal','alta','urgente')),
      fecha_programada TIMESTAMPTZ,
      fecha_completada TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Migrations for existing tables
    ALTER TABLE ordenes_trabajo ALTER COLUMN created_by DROP NOT NULL;
    ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_tipo_check;
    ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_tipo_check
      CHECK (tipo IN ('conexion','instalacion','reparacion','diagnostico','otro'));

    CREATE INDEX IF NOT EXISTS idx_ordenes_cliente ON ordenes_trabajo(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_ordenes_tecnico ON ordenes_trabajo(tecnico_id);
    CREATE INDEX IF NOT EXISTS idx_ordenes_estado  ON ordenes_trabajo(estado);

    CREATE TABLE IF NOT EXISTS partes_tecnicos (
      id                         SERIAL PRIMARY KEY,
      orden_id                   INTEGER NOT NULL UNIQUE REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
      tecnico_id                 INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      trabajo_realizado          TEXT,
      equipos_instalados         JSONB NOT NULL DEFAULT '[]',
      observaciones              TEXT,
      estado_conexion_resultante TEXT,
      fecha_trabajo              DATE,
      imagenes                   JSONB NOT NULL DEFAULT '[]',
      submitted_at               TIMESTAMPTZ,
      locked                     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_partes_orden   ON partes_tecnicos(orden_id);
    CREATE INDEX IF NOT EXISTS idx_partes_tecnico ON partes_tecnicos(tecnico_id);

    -- ── Ofertas de instalación ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ofertas_instalacion (
      id            SERIAL PRIMARY KEY,
      nombre        TEXT NOT NULL,
      descripcion   TEXT,
      tipo          TEXT NOT NULL CHECK (tipo IN ('gratis','precio_fijo','cuotas')),
      precio_total  NUMERIC(10,2) NOT NULL DEFAULT 0,
      cuotas        INTEGER NOT NULL DEFAULT 1,
      activa        BOOLEAN NOT NULL DEFAULT TRUE,
      orden         INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE ofertas_instalacion ADD COLUMN IF NOT EXISTS precio_original NUMERIC(10,2);
    ALTER TABLE ofertas_instalacion ADD COLUMN IF NOT EXISTS destacada BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE ofertas_instalacion ADD COLUMN IF NOT EXISTS badge_texto TEXT;
    ALTER TABLE ofertas_instalacion ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
    ALTER TABLE ofertas_instalacion ADD COLUMN IF NOT EXISTS fecha_fin DATE;
    ALTER TABLE ofertas_instalacion ADD COLUMN IF NOT EXISTS plan_ids INTEGER[] NOT NULL DEFAULT '{}';

    -- Tipo en facturas para distinguir servicio vs instalación
    ALTER TABLE facturas ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'servicio'
      CHECK (tipo IN ('servicio','instalacion'));
    ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cuota_numero   INTEGER;
    ALTER TABLE facturas ADD COLUMN IF NOT EXISTS cuota_total    INTEGER;
    ALTER TABLE facturas ADD COLUMN IF NOT EXISTS oferta_id      INTEGER REFERENCES ofertas_instalacion(id) ON DELETE SET NULL;

    -- ── Monitoreo ────────────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS request_logs (
      id           SERIAL PRIMARY KEY,
      method       TEXT NOT NULL,
      path         TEXT NOT NULL,
      status       INTEGER NOT NULL,
      duration_ms  INTEGER NOT NULL,
      user_id      INTEGER,
      user_rol     TEXT,
      ip           TEXT,
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_request_logs_created ON request_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_request_logs_status  ON request_logs(status);
    CREATE INDEX IF NOT EXISTS idx_request_logs_path    ON request_logs(path);

    CREATE TABLE IF NOT EXISTS error_logs (
      id           SERIAL PRIMARY KEY,
      source       TEXT NOT NULL CHECK (source IN ('backend','frontend')),
      level        TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('error','warn')),
      message      TEXT NOT NULL,
      stack        TEXT,
      path         TEXT,
      method       TEXT,
      user_id      INTEGER,
      user_rol     TEXT,
      context      JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_error_logs_source  ON error_logs(source);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id           SERIAL PRIMARY KEY,
      action       TEXT NOT NULL,
      entity       TEXT NOT NULL,
      entity_id    INTEGER,
      user_id      INTEGER,
      user_nombre  TEXT,
      user_rol     TEXT,
      detail       JSONB,
      ip           TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created   ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs(entity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user      ON audit_logs(user_id);

    CREATE TABLE IF NOT EXISTS performance_logs (
      id           SERIAL PRIMARY KEY,
      source       TEXT NOT NULL CHECK (source IN ('backend','frontend')),
      metric       TEXT NOT NULL,
      value        NUMERIC NOT NULL,
      path         TEXT,
      context      JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_perf_logs_created ON performance_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_perf_logs_metric  ON performance_logs(metric);

    -- ── Permisos por rol ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS permisos_roles (
      id        SERIAL PRIMARY KEY,
      rol       TEXT NOT NULL CHECK (rol IN ('admin','operador','tecnico')),
      modulo    TEXT NOT NULL,
      accion    TEXT NOT NULL,
      habilitado BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (rol, modulo, accion)
    );

    -- Seed de permisos por defecto (admin tiene todo, operador y tecnico restringidos)
    INSERT INTO permisos_roles (rol, modulo, accion, habilitado) VALUES
      -- admin: todo habilitado
      ('admin','clientes','ver',true),('admin','clientes','crear',true),('admin','clientes','editar',true),('admin','clientes','eliminar',true),
      ('admin','facturas','ver',true),('admin','facturas','crear',true),('admin','facturas','cobrar',true),
      ('admin','ordenes','ver',true),('admin','ordenes','crear',true),('admin','ordenes','asignar',true),
      ('admin','planes','ver',true),('admin','planes','editar',true),
      ('admin','reportes','ver',true),
      ('admin','configuracion','ver',true),('admin','configuracion','editar',true),
      ('admin','usuarios','ver',true),('admin','usuarios','gestionar',true),
      ('admin','backup','crear',true),('admin','backup','descargar',true),
      ('admin','monitor','ver',true),
      -- operador: permisos de operacion
      ('operador','clientes','ver',true),('operador','clientes','crear',true),('operador','clientes','editar',true),('operador','clientes','eliminar',false),
      ('operador','facturas','ver',true),('operador','facturas','crear',true),('operador','facturas','cobrar',true),
      ('operador','ordenes','ver',true),('operador','ordenes','crear',true),('operador','ordenes','asignar',false),
      ('operador','planes','ver',true),('operador','planes','editar',false),
      ('operador','reportes','ver',false),
      ('operador','configuracion','ver',true),('operador','configuracion','editar',false),
      ('operador','usuarios','ver',false),('operador','usuarios','gestionar',false),
      ('operador','backup','crear',false),('operador','backup','descargar',false),
      ('operador','monitor','ver',false),
      -- tecnico: solo ordenes y clientes (lectura)
      ('tecnico','clientes','ver',true),('tecnico','clientes','crear',false),('tecnico','clientes','editar',false),('tecnico','clientes','eliminar',false),
      ('tecnico','facturas','ver',false),('tecnico','facturas','crear',false),('tecnico','facturas','cobrar',false),
      ('tecnico','ordenes','ver',true),('tecnico','ordenes','crear',false),('tecnico','ordenes','asignar',false),
      ('tecnico','planes','ver',true),('tecnico','planes','editar',false),
      ('tecnico','reportes','ver',false),
      ('tecnico','configuracion','ver',false),('tecnico','configuracion','editar',false),
      ('tecnico','usuarios','ver',false),('tecnico','usuarios','gestionar',false),
      ('tecnico','backup','crear',false),('tecnico','backup','descargar',false),
      ('tecnico','monitor','ver',false)
    ON CONFLICT (rol, modulo, accion) DO NOTHING;
  `);
  console.log('✓ Schema initialized');
};

module.exports = { query, transaction, initSchema };
