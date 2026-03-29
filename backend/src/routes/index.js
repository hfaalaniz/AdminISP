const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole, requireAnyRole, clienteAuthMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

const auth = require('../controllers/authController');
const clientes = require('../controllers/clientesController');
const planes = require('../controllers/planesController');
const conexiones = require('../controllers/conexionesController');
const facturas = require('../controllers/facturasController');
const dashboard = require('../controllers/dashboardController');
const equipos = require('../controllers/equiposController');
const configuracion = require('../controllers/configuracionController');
const contrato = require('../controllers/contratoController');
const usuarios = require('../controllers/usuariosController');
const ordenes = require('../controllers/ordenesController');
const partes = require('../controllers/partesController');
const clienteAuth = require('../controllers/clienteAuthController');
const pagosMP = require('../controllers/pagosMPController');
const notificaciones = require('../controllers/notificacionesController');
const monitor = require('../controllers/monitorController');
const ofertas = require('../controllers/ofertasController');
const backup = require('../controllers/backupController');
const reportes = require('../controllers/reportesController');
const contacto = require('../controllers/contactoController');

// Auth (public)
router.post('/auth/login', auth.login);

// Public endpoints (no auth required)
router.get('/public/planes', planes.listar);
router.post('/public/contacto', contacto.enviar);
router.post('/public/inscripcion', upload.fields([{ name: 'dni_frente', maxCount: 1 }, { name: 'dni_dorso', maxCount: 1 }]), clientes.crear);
router.post('/public/registro', upload.fields([{ name: 'dni_frente', maxCount: 1 }, { name: 'dni_dorso', maxCount: 1 }]), clienteAuth.registro);
router.post('/public/login-cliente', clienteAuth.login);
router.get('/public/contrato/:id', contrato.descargar);
router.get('/public/configuracion', configuracion.obtener);
router.get('/public/ofertas', ofertas.listar);
router.post('/public/mp-webhook', pagosMP.webhook);

// Monitor — public ingest (frontend sends errors/vitals without admin token)
router.post('/monitor/errors', monitor.reportFrontendError);
router.post('/monitor/vitals', monitor.reportVitals);

// Client portal (cliente JWT)
router.get('/cliente/me', clienteAuthMiddleware, clienteAuth.me);
router.post('/cliente/logout', clienteAuthMiddleware, clienteAuth.logout);
router.put('/cliente/password', clienteAuthMiddleware, clienteAuth.cambiarPassword);
router.get('/cliente/contrato', clienteAuthMiddleware, clienteAuth.descargarContrato);
router.get('/cliente/facturas', clienteAuthMiddleware, pagosMP.listarFacturasCliente);
router.post('/cliente/pagar/:facturaId', clienteAuthMiddleware, pagosMP.iniciarPago);
router.get('/cliente/notificaciones', clienteAuthMiddleware, notificaciones.listarParaCliente);
router.post('/cliente/notificaciones/:id/leer', clienteAuthMiddleware, notificaciones.marcarLeida);

// Protected
router.use(authMiddleware);

router.get('/auth/me', auth.me);
router.put('/auth/password', auth.changePassword);

router.get('/dashboard/stats', dashboard.stats);

// Notificaciones (admin only)
router.get('/notificaciones', requireRole('admin'), notificaciones.listar);
router.post('/notificaciones', requireRole('admin'), notificaciones.enviar);
router.delete('/notificaciones/:id', requireRole('admin'), notificaciones.eliminar);

router.get('/clientes', clientes.listar);
router.get('/clientes/:id/sesiones', clientes.listarSesiones);
router.get('/clientes/:id', clientes.obtener);
const dniFields = upload.fields([{ name: 'dni_frente', maxCount: 1 }, { name: 'dni_dorso', maxCount: 1 }]);
router.post('/clientes', dniFields, clientes.crear);
router.put('/clientes/:id', dniFields, clientes.actualizar);
router.delete('/clientes/:id', clientes.eliminar);
router.patch('/clientes/:id/estado', clientes.cambiarEstado);

router.get('/planes', planes.listar);
router.get('/planes/:id', planes.obtener);
router.post('/planes', planes.crear);
router.put('/planes/:id', planes.actualizar);
router.delete('/planes/:id', planes.eliminar);

router.get('/conexiones', conexiones.listar);
router.get('/conexiones/:cliente_id', conexiones.obtenerPorCliente);
router.put('/conexiones/:cliente_id', conexiones.upsert);

router.post('/facturas/generar-mensual', facturas.generarMensual);
router.post('/facturas/generar-cliente/:clienteId', requireRole('admin'), facturas.generarParaCliente);
router.get('/facturas', facturas.listar);
router.get('/facturas/:id', facturas.obtener);
router.post('/facturas', facturas.crear);
router.patch('/facturas/:id/pago', facturas.registrarPago);

router.get('/equipos', equipos.listar);
router.post('/equipos', equipos.crear);
router.put('/equipos/:id', equipos.actualizar);
router.delete('/equipos/:id', equipos.eliminar);

router.get('/configuracion', configuracion.obtener);
router.put('/configuracion', configuracion.actualizar);
router.post('/configuracion/logo', requireRole('admin'), upload.single('logo'), configuracion.subirLogo);
router.delete('/configuracion/logo', requireRole('admin'), configuracion.eliminarLogo);

// Usuarios (admin only)
router.get('/usuarios', requireRole('admin'), usuarios.listar);
router.get('/usuarios/tecnicos', requireRole('admin'), usuarios.listarTecnicos);
router.post('/usuarios', requireRole('admin'), usuarios.crear);
router.put('/usuarios/:id', requireRole('admin'), usuarios.actualizar);
router.patch('/usuarios/:id/estado', requireRole('admin'), usuarios.cambiarEstado);
router.put('/usuarios/:id/password', requireRole('admin'), usuarios.resetPassword);

// Órdenes de trabajo (admin + tecnico)
router.get('/ordenes', requireAnyRole('admin', 'tecnico'), ordenes.listar);
router.get('/ordenes/:id', requireAnyRole('admin', 'tecnico'), ordenes.obtener);
router.post('/ordenes', requireRole('admin'), ordenes.crear);
router.put('/ordenes/:id', requireRole('admin'), ordenes.actualizar);
router.patch('/ordenes/:id/estado', requireAnyRole('admin', 'tecnico'), ordenes.cambiarEstado);

// Partes técnicos
router.post('/ordenes/:ordenId/parte', requireAnyRole('admin', 'tecnico'), partes.crear);
router.put('/partes/:id', requireAnyRole('admin', 'tecnico'), partes.actualizar);
router.patch('/partes/:id/submit', requireAnyRole('admin', 'tecnico'), partes.submit);
router.patch('/partes/:id/unlock', requireRole('admin'), partes.unlock);
router.post('/partes/:id/imagenes', requireAnyRole('admin', 'tecnico'), upload.array('imagenes', 10), partes.subirImagenes);
router.delete('/partes/:id/imagenes/:filename', requireAnyRole('admin', 'tecnico'), partes.eliminarImagen);

// Ofertas de instalación (admin)
router.get('/ofertas', requireRole('admin'), ofertas.listar);
router.post('/ofertas', requireRole('admin'), ofertas.crear);
router.put('/ofertas/:id', requireRole('admin'), ofertas.actualizar);
router.delete('/ofertas/:id', requireRole('admin'), ofertas.eliminar);

// Reportes (admin only)
router.get('/reportes/financiero', requireRole('admin'), reportes.financiero);
router.get('/reportes/clientes', requireRole('admin'), reportes.clientes);
router.get('/reportes/ordenes', requireRole('admin'), reportes.ordenes);
router.get('/reportes/red', requireRole('admin'), reportes.red);
router.get('/reportes/listados', requireRole('admin'), reportes.listados);

// Backup (admin only)
router.get('/backup/download', requireRole('admin'), backup.download);
router.post('/backup/save', requireRole('admin'), backup.save);
router.get('/backup/list', requireRole('admin'), backup.list);
router.get('/backup/server/:filename', requireRole('admin'), backup.downloadServer);
router.delete('/backup/server/:filename', requireRole('admin'), backup.deleteServer);
router.post('/backup/restore', requireRole('admin'), express.json({ limit: '100mb' }), backup.restore);
router.get('/backup/schedule', requireRole('admin'), backup.getSchedule);
router.post('/backup/schedule', requireRole('admin'), backup.setSchedule);

// Monitor — admin only
router.get('/monitor/summary',     requireRole('admin'), monitor.getSummary);
router.get('/monitor/requests',    requireRole('admin'), monitor.getRequestLogs);
router.get('/monitor/errors',      requireRole('admin'), monitor.getErrorLogs);
router.get('/monitor/audit',       requireRole('admin'), monitor.getAuditLogs);
router.get('/monitor/performance', requireRole('admin'), monitor.getPerformanceLogs);

module.exports = router;
