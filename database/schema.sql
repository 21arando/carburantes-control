-- ============================================================================
-- ESQUEMA DE BASE DE DATOS POSTGRESQL PARA EL CONTROL DE CARBURANTES
-- COMPATIBLE CON POSTGREST API
-- ============================================================================

-- Habilitar extensión pgcrypto para generación de UUIDs si es necesario (opcional)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla: empresa (Configuración global del sistema)
CREATE TABLE IF NOT EXISTS public.empresa (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL DEFAULT 'Arando Ramos Brayan Rodrigo Petrol',
    nit VARCHAR(50) NOT NULL DEFAULT '123456789-0',
    direccion VARCHAR(255) NOT NULL DEFAULT 'Av. Circunvalación #456',
    ciudad VARCHAR(100) NOT NULL DEFAULT 'Cochabamba',
    contacto VARCHAR(100) NOT NULL DEFAULT 'contacto@petrol.com',
    alerta_stock_minimo_global NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    factor_holgura NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    cupo_base_nuevo NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    periodo_evaluacion_dias INTEGER NOT NULL DEFAULT 28,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla de configuración inicial (Empresa única)
INSERT INTO public.empresa (id, nombre, nit, direccion, ciudad, contacto, alerta_stock_minimo_global, factor_holgura, cupo_base_nuevo, periodo_evaluacion_dias)
VALUES (1, 'Arando Ramos Brayan Rodrigo Petrol', '123456789-0', 'Av. Circunvalación #456', 'Cochabamba', 'contacto@petrol.com', 15.00, 10.00, 150.00, 28)
ON CONFLICT (id) DO NOTHING;


-- 2. Tabla: tanque (Gestión de Tanques de Depósito)
CREATE TABLE IF NOT EXISTS public.tanque (
    id SERIAL PRIMARY KEY,
    identificador VARCHAR(50) UNIQUE NOT NULL, -- Ej: Tanque T-01
    tipo_carburante VARCHAR(50) NOT NULL CHECK (tipo_carburante IN ('Gasolina', 'Diésel')),
    capacidad_maxima NUMERIC(10, 2) NOT NULL CHECK (capacidad_maxima > 0),
    stock_minimo_seguridad NUMERIC(10, 2) NOT NULL CHECK (stock_minimo_seguridad >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla de tanques iniciales
INSERT INTO public.tanque (identificador, tipo_carburante, capacidad_maxima, stock_minimo_seguridad) VALUES
('Tanque T-01 (Gasolina)', 'Gasolina', 10000.00, 1500.00),
('Tanque T-02 (Diésel)', 'Diésel', 15000.00, 2000.00)
ON CONFLICT (identificador) DO NOTHING;


-- 3. Tabla: cliente (Padrón de Clientes)
CREATE TABLE IF NOT EXISTS public.cliente (
    id SERIAL PRIMARY KEY,
    cedula_nit VARCHAR(50) UNIQUE NOT NULL,
    nombre_razon_social VARCHAR(255) NOT NULL,
    placa VARCHAR(20) UNIQUE NOT NULL, -- Relación obligatoria de vehículo para el control
    tipo_cliente VARCHAR(50) NOT NULL CHECK (tipo_cliente IN ('Particular', 'Transporte Público', 'Empresa')),
    estado VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Suspendido')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla de clientes iniciales
INSERT INTO public.cliente (cedula_nit, nombre_razon_social, placa, tipo_cliente, estado) VALUES
('10203040', 'Juan Pérez Solares', '2548-ABC', 'Particular', 'Activo'),
('20304050', 'Cooperativa Trans Valle', '1589-XYX', 'Transporte Público', 'Activo'),
('30405060', 'Constructora Delta S.A.', '3821-KLP', 'Empresa', 'Activo'),
('40506070', 'Carlos Villarroel', '4412-ZXC', 'Particular', 'Suspendido')
ON CONFLICT (cedula_nit) DO NOTHING;


-- 4. Tabla: ingreso (Registro de Ingresos / Cisternas)
CREATE TABLE IF NOT EXISTS public.ingreso (
    id SERIAL PRIMARY KEY,
    tanque_id INTEGER NOT NULL REFERENCES public.tanque(id) ON DELETE CASCADE,
    litros NUMERIC(10, 2) NOT NULL CHECK (litros > 0),
    numero_factura_remision VARCHAR(100) NOT NULL,
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla de ingresos iniciales (Para tener stock inicial)
INSERT INTO public.ingreso (tanque_id, litros, numero_factura_remision, fecha_hora) VALUES
(1, 8000.00, 'FAC-001-9981', NOW() - INTERVAL '5 days'),
(2, 12000.00, 'FAC-001-9982', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;


-- 5. Tabla: venta (Registro de Salidas / Ventas Controladas)
CREATE TABLE IF NOT EXISTS public.venta (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES public.cliente(id) ON DELETE CASCADE,
    tanque_id INTEGER NOT NULL REFERENCES public.tanque(id) ON DELETE CASCADE,
    litros NUMERIC(10, 2) NOT NULL CHECK (litros > 0),
    cupo_semanal_calculado NUMERIC(10, 2) NOT NULL, -- el cupo límite permitido al momento de la venta
    factor_holgura_aplicado NUMERIC(5, 2) NOT NULL,  -- holgura en porcentaje aplicada
    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla de ventas iniciales (Historial para probar algoritmo de cupos)
-- Cliente 1 (Juan Perez) ha comprado 300 litros repartidos en las últimas 3 semanas
INSERT INTO public.venta (cliente_id, tanque_id, litros, cupo_semanal_calculado, factor_holgura_aplicado, fecha_hora) VALUES
(1, 1, 100.00, 150.00, 10.00, NOW() - INTERVAL '21 days'),
(1, 1, 120.00, 110.00, 10.00, NOW() - INTERVAL '14 days'),
(1, 1, 80.00, 121.00, 10.00, NOW() - INTERVAL '7 days'),
-- Cliente 2 (Cooperativa Trans Valle) ha comprado bastante diésel
(2, 2, 400.00, 150.00, 10.00, NOW() - INTERVAL '20 days'),
(2, 2, 350.00, 440.00, 10.00, NOW() - INTERVAL '10 days'),
(2, 2, 450.00, 412.50, 10.00, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- VISTAS AUXILIARES PARA POSTGREST
-- ============================================================================

-- Vista para obtener el stock actual de cada tanque en tiempo real
CREATE OR REPLACE VIEW public.tanques_con_stock AS
SELECT 
    t.id,
    t.identificador,
    t.tipo_carburante,
    t.capacidad_maxima,
    t.stock_minimo_seguridad,
    COALESCE((SELECT SUM(i.litros) FROM public.ingreso i WHERE i.tanque_id = t.id), 0) -
    COALESCE((SELECT SUM(v.litros) FROM public.venta v WHERE v.tanque_id = t.id), 0) AS stock_actual,
    t.created_at,
    t.updated_at
FROM public.tanque t;
