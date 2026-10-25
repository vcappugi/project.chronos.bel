-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- MÓDULO 1: SEGURIDAD, ROLES Y PERMISOS POR OBJETOS
--------------------------------------------------------------------------------

-- Tabla de Roles del Sistema
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Objetos del Sistema (Tablas, Vistas, Módulos o Componentes UI)
CREATE TABLE public.system_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_key VARCHAR(100) UNIQUE NOT NULL, -- Ej: 'proyectos', 'actividades', 'recursos'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Permisos de Roles sobre Objetos
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    object_id UUID NOT NULL REFERENCES public.system_objects(id) ON DELETE CASCADE,
    can_read BOOLEAN DEFAULT FALSE NOT NULL,
    can_write BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_role_object UNIQUE (role_id, object_id)
);

--------------------------------------------------------------------------------
-- MÓDULO 2: ACTORES Y VÍNCULO CON SUPABASE AUTH
--------------------------------------------------------------------------------

-- Tabla de Actores (Personas que participan en el sistema/proyectos)
CREATE TABLE public.actores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Vínculo opcional con auth de Supabase
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- MÓDULO 3: AUDITORÍA UNIVERSAL DE CAMBIOS
--------------------------------------------------------------------------------

-- Tabla para registrar inserciones, modificaciones y eliminaciones
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Función genérica para el Trigger de Auditoría
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id UUID;
    v_user_id UUID;
BEGIN
    -- Obtener el ID del usuario actual de Supabase si existe
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', NULL, v_new_data, v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', v_old_data, v_new_data, v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := OLD.id;
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', v_old_data, NULL, v_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- MÓDULO 4: GESTIÓN DE PROYECTOS, ACTIVIDADES Y RECURSOS
--------------------------------------------------------------------------------

-- Tabla de Proyectos
CREATE TABLE public.proyectos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'PLANIFICACION' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Recursos (Materiales, equipos, servicios, etc.)
CREATE TABLE public.recursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    unit_type VARCHAR(50) NOT NULL, -- Ej: 'HORA', 'UNIDAD', 'GLOBAL'
    unit_cost_usd NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Actividades (Asociadas a un Proyecto)
-- Permite manejar jerarquía o actividades independientes con peso y avance
CREATE TABLE public.actividades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    weight NUMERIC(5, 2) DEFAULT 1.00 NOT NULL, -- Ponderación para el cálculo global del proyecto
    progress_percentage NUMERIC(5, 2) DEFAULT 0.00 CHECK (progress_percentage BETWEEN 0 AND 100) NOT NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación: Actividades <-> Actores (Asignación de responsables/participantes)
CREATE TABLE public.actividad_actores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.actividades(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.actores(id) ON DELETE CASCADE,
    assigned_role VARCHAR(100), -- Rol específico en la actividad (ej. 'Ejecutor', 'Supervisor')
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_activity_actor UNIQUE (activity_id, actor_id)
);

-- Relación: Actividades <-> Recursos (Costos en dólares asociados)
CREATE TABLE public.actividad_recursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.actividades(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES public.recursos(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) DEFAULT 1.00 NOT NULL,
    unit_cost_usd_override NUMERIC(12, 2), -- Si el costo unitario difiere del valor base del recurso
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- MÓDULO 5: VISTAS Y FUNCIONES DE CÁLCULO (AVANCE Y GASTOS)
--------------------------------------------------------------------------------

-- Vista para calcular el costo total por actividad (Cantidad * Costo Unitario)
CREATE OR REPLACE VIEW public.vw_actividad_costos AS
SELECT 
    ar.activity_id,
    SUM(ar.quantity * COALESCE(ar.unit_cost_usd_override, r.unit_cost_usd)) AS total_cost_usd
FROM public.actividad_recursos ar
JOIN public.recursos r ON ar.resource_id = r.id
GROUP BY ar.activity_id;

-- Vista para el resumen consolidado de Proyectos (Avance ponderado y Gasto Total)
CREATE OR REPLACE VIEW public.vw_proyecto_resumen AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.status,
    -- Avance ponderado: Suma(Avance * Peso) / Suma(Pesos)
    COALESCE(
        SUM(a.progress_percentage * a.weight) / NULLIF(SUM(a.weight), 0), 
        0.00
    ) AS calculated_progress_percentage,
    -- Gasto total en dólares del proyecto sumando sus actividades
    COALESCE(SUM(c.total_cost_usd), 0.00) AS total_spent_usd
FROM public.proyectos p
LEFT JOIN public.actividades a ON p.id = a.project_id
LEFT JOIN public.vw_actividad_costos c ON a.id = c.activity_id
GROUP BY p.id, p.name, p.status;

--------------------------------------------------------------------------------
-- APLICAR TRIGGERS DE AUDITORÍA A LAS TABLAS PRINCIPALES
--------------------------------------------------------------------------------

CREATE TRIGGER tr_audit_roles AFTER INSERT OR UPDATE OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER tr_audit_system_objects AFTER INSERT OR UPDATE OR DELETE ON public.system_objects FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER tr_audit_role_permissions AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER tr_audit_actores AFTER INSERT OR UPDATE OR DELETE ON public.actores FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER tr_audit_proyectos AFTER INSERT OR UPDATE OR DELETE ON public.proyectos FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER tr_audit_recursos AFTER INSERT OR UPDATE OR DELETE ON public.recursos FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER tr_audit_actividades AFTER INSERT OR UPDATE OR DELETE ON public.actividades FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
CREATE TRIGGER tr_audit_actividad_recursos AFTER INSERT OR UPDATE OR DELETE ON public.actividad_recursos FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

--------------------------------------------------------------------------------
-- MÓDULO 6: ACCESO PÚBLICO A TODAS LAS TABLAS (ANON Y AUTHENTICATED)
--------------------------------------------------------------------------------

-- Deshabilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.actores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividad_actores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividad_recursos DISABLE ROW LEVEL SECURITY;

-- Otorgar todos los permisos sobre tablas, vistas y secuencias a roles públicos
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Permisos por defecto para futuras tablas o funciones
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated;