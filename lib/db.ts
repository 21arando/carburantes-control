// ============================================================================
// SERVICIO DE ACCESO A DATOS ESTRICTO (SOLO CONEXIÓN DIRECTA A SUPABASE)
// ============================================================================

export interface Empresa {
  id: number;
  nombre: string;
  nit: string;
  direccion: string;
  ciudad: string;
  contacto: string;
  alerta_stock_minimo_global: number;
  factor_holgura: number;
  cupo_base_nuevo: number;
  periodo_evaluacion_dias: number;
}

export interface Tanque {
  id: number;
  identificador: string;
  tipo_carburante: 'Gasolina' | 'Diésel';
  capacidad_maxima: number;
  stock_minimo_seguridad: number;
  stock_actual?: number; // Calculado dinámicamente
}

export interface Cliente {
  id: number;
  cedula_nit: string;
  nombre_razon_social: string;
  placa: string;
  tipo_cliente: 'Particular' | 'Transporte Público' | 'Empresa';
  estado: 'Activo' | 'Suspendido';
}

export interface Ingreso {
  id: number;
  tanque_id: number;
  litros: number;
  numero_factura_remision: string;
  fecha_hora: string;
}

export interface Venta {
  id: number;
  cliente_id: number;
  tanque_id: number;
  litros: number;
  cupo_semanal_calculado: number;
  factor_holgura_aplicado: number;
  fecha_hora: string;
}

// Configuración de URL y Llaves de Supabase
const POSTGREST_URL = process.env.NEXT_PUBLIC_POSTGREST_URL || '';
const POSTGREST_ANON_KEY = process.env.NEXT_PUBLIC_POSTGREST_ANON_KEY || '';

if (!POSTGREST_URL) {
  console.warn("La variable de entorno NEXT_PUBLIC_POSTGREST_URL no está definida.");
}

// Helper genérico para realizar peticiones HTTP a la API de Supabase (PostgREST)
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!POSTGREST_URL) {
    throw new Error("No se ha configurado la URL de Supabase. Verifique las variables de entorno.");
  }

  const url = `${POSTGREST_URL}${path}`;
  const headers = new Headers(options.headers || {});
  
  if (POSTGREST_ANON_KEY) {
    headers.set('apikey', POSTGREST_ANON_KEY);
    headers.set('Authorization', `Bearer ${POSTGREST_ANON_KEY}`);
  }
  
  headers.set('Content-Type', 'application/json');
  
  if (options.method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(options.method)) {
    headers.set('Prefer', 'return=representation');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error en API Supabase (${options.method || 'GET'} ${url}):`, errorText);
    throw new Error(errorText || `Error de servidor HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return [] as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// EXPORTACIÓN DE MÉTODOS DE LA BASE DE DATOS (ESTRICTO SUPABASE)
// ============================================================================

export const dbService = {
  // Flag para saber si se está usando mock
  isMockMode: async (): Promise<boolean> => {
    return false; // Nunca usar simulación local, modo estricto Supabase
  },

  // CONFIGURACIÓN DE LA EMPRESA
  getEmpresa: async (): Promise<Empresa> => {
    try {
      const data = await request<Empresa[]>('/empresa?limit=1');
      if (data && data.length > 0) return data[0];
      
      // Si la tabla de la empresa en Supabase está vacía, sembramos una por defecto
      const defaultEmpresa = {
        nombre: 'Arando Ramos Brayan Rodrigo Petrol',
        nit: '123456789-0',
        direccion: 'Av. Circunvalación #456',
        ciudad: 'Cochabamba',
        contacto: 'contacto@cjppetrol.com',
        alerta_stock_minimo_global: 15.00,
        factor_holgura: 10,
        cupo_base_nuevo: 150,
        periodo_evaluacion_dias: 28
      };
      
      const inserted = await request<Empresa[]>('/empresa', {
        method: 'POST',
        body: JSON.stringify(defaultEmpresa)
      });
      return inserted[0] || (defaultEmpresa as any);
    } catch (e) {
      console.error("Error al obtener la configuración de la empresa en Supabase:", e);
      throw e;
    }
  },

  updateEmpresa: async (empresa: Empresa): Promise<Empresa> => {
    try {
      const data = await request<Empresa[]>(`/empresa?id=eq.${empresa.id}`, {
        method: 'PATCH',
        body: JSON.stringify(empresa)
      });
      return data[0] || empresa;
    } catch (e) {
      console.error("Error al actualizar la empresa en Supabase:", e);
      throw e;
    }
  },

  // TANQUES DE DEPÓSITO
  getTanques: async (): Promise<Tanque[]> => {
    try {
      // Intentar obtener de la vista de stock en tiempo real si existe en Supabase
      try {
        const tanquesConStock = await request<Tanque[]>('/tanques_con_stock?order=id.asc');
        if (tanquesConStock && tanquesConStock.length > 0) {
          return tanquesConStock;
        }
      } catch (viewError) {
        console.warn("La vista /tanques_con_stock falló o no existe, calculando en JS:", viewError);
      }

      // Si la vista falla, hacemos el cálculo del stock sumando ingresos y restando ventas en JS
      const tanques = await request<Tanque[]>('/tanque?order=id.asc');
      const ingresos = await request<Ingreso[]>('/ingreso');
      const ventas = await request<Venta[]>('/venta');

      return tanques.map(t => {
        const sumIngresos = ingresos
          .filter(i => Number(i.tanque_id) === Number(t.id))
          .reduce((sum, i) => sum + Number(i.litros), 0);
        const sumVentas = ventas
          .filter(v => Number(v.tanque_id) === Number(t.id))
          .reduce((sum, v) => sum + Number(v.litros), 0);
        return {
          ...t,
          stock_actual: sumIngresos - sumVentas
        };
      });
    } catch (e) {
      console.error("Error al obtener tanques de Supabase:", e);
      throw e;
    }
  },

  createTanque: async (tanque: Omit<Tanque, 'id'>): Promise<Tanque> => {
    try {
      const data = await request<Tanque[]>('/tanque', {
        method: 'POST',
        body: JSON.stringify(tanque)
      });
      return data[0];
    } catch (e) {
      console.error("Error al crear el tanque en Supabase:", e);
      throw e;
    }
  },

  // GESTIÓN DE CLIENTES
  getClientes: async (): Promise<Cliente[]> => {
    try {
      return await request<Cliente[]>('/cliente?order=nombre_razon_social.asc');
    } catch (e) {
      console.error("Error al obtener clientes de Supabase:", e);
      throw e;
    }
  },

  createCliente: async (cliente: Omit<Cliente, 'id'>): Promise<Cliente> => {
    try {
      const data = await request<Cliente[]>('/cliente', {
        method: 'POST',
        body: JSON.stringify({
          ...cliente,
          placa: cliente.placa.toUpperCase().trim()
        })
      });
      return data[0];
    } catch (e) {
      console.error("Error al registrar cliente en Supabase:", e);
      throw e;
    }
  },

  updateClienteEstado: async (id: number, estado: 'Activo' | 'Suspendido'): Promise<Cliente | null> => {
    try {
      const data = await request<Cliente[]>(`/cliente?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado })
      });
      return data[0] || null;
    } catch (e) {
      console.error("Error al cambiar estado del cliente en Supabase:", e);
      throw e;
    }
  },

  getClienteByPlacaOrDoc: async (query: string): Promise<Cliente | null> => {
    const formattedQuery = query.trim().toUpperCase();
    if (!formattedQuery) return null;

    try {
      // Buscar por coincidencia exacta en placa o cédula en Supabase
      const data = await request<Cliente[]>(`/cliente?or=(placa.ilike.%25${formattedQuery}%25,cedula_nit.ilike.%25${formattedQuery}%25)&limit=1`);
      return data && data.length > 0 ? data[0] : null;
    } catch (e) {
      console.error("Error al buscar cliente en Supabase:", e);
      throw e;
    }
  },

  // TRANSACCIONES: INGRESOS (CISTERNAS)
  getIngresos: async (): Promise<Ingreso[]> => {
    try {
      return await request<Ingreso[]>('/ingreso?order=fecha_hora.desc');
    } catch (e) {
      console.error("Error al cargar los ingresos de Supabase:", e);
      throw e;
    }
  },

  createIngreso: async (ingreso: Omit<Ingreso, 'id'>): Promise<Ingreso> => {
    try {
      const data = await request<Ingreso[]>('/ingreso', {
        method: 'POST',
        body: JSON.stringify(ingreso)
      });
      return data[0];
    } catch (e) {
      console.error("Error al crear el ingreso en Supabase:", e);
      throw e;
    }
  },

  // TRANSACCIONES: VENTAS (SALIDAS)
  getVentas: async (): Promise<Venta[]> => {
    try {
      return await request<Venta[]>('/venta?order=fecha_hora.desc');
    } catch (e) {
      console.error("Error al cargar las ventas de Supabase:", e);
      throw e;
    }
  },

  createVenta: async (venta: Omit<Venta, 'id'>): Promise<Venta> => {
    try {
      const data = await request<Venta[]>('/venta', {
        method: 'POST',
        body: JSON.stringify(venta)
      });
      return data[0];
    } catch (e) {
      console.error("Error al registrar la venta en Supabase:", e);
      throw e;
    }
  },

  // ============================================================================
  // LÓGICA DE NEGOCIO: CALCULO DE CUPO SEMANAL DINÁMICO DESDE SUPABASE
  // ============================================================================
  calcularCupoSemanaldelCliente: async (clienteId: number): Promise<{
    promedioSemanal: number;
    holguraAplicada: number;
    cupoLimiPermitido: number;
    esClienteNuevo: boolean;
    diasEvaluados: number;
    litrosComprados: number;
  }> => {
    // 1. Obtener la configuración de la empresa en Supabase
    const config = await dbService.getEmpresa();
    const evaluationDays = config.periodo_evaluacion_dias || 28;
    const factorHolgura = config.factor_holgura || 10;
    const cupoBaseNuevo = config.cupo_base_nuevo || 150;

    // 2. Obtener todas las ventas del cliente en Supabase
    const ventasCliente = await request<Venta[]>(`/venta?cliente_id=eq.${clienteId}`);

    // 3. Filtrar ventas dentro del periodo retrospectivo
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - evaluationDays);

    const ventasPeriodo = ventasCliente.filter(v => {
      const fechaVenta = new Date(v.fecha_hora);
      return fechaVenta >= cutoffDate;
    });

    const totalLitrosComprados = ventasPeriodo.reduce((sum, v) => sum + Number(v.litros), 0);

    // 4. Determinar si es un Cliente Nuevo sin historial consolidado
    const esClienteNuevo = ventasCliente.length === 0;

    if (esClienteNuevo) {
      return {
        promedioSemanal: 0,
        holguraAplicada: factorHolgura,
        cupoLimiPermitido: Number(cupoBaseNuevo),
        esClienteNuevo: true,
        diasEvaluados: evaluationDays,
        litrosComprados: 0
      };
    }

    // 5. Cliente con historial:
    // P_s = (Total litros comprados en los últimos X días) / (Número de semanas evaluadas)
    const semanasEvaluadas = evaluationDays / 7;
    const promedioSemanal = totalLitrosComprados / semanasEvaluadas;
    
    // Límite = P_s + holgura = P_s * (1 + factor_holgura / 100)
    const cupoLimiPermitido = promedioSemanal * (1 + (factorHolgura / 100));

    return {
      promedioSemanal: Number(promedioSemanal.toFixed(2)),
      holguraAplicada: Number(factorHolgura),
      cupoLimiPermitido: Number(cupoLimiPermitido.toFixed(2)),
      esClienteNuevo: false,
      diasEvaluados: evaluationDays,
      litrosComprados: Number(totalLitrosComprados.toFixed(2))
    };
  }
};
