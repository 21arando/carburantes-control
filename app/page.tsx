'use client';

import React, { useState, useEffect } from 'react';
import { dbService, Empresa, Tanque, Cliente, Ingreso, Venta } from '../lib/db';

export default function Dashboard() {
  // Estados de datos
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [tanques, setTanques] = useState<Tanque[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [dbMode, setDbMode] = useState<string>('Conectado a Supabase');
  const [loading, setLoading] = useState(true);

  // Navegación (Tabs)
  const [activeTab, setActiveTab] = useState<'despacho' | 'tanques' | 'ingresos' | 'clientes' | 'configuracion'>('despacho');

  // ==========================================
  // ESTADOS DE FORMULARIOS
  // ==========================================

  // 1. Nueva Venta / Despacho
  const [searchQuery, setSearchQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isNewCliente, setIsNewCliente] = useState(false);

  // Formulario nuevo cliente si no existe
  const [newCliNombre, setNewCliNombre] = useState('');
  const [newCliDoc, setNewCliDoc] = useState('');
  const [newCliPlaca, setNewCliPlaca] = useState('');
  const [newCliTipo, setNewCliTipo] = useState<'Particular' | 'Transporte Público' | 'Empresa'>('Particular');

  // Detalles de despacho
  const [despachoLitros, setDespachoLitros] = useState<number | ''>('');
  const [despachoTipoCarburante, setDespachoTipoCarburante] = useState<'Gasolina' | 'Diésel'>('Gasolina');
  const [despachoTanqueId, setDespachoTanqueId] = useState<number>(0);
  const [cupoCalculado, setCupoCalculado] = useState<{
    promedioSemanal: number;
    holguraAplicada: number;
    cupoLimiPermitido: number;
    esClienteNuevo: boolean;
    diasEvaluados: number;
    litrosComprados: number;
  } | null>(null);

  // Recibo de Venta Exitosa
  const [showReceipt, setShowReceipt] = useState(false);
  const [ultimoRecibo, setUltimoRecibo] = useState<{
    nroFactura: string;
    cliente: string;
    placa: string;
    litros: number;
    tipoCarburante: string;
    tanque: string;
    cupoLimiPermitido: number;
    fecha: string;
  } | null>(null);

  // 2. Nuevo Tanque
  const [nuevoTanqueIdentificador, setNuevoTanqueIdentificador] = useState('');
  const [nuevoTanqueTipo, setNuevoTanqueTipo] = useState<'Gasolina' | 'Diésel'>('Gasolina');
  const [nuevoTanqueCapacidad, setNuevoTanqueCapacidad] = useState<number | ''>('');
  const [nuevoTanqueMinimo, setNuevoTanqueMinimo] = useState<number | ''>('');

  // 3. Nuevo Ingreso
  const [nuevoIngresoTanqueId, setNuevoIngresoTanqueId] = useState<number>(0);
  const [nuevoIngresoLitros, setNuevoIngresoLitros] = useState<number | ''>('');
  const [nuevoIngresoFactura, setNuevoIngresoFactura] = useState('');

  // 4. Configuración Empresa
  const [configNombre, setConfigNombre] = useState('');
  const [configNit, setConfigNit] = useState('');
  const [configDireccion, setConfigDireccion] = useState('');
  const [configCiudad, setConfigCiudad] = useState('');
  const [configContacto, setConfigContacto] = useState('');
  const [configHolgura, setConfigHolgura] = useState<number>(10);
  const [configCupoNuevo, setConfigCupoNuevo] = useState<number>(150);
  const [configPeriodo, setConfigPeriodo] = useState<number>(28);
  const [configAlertaGlobal, setConfigAlertaGlobal] = useState<number>(1000);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // ==========================================
  // CARGA DE DATOS Y ENLACES
  // ==========================================

  const loadAllData = async () => {
    try {
      setDbMode('Supabase (Producción)');

      const emp = await dbService.getEmpresa();
      setEmpresa(emp);

      // Llenar formulario de configuracion con valores de la empresa
      setConfigNombre(emp.nombre);
      setConfigNit(emp.nit);
      setConfigDireccion(emp.direccion);
      setConfigCiudad(emp.ciudad);
      setConfigContacto(emp.contacto);
      setConfigHolgura(emp.factor_holgura);
      setConfigCupoNuevo(emp.cupo_base_nuevo);
      setConfigPeriodo(emp.periodo_evaluacion_dias);
      setConfigAlertaGlobal(emp.alerta_stock_minimo_global);

      const tkList = await dbService.getTanques();
      setTanques(tkList);
      if (tkList.length > 0) {
        setDespachoTanqueId(tkList[0].id);
        setNuevoIngresoTanqueId(tkList[0].id);
      }

      const clList = await dbService.getClientes();
      setClientes(clList);

      const ingList = await dbService.getIngresos();
      setIngresos(ingList);

      const vntList = await dbService.getVentas();
      setVentas(vntList);
    } catch (e) {
      console.error("Error al cargar los datos del sistema:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ==========================================
  // MÓDULO A: CONFIGURACIÓN DE EMPRESA
  // ==========================================
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) return;

    const updatedEmpresa: Empresa = {
      ...empresa,
      nombre: configNombre,
      nit: configNit,
      direccion: configDireccion,
      ciudad: configCiudad,
      contacto: configContacto,
      factor_holgura: Number(configHolgura),
      cupo_base_nuevo: Number(configCupoNuevo),
      periodo_evaluacion_dias: Number(configPeriodo),
      alerta_stock_minimo_global: Number(configAlertaGlobal),
    };

    const result = await dbService.updateEmpresa(updatedEmpresa);
    setEmpresa(result);
    setConfigSaveSuccess(true);
    setTimeout(() => setConfigSaveSuccess(false), 3000);
    loadAllData();
  };

  // ==========================================
  // MÓDULO B: TANQUES DE DEPÓSITO
  // ==========================================
  const handleCreateTanque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTanqueIdentificador || !nuevoTanqueCapacidad || !nuevoTanqueMinimo) return;

    await dbService.createTanque({
      identificador: nuevoTanqueIdentificador,
      tipo_carburante: nuevoTanqueTipo,
      capacidad_maxima: Number(nuevoTanqueCapacidad),
      stock_minimo_seguridad: Number(nuevoTanqueMinimo),
    });

    setNuevoTanqueIdentificador('');
    setNuevoTanqueCapacidad('');
    setNuevoTanqueMinimo('');
    loadAllData();
  };

  // ==========================================
  // MÓDULO C: CLIENTES
  // ==========================================
  const handleToggleClienteEstado = async (id: number, currentEstado: 'Activo' | 'Suspendido') => {
    const nuevoEstado = currentEstado === 'Activo' ? 'Suspendido' : 'Activo';
    await dbService.updateClienteEstado(id, nuevoEstado);
    loadAllData();

    // Si el cliente seleccionado actualmente es el modificado, actualizar su estado
    if (selectedCliente && selectedCliente.id === id) {
      setSelectedCliente(prev => prev ? { ...prev, estado: nuevoEstado } : null);
    }
  };

  // ==========================================
  // MÓDULO D: TRANSACCIONES (INGRESOS & VENTAS)
  // ==========================================

  // Registro de Ingresos
  const handleCreateIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoIngresoTanqueId || !nuevoIngresoLitros || !nuevoIngresoFactura) return;

    await dbService.createIngreso({
      tanque_id: Number(nuevoIngresoTanqueId),
      litros: Number(nuevoIngresoLitros),
      numero_factura_remision: nuevoIngresoFactura,
      fecha_hora: new Date().toISOString(),
    });

    setNuevoIngresoLitros('');
    setNuevoIngresoFactura('');
    loadAllData();
  };

  // Registro de Ventas - Flujo Operativo Estricto

  // 1. Búsqueda de Cliente por Placa o Documento
  const handleSearchCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const cliente = await dbService.getClienteByPlacaOrDoc(searchQuery);
    setSearched(true);
    setDespachoLitros('');

    if (cliente) {
      setSelectedCliente(cliente);
      setIsNewCliente(false);
      // Calcular el cupo semanal dinámico
      const cupo = await dbService.calcularCupoSemanaldelCliente(cliente.id);
      setCupoCalculado(cupo);
    } else {
      // Si el cliente no está registrado, se activará el formulario para guardado automático
      setSelectedCliente(null);
      setIsNewCliente(true);
      setCupoCalculado(null);
      // Auto rellenar placa o cédula dependiendo de lo ingresado en la búsqueda
      const isPlaca = /^[0-9]+-[A-Z]+$/i.test(searchQuery.trim()) || searchQuery.includes('-');
      if (isPlaca) {
        setNewCliPlaca(searchQuery.toUpperCase());
        setNewCliDoc('');
      } else {
        setNewCliDoc(searchQuery);
        setNewCliPlaca('');
      }
      setNewCliNombre('');
    }
  };

  // 2. Registro de Cliente Nuevo durante la venta (Auto-save)
  const handleRegisterAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCliNombre || !newCliDoc || !newCliPlaca) return;

    const newCliente = await dbService.createCliente({
      nombre_razon_social: newCliNombre,
      cedula_nit: newCliDoc,
      placa: newCliPlaca.toUpperCase(),
      tipo_cliente: newCliTipo,
      estado: 'Activo'
    });

    // Cargar como cliente seleccionado
    setSelectedCliente(newCliente);
    setIsNewCliente(false);

    // Obtener su cupo base inmediatamente
    const cupo = await dbService.calcularCupoSemanaldelCliente(newCliente.id);
    setCupoCalculado(cupo);

    // Refrescar lista de clientes global
    loadAllData();
  };

  // 3. Selección del tanque de despacho compatible
  const tanquesCompatibles = tanques.filter(t => t.tipo_carburante === despachoTipoCarburante);

  // Asegurar que el tanque seleccionado sea compatible cuando cambia el tipo de carburante
  useEffect(() => {
    if (tanquesCompatibles.length > 0) {
      const actualCompatible = tanquesCompatibles.find(t => t.id === despachoTanqueId);
      if (!actualCompatible) {
        setDespachoTanqueId(tanquesCompatibles[0].id);
      }
    } else {
      setDespachoTanqueId(0);
    }
  }, [despachoTipoCarburante, tanques]);

  const tanqueSeleccionado = tanques.find(t => t.id === despachoTanqueId);

  // 4. Validaciones en tiempo real para Despacho
  const cupoMaximo = cupoCalculado ? cupoCalculado.cupoLimiPermitido : 0;
  const litrosADespachar = Number(despachoLitros) || 0;

  const excedeCupo = litrosADespachar > cupoMaximo;
  const stockInsuficiente = tanqueSeleccionado ? litrosADespachar > (tanqueSeleccionado.stock_actual || 0) : true;

  const isDisabledProcesar =
    !selectedCliente ||
    selectedCliente.estado === 'Suspendido' ||
    litrosADespachar <= 0 ||
    excedeCupo ||
    stockInsuficiente ||
    !tanqueSeleccionado;

  // Botón rápido para ajustar cantidad al cupo límite permitido
  const handleAjustarAlLimite = () => {
    if (cupoCalculado) {
      setDespachoLitros(cupoCalculado.cupoLimiPermitido);
    }
  };

  // 5. Procesar Despacho
  const handleProcesarDespacho = async () => {
    if (isDisabledProcesar || !selectedCliente || !tanqueSeleccionado || !cupoCalculado) return;

    const ventaData = {
      cliente_id: selectedCliente.id,
      tanque_id: tanqueSeleccionado.id,
      litros: Number(despachoLitros),
      cupo_semanal_calculado: cupoCalculado.cupoLimiPermitido,
      factor_holgura_aplicado: cupoCalculado.holguraAplicada,
      fecha_hora: new Date().toISOString()
    };

    const ventaRealizada = await dbService.createVenta(ventaData);

    // Preparar el comprobante
    setUltimoRecibo({
      nroFactura: `Arando Ramos Brayan Rodrigo-${String(ventaRealizada.id || Date.now()).padStart(6, '0')}`,
      cliente: selectedCliente.nombre_razon_social,
      placa: selectedCliente.placa,
      litros: Number(despachoLitros),
      tipoCarburante: despachoTipoCarburante,
      tanque: tanqueSeleccionado.identificador,
      cupoLimiPermitido: cupoCalculado.cupoLimiPermitido,
      fecha: new Date().toLocaleString()
    });

    setShowReceipt(true);

    // Limpiar estados de despacho
    setSearchQuery('');
    setSearched(false);
    setSelectedCliente(null);
    setDespachoLitros('');
    setCupoCalculado(null);

    // Recargar datos para actualizar stock del tanque y promedio del cliente
    loadAllData();
  };

  // ==========================================
  // ESTADÍSTICAS DEL COMPONENTE SUPERIOR
  // ==========================================
  const totalLitrosVendidos = ventas.reduce((sum, v) => sum + Number(v.litros), 0);
  const tanquesEnAlerta = tanques.filter(t => (t.stock_actual || 0) < t.stock_minimo_seguridad);
  const totalClientes = clientes.length;

  return (
    <div className="flex flex-col flex-1 min-h-screen text-slate-900 bg-slate-50 font-sans">

      {/* HEADER DE LA ESTACIÓN */}
      <header className="sticky top-0 z-40 bg-brand-blue-dark text-white border-b border-brand-orange-pure/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              {/* Icono de Dispensador de Gasolina */}
              <div className="p-2.5 bg-brand-orange-pure rounded-xl shadow-md shadow-brand-orange-pure/20 animate-pulse">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight font-display text-gradient-orange bg-clip-text text-transparent">
                  {empresa?.nombre || 'Arando Ramos Brayan Rodrigo Petrol'}
                </h1>
                <p className="text-xs text-brand-blue-sky font-medium tracking-wide">
                  SISTEMA DE CONTROL DE CARBURANTES
                </p>
              </div>
            </div>

            {/* Base de Datos Badge */}
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-brand-blue-deep/60 rounded-full border border-white/10 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${dbMode === 'PostgREST API' ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-amber-400 shadow-lg shadow-amber-400/50'}`}></span>
              <span className="font-semibold text-slate-300">BD: <span className="text-white">{dbMode}</span></span>
            </div>
          </div>
        </div>
      </header>

      {/* SUBNAV / SELECTOR DE PESTAÑAS */}
      <div className="bg-white border-b border-slate-200/80 sticky top-20 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto space-x-1 py-3 -mb-px">

            <button
              onClick={() => { setActiveTab('despacho'); loadAllData(); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 ${activeTab === 'despacho'
                  ? 'bg-brand-blue-deep text-white shadow-md shadow-brand-blue-deep/15'
                  : 'text-slate-600 hover:text-brand-blue-deep hover:bg-slate-100'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Nueva Venta (Despacho)
            </button>

            <button
              onClick={() => { setActiveTab('tanques'); loadAllData(); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 ${activeTab === 'tanques'
                  ? 'bg-brand-blue-deep text-white shadow-md shadow-brand-blue-deep/15'
                  : 'text-slate-600 hover:text-brand-blue-deep hover:bg-slate-100'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Tanques de Depósito
            </button>

            <button
              onClick={() => { setActiveTab('ingresos'); loadAllData(); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 ${activeTab === 'ingresos'
                  ? 'bg-brand-blue-deep text-white shadow-md shadow-brand-blue-deep/15'
                  : 'text-slate-600 hover:text-brand-blue-deep hover:bg-slate-100'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Reabastecimiento (Ingresos)
            </button>

            <button
              onClick={() => { setActiveTab('clientes'); loadAllData(); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 ${activeTab === 'clientes'
                  ? 'bg-brand-blue-deep text-white shadow-md shadow-brand-blue-deep/15'
                  : 'text-slate-600 hover:text-brand-blue-deep hover:bg-slate-100'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Clientes
            </button>

            <button
              onClick={() => { setActiveTab('configuracion'); loadAllData(); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 ${activeTab === 'configuracion'
                  ? 'bg-brand-blue-deep text-white shadow-md shadow-brand-blue-deep/15'
                  : 'text-slate-600 hover:text-brand-blue-deep hover:bg-slate-100'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Configuración General
            </button>

          </div>
        </div>
      </div>

      {/* CUERPO DEL CONTENIDO */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">

        {/* INDICADORES DEL PANEL SUPERIOR */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-4 border-l-brand-blue-deep">
            <div className="p-3 bg-brand-blue-sky rounded-xl text-brand-blue-deep">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Despachado Total</span>
              <span className="text-2xl font-bold font-display text-brand-blue-dark">{totalLitrosVendidos.toFixed(1)} L</span>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-4 border-l-brand-orange-pure">
            <div className="p-3 bg-brand-orange-light rounded-xl text-brand-orange-pure">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Ventas Realizadas</span>
              <span className="text-2xl font-bold font-display text-brand-blue-dark">{ventas.length} Trans.</span>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-4 border-l-amber-500">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tanques en Alerta</span>
              <span className="text-2xl font-bold font-display text-brand-blue-dark">
                {tanquesEnAlerta.length > 0 ? (
                  <span className="text-brand-orange-deep font-extrabold animate-pulse">{tanquesEnAlerta.length} Críticos</span>
                ) : (
                  <span className="text-emerald-600 font-semibold">0 Críticos</span>
                )}
              </span>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex items-center gap-4 border-l-4 border-l-indigo-600">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Clientes Registrados</span>
              <span className="text-2xl font-bold font-display text-brand-blue-dark">{totalClientes} Clientes</span>
            </div>
          </div>

        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-brand-blue-deep border-t-brand-orange-pure rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-slate-500">Cargando base de datos...</p>
          </div>
        ) : (
          <>
            {/* ================================================================= */}
            {/* INICIO DE PESTAÑA: DESPACHO / NUEVA VENTA */}
            {/* ================================================================= */}
            {activeTab === 'despacho' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LADO IZQUIERDO: BÚSQUEDA / REGISTRO DE CLIENTE */}
                <div className="lg:col-span-5 flex flex-col gap-6">

                  {/* CARD DE BÚSQUEDA */}
                  <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      Identificación del Vehículo
                    </h2>

                    <form onSubmit={handleSearchCliente} className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id="search_plate_doc"
                          type="text"
                          required
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Ingrese Placa o Cédula/NIT..."
                          className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-slate-50 uppercase font-semibold text-slate-800"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => { setSearchQuery(''); setSearched(false); setSelectedCliente(null); setIsNewCliente(false); }}
                            className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="px-6 bg-brand-blue-deep hover:bg-brand-blue-medium text-white font-semibold rounded-xl transition-all shadow-md active:scale-95"
                      >
                        Buscar
                      </button>
                    </form>

                    <p className="text-xs text-slate-500 mt-3">
                      * El sistema buscará coincidencias exactas o parciales. Si el cliente no existe, se iniciará el guardado automático.
                    </p>
                  </div>

                  {/* FORMULARIO AUTOMÁTICO DE CLIENTE NUEVO */}
                  {isNewCliente && (
                    <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-brand-orange-pure bg-gradient-to-br from-white to-orange-50/20">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-0.5 bg-brand-orange-pure text-white text-xs font-bold rounded-full uppercase tracking-wider animate-pulse">
                          Nuevo
                        </span>
                        <h3 className="text-md font-bold text-brand-blue-dark">Registrar Cliente Automático</h3>
                      </div>

                      <p className="text-xs text-slate-600 mb-4">
                        El vehículo/cliente no se encuentra registrado en el padrón. Complete los siguientes datos para guardarlo automáticamente y habilitar el cupo base.
                      </p>

                      <form onSubmit={handleRegisterAndContinue} className="flex flex-col gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Placa del Vehículo</label>
                          <input
                            type="text"
                            required
                            value={newCliPlaca}
                            onChange={(e) => setNewCliPlaca(e.target.value)}
                            placeholder="Ej. 1234-ABC"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white uppercase font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Documento de Identidad / NIT</label>
                          <input
                            type="text"
                            required
                            value={newCliDoc}
                            onChange={(e) => setNewCliDoc(e.target.value)}
                            placeholder="Cédula de Identidad o Identificación Tributaria"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-semibold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Nombre Completo o Razón Social</label>
                          <input
                            type="text"
                            required
                            value={newCliNombre}
                            onChange={(e) => setNewCliNombre(e.target.value)}
                            placeholder="Ej. Juan Pérez o Delta S.R.L."
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-semibold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Tipo de Cliente</label>
                          <select
                            value={newCliTipo}
                            onChange={(e) => setNewCliTipo(e.target.value as any)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                          >
                            <option value="Particular">Particular</option>
                            <option value="Transporte Público">Transporte Público</option>
                            <option value="Empresa">Empresa</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 bg-gradient-orange text-white font-bold rounded-xl transition-all shadow-md hover:brightness-105 active:scale-98"
                        >
                          Registrar y Habilitar Despacho
                        </button>
                      </form>
                    </div>
                  )}

                  {/* INFORMACIÓN DEL CLIENTE ENCONTRADO */}
                  {selectedCliente && (
                    <div className={`glass-panel p-6 rounded-2xl border-l-4 ${selectedCliente.estado === 'Suspendido' ? 'border-l-red-500 bg-red-50/10' : 'border-l-brand-blue-deep bg-white'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold font-display text-brand-blue-dark">
                            {selectedCliente.nombre_razon_social}
                          </h3>
                          <span className="text-xs font-medium text-slate-500">
                            Doc: {selectedCliente.cedula_nit} | Placa: <span className="font-bold text-brand-blue-deep">{selectedCliente.placa}</span>
                          </span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${selectedCliente.estado === 'Suspendido'
                            ? 'bg-red-100 text-red-700 animate-pulse'
                            : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          {selectedCliente.estado}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 py-3 border-t border-slate-100">
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Tipo Cliente</span>
                          <span className="text-sm font-bold text-slate-700">{selectedCliente.tipo_cliente}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Límite Establecido</span>
                          <span className="text-sm font-bold text-brand-orange-deep">{cupoCalculado?.esClienteNuevo ? 'Cupo Base (Nuevo)' : 'Cupo Dinámico'}</span>
                        </div>
                      </div>

                      {/* INFORMACIÓN DE CUPO CALCULADO */}
                      {cupoCalculado && selectedCliente.estado !== 'Suspendido' && (
                        <div className="mt-4 p-4 bg-brand-blue-sky/40 border border-brand-blue-deep/10 rounded-xl">
                          <h4 className="text-xs font-bold text-brand-blue-deep uppercase tracking-wider mb-2">Resumen de Consumo Semanal</h4>
                          <div className="flex flex-col gap-2">

                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">Promedio Semanal (Ps):</span>
                              <span className="font-bold text-slate-800">{cupoCalculado.promedioSemanal} L</span>
                            </div>

                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">Factor de Holgura (+):</span>
                              <span className="font-bold text-brand-orange-deep">+{cupoCalculado.holguraAplicada}%</span>
                            </div>

                            <div className="flex justify-between text-xs py-1.5 border-t border-brand-blue-deep/15">
                              <span className="text-slate-800 font-bold">Límite Permitido esta Semana:</span>
                              <span className="font-extrabold text-brand-blue-deep text-sm">{cupoCalculado.cupoLimiPermitido} Litros</span>
                            </div>

                            {cupoCalculado.esClienteNuevo && (
                              <div className="mt-1 px-2.5 py-1 bg-brand-orange-light text-brand-orange-deep rounded-lg text-[10px] font-bold text-center">
                                Excepción: Cliente nuevo. Sin historial previo.
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {selectedCliente.estado === 'Suspendido' && (
                        <div className="mt-4 p-4 bg-red-100 border border-red-200 rounded-xl text-center">
                          <p className="text-red-700 font-bold text-xs uppercase tracking-wider">
                            TRANSACCIÓN BLOQUEADA
                          </p>
                          <p className="text-red-600 text-[11px] mt-1">
                            Este cliente está suspendido por la administración de la estación de servicio.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PANELES VACÍOS DE BÚSQUEDA */}
                  {!searched && (
                    <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                      <div className="p-3 bg-brand-blue-sky rounded-full text-brand-blue-deep mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <h4 className="text-sm font-bold text-slate-700">Esperando Identificación</h4>
                      <p className="text-xs text-slate-500 max-w-xs mt-1">
                        Ingrese la placa del vehículo o documento del cliente para realizar el despacho y la validación de cupos.
                      </p>
                    </div>
                  )}

                </div>

                {/* LADO DERECHO: DISPENSADOR / PROCESAMIENTO DE DESPACHO */}
                <div className="lg:col-span-7 flex flex-col gap-6">

                  {/* FORMULARIO DE DESPACHO */}
                  <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
                    {/* Background glow si el dispensador está habilitado */}
                    {selectedCliente && selectedCliente.estado !== 'Suspendido' && (
                      <div className="absolute right-0 top-0 w-24 h-24 bg-brand-orange-pure/5 rounded-full blur-3xl"></div>
                    )}

                    <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                      Panel de Control de Bombas
                    </h2>

                    <div className="flex flex-col gap-5">

                      {/* TIPO DE CARBURANTE */}
                      <div>
                        <span className="block text-xs font-bold text-slate-600 uppercase mb-2">1. Seleccione Combustible</span>
                        <div className="grid grid-cols-2 gap-4">

                          <button
                            type="button"
                            onClick={() => setDespachoTipoCarburante('Gasolina')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${despachoTipoCarburante === 'Gasolina'
                                ? 'bg-gradient-premium text-white border-brand-blue-deep shadow-md'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-brand-blue-deep/30'
                              }`}
                          >
                            <span className="text-lg font-extrabold font-display">GASOLINA</span>
                            <span className="text-[10px] mt-1 opacity-80">Super / Especial</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDespachoTipoCarburante('Diésel')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${despachoTipoCarburante === 'Diésel'
                                ? 'bg-gradient-premium text-white border-brand-blue-deep shadow-md'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-brand-blue-deep/30'
                              }`}
                          >
                            <span className="text-lg font-extrabold font-display">DIÉSEL</span>
                            <span className="text-[10px] mt-1 opacity-80">Alto Rendimiento</span>
                          </button>

                        </div>
                      </div>

                      {/* TANQUE DE ORIGEN */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-2">2. Seleccione Tanque de Depósito</label>
                        {tanquesCompatibles.length === 0 ? (
                          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                            No hay tanques registrados para este tipo de combustible. Agregue uno en la pestaña de Tanques.
                          </div>
                        ) : (
                          <select
                            value={despachoTanqueId}
                            onChange={(e) => setDespachoTanqueId(Number(e.target.value))}
                            className="w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white text-slate-800 font-semibold"
                          >
                            {tanquesCompatibles.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.identificador} (Disponible: {t.stock_actual?.toFixed(1)} L / Capacidad: {t.capacidad_maxima} L)
                              </option>
                            ))}
                          </select>
                        )}

                        {tanqueSeleccionado && (tanqueSeleccionado.stock_actual || 0) < tanqueSeleccionado.stock_minimo_seguridad && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-orange-deep font-bold animate-pulse">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            ¡ALERTA DE SEGURIDAD! El tanque está por debajo del stock mínimo.
                          </div>
                        )}
                      </div>

                      {/* CANTIDAD A DESPACHAR */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-xs font-bold text-slate-600 uppercase">3. Litros a Despachar</label>
                          {cupoCalculado && (
                            <span className="text-xs font-semibold text-brand-blue-deep">
                              Cupo máximo disponible: <span className="font-extrabold">{cupoCalculado.cupoLimiPermitido} L</span>
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            id="dispatch_liters_input"
                            type="number"
                            step="0.01"
                            disabled={!selectedCliente || selectedCliente.estado === 'Suspendido'}
                            value={despachoLitros}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDespachoLitros(val === '' ? '' : Number(val));
                            }}
                            placeholder={selectedCliente ? "Ingrese cantidad en litros..." : "Primero identifique un cliente..."}
                            className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed text-lg font-bold text-slate-800"
                          />
                          <span className="absolute right-4 top-3.5 text-slate-500 font-bold text-sm">LITROS</span>
                        </div>

                        {/* MENSAJES DE ERROR EN TIEMPO REAL */}
                        {selectedCliente && (
                          <div className="mt-2.5 flex flex-col gap-2">

                            {/* Alerta de exceso de cupo */}
                            {excedeCupo && (
                              <div className="p-3 bg-brand-orange-light border border-brand-orange-pure/30 rounded-xl flex items-center justify-between text-xs text-brand-orange-dark font-bold pulse-orange-glow">
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-5 h-5 text-brand-orange-pure shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                  <span>Excede el cupo semanal permitido por {(litrosADespachar - cupoMaximo).toFixed(1)} L.</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAjustarAlLimite}
                                  className="px-3 py-1 bg-brand-orange-pure hover:bg-brand-orange-deep text-white rounded-lg text-[10px] font-extrabold uppercase shadow transition-all"
                                >
                                  Ajustar a Límite
                                </button>
                              </div>
                            )}

                            {/* Alerta de stock insuficiente en el tanque */}
                            {stockInsuficiente && litrosADespachar > 0 && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5 text-xs text-red-700 font-bold">
                                <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                <span>El tanque seleccionado no tiene suficiente combustible disponible ({tanqueSeleccionado?.stock_actual?.toFixed(1) || 0} L libres).</span>
                              </div>
                            )}

                          </div>
                        )}
                      </div>

                      {/* PROCESAR DESPACHO */}
                      <button
                        type="button"
                        onClick={handleProcesarDespacho}
                        disabled={isDisabledProcesar}
                        className={`w-full py-4 rounded-xl text-white font-extrabold tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${isDisabledProcesar
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                            : 'bg-brand-blue-deep hover:bg-brand-blue-medium active:scale-98 shadow-brand-blue-deep/20'
                          }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        PROCESAR DESPACHO
                      </button>

                    </div>
                  </div>

                  {/* RECIBO DE COMPROBANTE DE VENTA */}
                  {showReceipt && ultimoRecibo && (
                    <div className="glass-panel p-6 rounded-2xl border border-brand-orange-pure/30 bg-gradient-to-br from-white to-brand-blue-sky/10 animate-fade-in relative">
                      <button
                        onClick={() => setShowReceipt(false)}
                        className="absolute right-4 top-4 p-1 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>

                      <div className="flex flex-col items-center border-b border-dashed border-slate-200 pb-4 text-center">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-lg font-extrabold text-brand-blue-dark font-display">¡Despacho Autorizado y Guardado!</h3>
                        <p className="text-xs text-slate-500">Comprobante de Salida de Combustible</p>
                      </div>

                      <div className="py-4 flex flex-col gap-2.5 text-xs text-slate-700">
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Estación:</span>
                          <span className="font-bold text-brand-blue-dark">{empresa?.nombre || 'Arando Ramos Brayan Rodrigo Petrol'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Factura/Remisión Interna:</span>
                          <span className="font-mono font-bold text-slate-800">{ultimoRecibo.nroFactura}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Fecha/Hora:</span>
                          <span className="font-medium text-slate-800">{ultimoRecibo.fecha}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Cliente Razón Social:</span>
                          <span className="font-bold text-slate-800">{ultimoRecibo.cliente}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Placa Autorizada:</span>
                          <span className="px-2 py-0.5 bg-brand-blue-sky rounded text-brand-blue-deep font-bold">{ultimoRecibo.placa}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Tipo de Carburante:</span>
                          <span className="font-bold text-slate-800">{ultimoRecibo.tipoCarburante}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-500">Tanque Surtidor:</span>
                          <span className="font-semibold text-slate-800">{ultimoRecibo.tanque}</span>
                        </div>

                        <div className="flex justify-between py-2 border-t border-dashed border-slate-200 mt-2 text-sm">
                          <span className="font-bold text-brand-blue-dark">Litros Despachados:</span>
                          <span className="font-extrabold text-brand-orange-deep text-base">{ultimoRecibo.litros.toFixed(2)} Litros</span>
                        </div>
                      </div>

                      <div className="pt-2 text-center text-[10px] text-slate-400">
                        Gracias por confiar en {empresa?.nombre || 'Arando Ramos Brayan Rodrigo Petrol'}. Despacho controlado digitalmente.
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* ================================================================= */}
            {/* FIN DE PESTAÑA: DESPACHO */}
            {/* ================================================================= */}


            {/* ================================================================= */}
            {/* INICIO DE PESTAÑA: TANQUES DE DEPÓSITO */}
            {/* ================================================================= */}
            {activeTab === 'tanques' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LISTADO DE TANQUES */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                  <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-6 flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                      Infraestructura y Depósitos Virtuales
                    </h2>

                    {tanques.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        No hay tanques registrados actualmente en el sistema. Utilice el panel lateral para agregar uno.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {tanques.map(t => {
                          const stock = t.stock_actual || 0;
                          const perc = Math.min(100, Math.max(0, (stock / t.capacidad_maxima) * 100));
                          const stockCritico = stock < t.stock_minimo_seguridad;

                          // Color de barra dependiendo de su nivel de combustible
                          let progressColor = 'bg-brand-blue-deep';
                          if (stockCritico) progressColor = 'bg-gradient-orange pulse-orange-glow';
                          else if (perc < 30) progressColor = 'bg-amber-500';

                          return (
                            <div key={t.id} className={`p-5 rounded-2xl border transition-all hover:shadow-md ${stockCritico
                                ? 'bg-red-50/15 border-red-200/50'
                                : 'bg-white border-slate-100'
                              }`}>

                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="font-bold text-slate-800 text-base">{t.identificador}</h3>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.tipo_carburante === 'Gasolina' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-800'
                                    }`}>
                                    {t.tipo_carburante}
                                  </span>
                                </div>
                                {stockCritico && (
                                  <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange-pure opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-orange-pure"></span>
                                  </span>
                                )}
                              </div>

                              {/* Niveles */}
                              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                <span>Stock Actual:</span>
                                <span className="font-bold text-slate-800">{stock.toFixed(1)} L</span>
                              </div>

                              {/* Barra de progreso visual */}
                              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mb-3.5 relative">
                                <div
                                  className={`${progressColor} h-full rounded-full transition-all duration-1000 animate-progress`}
                                  style={{ width: `${perc}%` }}
                                ></div>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-slate-700 mix-blend-difference">
                                  {perc.toFixed(0)}%
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                                <div>
                                  <span>Capacidad Máx:</span>
                                  <p className="font-bold text-slate-700">{t.capacidad_maxima} L</p>
                                </div>
                                <div>
                                  <span>Stock Mín. Seguridad:</span>
                                  <p className="font-bold text-slate-700">{t.stock_minimo_seguridad} L</p>
                                </div>
                              </div>

                              {stockCritico && (
                                <div className="mt-3 p-2 bg-brand-orange-light text-brand-orange-deep rounded-xl text-[10px] font-bold text-center border border-brand-orange-pure/20">
                                  ALERTA: ABAJO DEL STOCK MÍNIMO
                                </div>
                              )}

                            </div>
                          );
                        })}

                      </div>
                    )}

                  </div>

                </div>

                {/* FORMULARIO PARA AGREGAR TANQUE */}
                <div className="lg:col-span-4">
                  <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H9" /></svg>
                      Registrar Nuevo Tanque
                    </h2>

                    <form onSubmit={handleCreateTanque} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Identificador del Tanque</label>
                        <input
                          type="text"
                          required
                          value={nuevoTanqueIdentificador}
                          onChange={(e) => setNuevoTanqueIdentificador(e.target.value)}
                          placeholder="Ej: Tanque T-03"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Tipo de Carburante</label>
                        <select
                          value={nuevoTanqueTipo}
                          onChange={(e) => setNuevoTanqueTipo(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-semibold text-slate-800"
                        >
                          <option value="Gasolina">Gasolina</option>
                          <option value="Diésel">Diésel</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Capacidad Máxima (Litros)</label>
                        <input
                          type="number"
                          required
                          value={nuevoTanqueCapacidad}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNuevoTanqueCapacidad(val === '' ? '' : Number(val));
                          }}
                          placeholder="Ej. 10000"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Stock Mínimo de Seguridad (Litros)</label>
                        <input
                          type="number"
                          required
                          value={nuevoTanqueMinimo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNuevoTanqueMinimo(val === '' ? '' : Number(val));
                          }}
                          placeholder="Ej. 1500"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-brand-blue-deep hover:bg-brand-blue-medium text-white font-bold rounded-xl transition-all shadow-md active:scale-98"
                      >
                        Crear Tanque Virtual
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            )}
            {/* ================================================================= */}
            {/* FIN DE PESTAÑA: TANQUES DE DEPÓSITO */}
            {/* ================================================================= */}


            {/* ================================================================= */}
            {/* INICIO DE PESTAÑA: REABASTECIMIENTO / INGRESOS */}
            {/* ================================================================= */}
            {activeTab === 'ingresos' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* HISTORIAL DE INGRESOS */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                  <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-6 flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      Bitácora de Reabastecimientos (Cisternas)
                    </h2>

                    {ingresos.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        No hay ingresos registrados todavía en esta estación de servicio.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tanque de Destino</th>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cantidad (Litros)</th>
                              <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Factura / Remisión</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100 text-xs">
                            {ingresos.map(i => {
                              const tank = tanques.find(t => t.id === i.tanque_id);
                              return (
                                <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                    {new Date(i.fecha_hora).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap font-bold text-brand-blue-dark">
                                    {tank ? tank.identificador : `Tanque #${i.tanque_id}`}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap font-extrabold text-slate-800">
                                    {Number(i.litros).toFixed(1)} L
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap font-mono text-brand-orange-deep font-semibold">
                                    {i.numero_factura_remision}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </div>

                </div>

                {/* FORMULARIO DE REGISTRO DE INGRESO */}
                <div className="lg:col-span-4">
                  <div className="glass-panel p-6 rounded-2xl">
                    <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2m-2 4h2m-6 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Registrar Entrada (Cisterna)
                    </h2>

                    <form onSubmit={handleCreateIngreso} className="flex flex-col gap-4">

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Tanque de Combustible Destino</label>
                        {tanques.length === 0 ? (
                          <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200">
                            Cree al menos un tanque en la pestaña Tanques para registrar ingresos.
                          </p>
                        ) : (
                          <select
                            value={nuevoIngresoTanqueId}
                            onChange={(e) => setNuevoIngresoTanqueId(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                          >
                            {tanques.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.identificador} ({t.tipo_carburante})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Litros a Cargar</label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="1"
                            value={nuevoIngresoLitros}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNuevoIngresoLitros(val === '' ? '' : Number(val));
                            }}
                            placeholder="Cantidad de litros ingresados..."
                            className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-semibold text-slate-800"
                          />
                          <span className="absolute right-4 top-3 text-slate-500 font-bold text-xs">LITROS</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Número de Factura / Remisión de Proveedor</label>
                        <input
                          type="text"
                          required
                          value={nuevoIngresoFactura}
                          onChange={(e) => setNuevoIngresoFactura(e.target.value)}
                          placeholder="Ej: FAC-002-8871"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={tanques.length === 0}
                        className="w-full py-3 bg-brand-blue-deep hover:bg-brand-blue-medium disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md active:scale-98"
                      >
                        Ingresar Combustible
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            )}
            {/* ================================================================= */}
            {/* FIN DE PESTAÑA: REABASTECIMIENTO / INGRESOS */}
            {/* ================================================================= */}


            {/* ================================================================= */}
            {/* INICIO DE PESTAÑA: CLIENTES */}
            {/* ================================================================= */}
            {activeTab === 'clientes' && (
              <div className="glass-panel p-6 rounded-2xl">
                <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  Padrón de Clientes y Estado de Habilitación
                </h2>

                {clientes.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    No hay clientes registrados en el sistema. Se agregarán automáticamente al facturar o registrar una venta.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre completo / Razón Social</th>
                          <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cédula de Identidad / NIT</th>
                          <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vehículo / Placa</th>
                          <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo Cliente</th>
                          <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100 text-xs">
                        {clientes.map(c => (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                              {c.nombre_razon_social}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">
                              {c.cedula_nit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 bg-brand-blue-sky rounded text-brand-blue-deep font-extrabold uppercase">{c.placa}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                              {c.tipo_cliente}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${c.estado === 'Activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}>
                                {c.estado}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                              <button
                                onClick={() => handleToggleClienteEstado(c.id, c.estado)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm ${c.estado === 'Activo'
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                  }`}
                              >
                                {c.estado === 'Activo' ? 'Suspender' : 'Activar'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {/* ================================================================= */}
            {/* FIN DE PESTAÑA: CLIENTES */}
            {/* ================================================================= */}


            {/* ================================================================= */}
            {/* INICIO DE PESTAÑA: CONFIGURACIÓN DE LA EMPRESA */}
            {/* ================================================================= */}
            {activeTab === 'configuracion' && (
              <div className="glass-panel p-6 rounded-2xl max-w-3xl mx-auto">
                <h2 className="text-lg font-bold font-display text-brand-blue-dark mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-orange-pure" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  Configuración de Estación y Parámetros Globales
                </h2>

                <form onSubmit={handleSaveConfig} className="flex flex-col gap-6">

                  {/* Bloque 1: Datos Institucionales */}
                  <div>
                    <h3 className="text-sm font-bold text-brand-blue-deep border-b border-slate-100 pb-2 mb-4 uppercase tracking-wider">
                      Datos de la Estación
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Nombre de la Estación</label>
                        <input
                          type="text"
                          required
                          value={configNombre}
                          onChange={(e) => setConfigNombre(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">NIT / Identificación Tributaria</label>
                        <input
                          type="text"
                          required
                          value={configNit}
                          onChange={(e) => setConfigNit(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Dirección de la Estación</label>
                        <input
                          type="text"
                          required
                          value={configDireccion}
                          onChange={(e) => setConfigDireccion(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Ciudad</label>
                        <input
                          type="text"
                          required
                          value={configCiudad}
                          onChange={(e) => setConfigCiudad(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Contacto (Teléfono/Email)</label>
                        <input
                          type="text"
                          required
                          value={configContacto}
                          onChange={(e) => setConfigContacto(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-medium text-slate-800"
                        />
                      </div>

                    </div>
                  </div>

                  {/* Bloque 2: Parámetros de Control */}
                  <div>
                    <h3 className="text-sm font-bold text-brand-blue-deep border-b border-slate-100 pb-2 mb-4 uppercase tracking-wider">
                      Parámetros Críticos de Control
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Factor de Holgura (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="0"
                            value={configHolgura}
                            onChange={(e) => setConfigHolgura(Number(e.target.value))}
                            className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-bold text-slate-800"
                          />
                          <span className="absolute right-3.5 top-3 text-slate-500 font-bold text-xs">%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Margen extra permitido sobre el promedio.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Cupo Base Nuevo (L)</label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="1"
                            value={configCupoNuevo}
                            onChange={(e) => setConfigCupoNuevo(Number(e.target.value))}
                            className="w-full pl-3.5 pr-12 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-bold text-slate-800"
                          />
                          <span className="absolute right-3.5 top-3 text-slate-500 font-bold text-xs">LITROS</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Asignado a clientes sin historial de compra.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Periodo de Evaluación</label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="7"
                            value={configPeriodo}
                            onChange={(e) => setConfigPeriodo(Number(e.target.value))}
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-bold text-slate-800"
                          />
                          <span className="absolute right-3.5 top-3 text-slate-500 font-bold text-xs">DÍAS</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Días evaluados para calcular el promedio.</p>
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Alerta de Stock Mínimo Global (Litros)</label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min="100"
                            value={configAlertaGlobal}
                            onChange={(e) => setConfigAlertaGlobal(Number(e.target.value))}
                            className="w-full pl-3.5 pr-12 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-blue-deep bg-white font-bold text-slate-800"
                          />
                          <span className="absolute right-3.5 top-3 text-slate-500 font-bold text-xs">LITROS</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Nivel base global para alertas de abastecimiento en tanques.</p>
                      </div>

                    </div>
                  </div>

                  {configSaveSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl text-center border border-emerald-200">
                      ¡Parámetros y datos institucionales actualizados correctamente!
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-orange text-white font-extrabold rounded-xl transition-all shadow-md hover:brightness-105 active:scale-98"
                  >
                    Guardar Configuración
                  </button>

                </form>
              </div>
            )}
            {/* ================================================================= */}
            {/* FIN DE PESTAÑA: CONFIGURACIÓN DE LA EMPRESA */}
            {/* ================================================================= */}
          </>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-brand-blue-dark text-slate-400 py-6 border-t border-brand-orange-pure/20 mt-12 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>© 2026 {empresa?.nombre || 'Arando Ramos Brayan Rodrigo Petrol'} - Estación de Servicio Controlada. Cochabamba, Bolivia.</p>
          <p className="mt-1.5 opacity-60">Diseñado con tecnología web avanzada. Adaptado para tablets y pantallas táctiles de despacho.</p>
        </div>
      </footer>

    </div>
  );
}
