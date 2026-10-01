import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // Autenticación Real con Supabase Auth
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Navegación Original de Fase 1
  const [activeTab, setActiveTab] = useState('principal');
  const [serviceTab, setServiceTab] = useState('pendientes');
  
  // Estado Global Supabase
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);
  const [machines, setMachines] = useState([]);
  const [parts, setParts] = useState([]);
  const [syncStatus, setSyncStatus] = useState('Conectando a Supabase...');
  
  // Formulario de Servicio Completo
  const [currentServiceId, setCurrentServiceId] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientDir, setClientDir] = useState('');
  const [machineType, setMachineType] = useState('Seccionadora');
  const [machineModel, setMachineModel] = useState('');
  const [averia, setAveria] = useState('');
  const [trabajo, setTrabajo] = useState('');

  // 1. INICIALIZAR SESIÓN DE SUPABASE
  useEffect(() => {
    if (!supabase) {
      setSyncStatus('Error: Supabase no configurado');
      setIsLoadingAuth(false);
      return;
    }
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. CARGA DE DATOS DESDE POSTGRESQL
  const fetchSupabaseData = async () => {
    if (!supabase || !session) return;
    try {
      setSyncStatus('Sincronizando...');
      
      const { data: srvData, error: srvErr } = await supabase
        .from('technical_services')
        .select(`
          id, title, description, status_id, created_at,
          clients ( id, company_name, address ),
          machines ( id, serial_number )
        `)
        .order('created_at', { ascending: false });
      if (srvErr) throw srvErr;

      const { data: cliData } = await supabase.from('clients').select('*');
      const { data: macData } = await supabase.from('machines').select('*');
      const { data: partData } = await supabase.from('parts').select('*');

      setClients(cliData || []);
      setMachines(macData || []);
      setParts(partData || []);

      if (srvData) {
        const mappedServices = srvData.map(srv => ({
          id: srv.id,
          fecha: new Date(srv.created_at).toLocaleDateString(),
          estado: (srv.status_id === 'CLOSED' || srv.status_id === 'REPAIRED') ? 'finalizados' : 'pendientes',
          clienteNombre: srv.clients?.company_name || 'Sin Cliente',
          clienteDir: srv.clients?.address || '',
          maquinaTipo: 'Máquina',
          maquinaModelo: srv.machines?.serial_number || '',
          averia: srv.description || '',
          trabajo: srv.title || ''
        }));
        setServices(mappedServices);
      }
      setSyncStatus('Nube Activa (Realtime)');
    } catch (err) {
      console.error('Error cargando Supabase:', err);
      setSyncStatus('Error de Sincronización');
    }
  };

  // 3. ACTIVAR REALTIME Y CARGAR DATOS AL INICIAR SESIÓN
  useEffect(() => {
    if (session && supabase) {
      fetchSupabaseData();
      
      const channel = supabase.channel('public:technical_services')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'technical_services' }, (payload) => {
           console.log('Cambio detectado en Supabase (Multidispositivo):', payload);
           fetchSupabaseData(); 
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  // Manejo de Acceso con Diagnóstico de Alerta
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSyncStatus('Autenticando...');
    
    try {
      if (!supabase) {
        alert("Error crítico: Supabase es null. Las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no se están cargando en Vercel.");
        return;
      }
      
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        setSyncStatus('Error de autenticación');
      }
    } catch (err) {
      alert("Excepción capturada en el login: " + err.message);
    }
  };

  const handleLogout = async () => {
    if(window.confirm('¿Cerrar sesión segura?')) {
      await supabase.auth.signOut();
    }
  };

  const startNewService = () => {
    setCurrentServiceId(null); 
    setClientName(''); 
    setClientDir('');
    setMachineType('Seccionadora'); 
    setMachineModel(''); 
    setAveria(''); 
    setTrabajo('');
    setActiveTab('nuevo-servicio');
  };

  const loadServiceIntoForm = (srv) => {
    setCurrentServiceId(srv.id);
    setClientName(srv.clienteNombre);
    setClientDir(srv.clienteDir);
    setMachineType(srv.maquinaTipo);
    setMachineModel(srv.maquinaModelo);
    setAveria(srv.averia);
    setTrabajo(srv.trabajo);
    setActiveTab('nuevo-servicio');
  };

  // 4. GUARDADO TRANXACCIONAL REAL EN SUPABASE (INSERT / UPDATE)
  const handleSaveToSupabase = async (uiStatus) => {
    if (!supabase) return alert("Error: Supabase no está configurado.");
    
    try {
      setSyncStatus('Escribiendo en Supabase...');
      const dbStatus = uiStatus === 'finalizados' ? 'CLOSED' : 'PENDING';
      
      // A. Buscar o crear Cliente
      let clientId = null;
      if (clientName) {
         const { data: existingClient } = await supabase.from('clients').select('id').ilike('company_name', clientName).maybeSingle();
         if (existingClient) clientId = existingClient.id;
         else {
            const { data: newClient } = await supabase.from('clients').insert([{ company_name: clientName, address: clientDir }]).select().single();
            if (newClient) clientId = newClient.id;
         }
      }

      // B. Buscar o crear Máquina
      let machineId = null;
      if (machineModel && clientId) {
         const { data: existingMachine } = await supabase.from('machines').select('id').eq('client_id', clientId).ilike('serial_number', machineModel).maybeSingle();
         if (existingMachine) machineId = existingMachine.id;
         else {
            const { data: newMachine } = await supabase.from('machines').insert([{ client_id: clientId, serial_number: machineModel }]).select().single();
            if (newMachine) machineId = newMachine.id;
         }
      }

      // C. Guardar el Servicio Técnico
      const payload = {
         client_id: clientId,
         machine_id: machineId,
         status_id: dbStatus,
         title: trabajo || 'Intervención Técnica',
         description: averia || ''
      };

      // Si el ID es un UUID real de Supabase (más de 10 caracteres)
      if (currentServiceId && String(currentServiceId).length > 10) {
         await supabase.from('technical_services').update(payload).eq('id', currentServiceId);
      } else {
         await supabase.from('technical_services').insert([payload]);
      }
      
      await fetchSupabaseData();
      setActiveTab('servicios');
      setServiceTab(uiStatus);

    } catch (err) {
       console.error('Error guardando en la nube:', err);
       alert("Error al guardar en Supabase. Revisa la consola.");
       setSyncStatus('Error al Guardar');
    }
  };

  const pendingCount = services.filter(s => s.estado === 'pendientes').length;
  const finishedCount = services.filter(s => s.estado === 'finalizados').length;

  if (isLoadingAuth) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Cargando Andamak...</div>;
  }

  // PANTALLA DE LOGIN CON DISEÑO ORIGINAL ADAPTADO A SUPABASE AUTH
  if (!session) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans antialiased">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-600/30">
            <i className="fa-solid fa-shield-halved text-white text-3xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">ANDAMAK</h2>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Acceso a la Nube (Supabase)</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-center text-sm font-mono text-white focus:border-blue-500 outline-none transition" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-center text-sm font-mono tracking-widest text-white focus:border-blue-500 outline-none transition" required />
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition touch-target">Iniciar Sesión</button>
          </form>
          {authError && <p className="text-xs text-rose-500 font-medium">{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased pb-24">
      
      {/* HEADER ORIGINAL */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('principal')}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg bg-blue-600 text-white font-bold text-xl">A</div>
          <div>
            <h1 className="font-bold text-slate-100 leading-tight">ANDAMAK</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase flex items-center gap-1">
              <i className="fa-solid fa-cloud text-emerald-400"></i> 
              <span>{syncStatus}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
             <button onClick={fetchSupabaseData} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 touch-target transition">
                <i className="fa-solid fa-rotate"></i> Sync
             </button>
             <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 touch-target hover:text-white transition">
                <i className="fa-solid fa-right-from-bracket text-xs"></i>
             </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        
        {/* VISTA DASHBOARD */}
        {activeTab === 'principal' && (
          <div className="space-y-4">
            <button onClick={startNewService} className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-transform text-white rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center gap-3 border border-blue-500/50 relative overflow-hidden touch-target">
              <i className="fa-solid fa-plus-circle text-4xl"></i>
              <span className="font-bold text-lg tracking-wide">NUEVO SERVICIO</span>
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => {setActiveTab('servicios'); setServiceTab('pendientes')}} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-2xl flex flex-col items-center gap-2 touch-target relative transition">
                {pendingCount > 0 && <span className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 rounded-full">{pendingCount}</span>}
                <i className="fa-solid fa-clock-rotate-left text-amber-500 text-2xl mb-1"></i><span className="text-xs font-semibold text-slate-300">Pendientes</span>
              </button>
              <button onClick={() => {setActiveTab('servicios'); setServiceTab('finalizados')}} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-2xl flex flex-col items-center gap-2 touch-target relative transition">
                {finishedCount > 0 && <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 rounded-full">{finishedCount}</span>}
                <i className="fa-solid fa-check-circle text-emerald-500 text-2xl mb-1"></i><span className="text-xs font-semibold text-slate-300">Finalizados</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setActiveTab('clientes')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-2xl flex flex-col items-center gap-2 touch-target relative transition">
                <span className="absolute top-2 right-2 text-slate-400 text-[10px] font-bold bg-slate-900 px-1.5 rounded">{clients.length}</span>
                <i className="fa-solid fa-users text-blue-400 text-xl"></i><span className="text-xs font-medium text-slate-400">Clientes</span>
              </button>
              <button onClick={() => setActiveTab('maquinas')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-2xl flex flex-col items-center gap-2 touch-target relative transition">
                <span className="absolute top-2 right-2 text-slate-400 text-[10px] font-bold bg-slate-900 px-1.5 rounded">{machines.length}</span>
                <i className="fa-solid fa-gears text-purple-400 text-xl"></i><span className="text-xs font-medium text-slate-400">Máquinas</span>
              </button>
              <button onClick={() => setActiveTab('repuestos')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-2xl flex flex-col items-center gap-2 touch-target transition">
                <span className="absolute top-2 right-2 text-slate-400 text-[10px] font-bold bg-slate-900 px-1.5 rounded">{parts.length}</span>
                <i className="fa-solid fa-boxes-stacked text-orange-400 text-xl"></i><span className="text-xs font-medium text-slate-400">Repuestos</span>
              </button>
              <button onClick={() => setActiveTab('estadisticas')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-2xl flex flex-col items-center gap-2 touch-target transition">
                <i className="fa-solid fa-chart-pie text-pink-400 text-xl"></i><span className="text-xs font-medium text-slate-400">Estadísticas</span>
              </button>
            </div>
          </div>
        )}

        {/* VISTA NUEVO/EDITAR SERVICIO */}
        {activeTab === 'nuevo-servicio' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold"><i className="fa-solid fa-plus-circle text-blue-500"></i> Formulario de Servicio</h2>
                <button onClick={() => setActiveTab('principal')} className="text-slate-400 hover:text-white text-xl p-2 touch-target"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl space-y-3">
                 <h3 className="text-blue-400 text-sm font-semibold border-b border-slate-700 pb-2">1. Datos del Cliente</h3>
                 <input type="text" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nombre / Empresa" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white touch-target"/>
                 <input type="text" value={clientDir} onChange={e=>setClientDir(e.target.value)} placeholder="Dirección" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white touch-target"/>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl space-y-3">
                 <h3 className="text-purple-400 text-sm font-semibold border-b border-slate-700 pb-2">2. Máquina</h3>
                 <input type="text" value={machineType} onChange={e=>setMachineType(e.target.value)} placeholder="Tipo (ej. Seccionadora)" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white touch-target"/>
                 <input type="text" value={machineModel} onChange={e=>setMachineModel(e.target.value)} placeholder="Modelo o Serie" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white touch-target"/>
            </div>
            
            <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl space-y-3">
                 <h3 className="text-slate-200 text-sm font-semibold border-b border-slate-700 pb-2">3. Informe del Técnico</h3>
                 <textarea value={averia} onChange={e=>setAveria(e.target.value)} placeholder="Avería reportada / Síntomas..." rows="2" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white touch-target"></textarea>
                 <textarea value={trabajo} onChange={e=>setTrabajo(e.target.value)} placeholder="Trabajo realizado / Diagnóstico..." rows="3" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white touch-target"></textarea>
            </div>

            <div className="space-y-3">
                <button onClick={() => handleSaveToSupabase('pendientes')} className="w-full bg-amber-600/20 text-amber-500 border border-amber-500/30 p-4 rounded-2xl font-bold touch-target">Guardar PENDIENTE en Supabase</button>
                <button onClick={() => handleSaveToSupabase('finalizados')} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold touch-target shadow-lg">Finalizar y Guardar en Supabase</button>
            </div>
          </div>
        )}

        {/* VISTA LISTA DE SERVICIOS */}
        {activeTab === 'servicios' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white border-b border-slate-700 pb-2">Gestión de Servicios (Nube)</h2>
            <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                <button onClick={() => setServiceTab('pendientes')} className={`tab-btn touch-target ${serviceTab === 'pendientes' ? 'active' : 'inactive'}`}>Pendientes</button>
                <button onClick={() => setServiceTab('finalizados')} className={`tab-btn touch-target ${serviceTab === 'finalizados' ? 'active' : 'inactive'}`}>Finalizados</button>
            </div>
            <div className="space-y-3 mt-4">
                 {services.filter(s => s.estado === serviceTab).length === 0 ? (
                     <div className="text-center text-slate-500 py-10 text-sm">No hay servicios {serviceTab} en Supabase</div>
                 ) : (
                     services.filter(s => s.estado === serviceTab).map(srv => (
                         <div key={srv.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm">
                             <div className="flex justify-between items-start mb-2">
                                 <span className="text-xs font-bold text-slate-400 truncate max-w-[150px]">ID: {String(srv.id).substring(0,8)}...</span>
                                 <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${srv.estado === 'pendientes' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'}`}>{srv.estado}</span>
                             </div>
                             <h3 className="font-bold text-white text-base">{srv.clienteNombre}</h3>
                             <p className="text-xs text-slate-400 mt-1"><i className="fa-solid fa-gear"></i> {srv.maquinaTipo} {srv.maquinaModelo}</p>
                             <div className="mt-3 flex justify-end">
                                <button onClick={() => loadServiceIntoForm(srv)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 touch-target transition">
                                  <i className="fa-solid fa-pen"></i> Abrir / Editar
                                </button>
                             </div>
                         </div>
                     ))
                 )}
            </div>
          </div>
        )}

        {/* VISTAS EXTRAS DE DIRECTORIOS (Listando desde Supabase) */}
        {activeTab === 'clientes' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white border-b border-slate-700 pb-2"><i className="fa-solid fa-users text-blue-400"></i> Clientes (Supabase)</h2>
            {clients.map(c => (
              <div key={c.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold text-white text-sm">{c.company_name}</h3>
                <p className="text-xs text-slate-400 mt-1"><i className="fa-solid fa-location-dot"></i> {c.address || 'Sin dirección'}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'maquinas' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white border-b border-slate-700 pb-2"><i className="fa-solid fa-gears text-purple-400"></i> Máquinas (Supabase)</h2>
            {machines.map(m => (
              <div key={m.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="font-bold text-white text-sm mb-1">SN: {m.serial_number || 'N/A'}</h3>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <nav className="fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 z-50">
        <div className="flex justify-around items-center p-2 max-w-lg mx-auto">
          <button onClick={() => setActiveTab('principal')} className={`flex flex-col items-center p-2 w-20 touch-target transition ${activeTab === 'principal' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <i className="fa-solid fa-house text-xl mb-1"></i><span className="text-[10px] font-medium">Inicio</span>
          </button>
          <button onClick={() => {setActiveTab('servicios'); setServiceTab('pendientes')}} className={`flex flex-col items-center p-2 w-20 touch-target relative transition ${activeTab === 'servicios' ? 'text-blue-500' : 'text-slate-400 hover:text-slate-200'}`}>
            {pendingCount > 0 && <span className="absolute top-1 right-3 bg-rose-500 w-2.5 h-2.5 rounded-full"></span>}
            <i className="fa-solid fa-list-check text-xl mb-1"></i><span className="text-[10px] font-medium">Servicios</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
