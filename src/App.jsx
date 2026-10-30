import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Wrench, MapPin, FileText, Plus, CheckCircle, AlertTriangle, Users, Cpu, ArrowLeft, Trash2 } from 'lucide-react';

// Inicialización de Supabase con las variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home', 'nuevo_parte', 'clientes', 'maquinas'
  const [partes, setPartes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario de nuevo parte
  const [formData, setFormData] = useState({
    cliente_id: '',
    cliente_nombre: '',
    maquina_id: '',
    maquina_info: '',
    descripcion_averia: '',
    trabajos_realizados: '',
    repuestos_utilizados: '',
    tecnico_asignado: '',
    horas_trabajo: '',
    ubicacion_gps: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: cData } = await supabase.from('clientes').select('*');
      if (cData) setClientes(cData);

      const { data: mData } = await supabase.from('maquinas').select('*');
      if (mData) setMaquinas(mData);

      const { data: pData } = await supabase.from('partes_trabajo').select('*').order('created_at', { ascending: false });
      if (pData) setPartes(pData);
    } catch (e) {
      console.error('Error al cargar datos:', e);
    } finally {
      setLoading(false);
    }
  }

  // Función de Geolocalización GPS
  const obtenerGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `Lat: ${position.coords.latitude.toFixed(6)}, Lon: ${position.coords.longitude.toFixed(6)}`;
          setFormData(prev => ({ ...prev, ubicacion_gps: coords }));
          alert('¡Ubicación GPS obtenida con éxito!');
        },
        (error) => {
          alert('No se pudo obtener la ubicación GPS. Comprueba los permisos.');
        }
      );
    } else {
      alert('La geolocalización no es compatible con este navegador.');
    }
  };

  // Guardar Parte en Supabase
  const handleSubmitParte = async (e) => {
    e.preventDefault();
    try {
      const numeroParte = `SAT-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('partes_trabajo').insert([{
        numero_parte: numeroParte,
        cliente_id: formData.cliente_id || null,
        cliente_nombre: formData.cliente_nombre || 'Cliente General',
        maquina_id: formData.maquina_id || null,
        maquina_info: formData.maquina_info || 'Industrial',
        descripcion_averia: formData.descripcion_averia,
        trabajos_realizados: formData.trabajos_realizados,
        repuestos_utilizados: formData.repuestos_utilizados,
        tecnico_asignado: formData.tecnico_asignado,
        horas_trabajo: parseFloat(formData.horas_trabajo) || 0,
        estado: 'Completado'
      }]);

      if (error) throw error;

      alert('¡Parte guardado y sincronizado con éxito!');
      setFormData({
        cliente_id: '', cliente_nombre: '', maquina_id: '', maquina_info: '',
        descripcion_averia: '', trabajos_realizados: '', repuestos_utilizados: '',
        tecnico_asignado: '', horas_trabajo: '', ubicacion_gps: ''
      });
      setCurrentView('home');
      fetchData();
    } catch (err) {
      setErrorMsg('Error al guardar el parte en Supabase. Revisa la conexión.');
    }
  };

  // Generador de PDF nativo del parte
  const generarPDF = (parte) => {
    const ventanaPdf = window.open('', '_blank');
    ventanaPdf.document.write(`
      <html>
        <head>
          <title>Parte de Trabajo ${parte.numero_parte}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
            .section { margin-bottom: 15px; }
            .label { font-weight: bold; color: #555; }
            .box { border: 1px solid #ccc; padding: 10px; border-radius: 5px; margin-top: 5px; background: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>ANDAMAK SERVICIO TÉCNICO</h1>
          <h2>Parte de Trabajo: ${parte.numero_parte}</h2>
          <div class="section"><span class="label">Cliente:</span> ${parte.cliente_nombre}</div>
          <div class="section"><span class="label">Máquina / Equipo:</span> ${parte.maquina_info}</div>
          <div class="section"><span class="label">Descripción de Avería:</span> <div class="box">${parte.descripcion_averia}</div></div>
          <div class="section"><span class="label">Trabajos Realizados:</span> <div class="box">${parte.trabajos_realizados || 'N/D'}</div></div>
          <div class="section"><span class="label">Repuestos Utilizados:</span> <div class="box">${parte.repuestos_utilizados || 'Ninguno'}</div></div>
          <div class="section"><span class="label">Técnico:</span> ${parte.tecnico_asignado || 'N/D'} | <span class="label">Horas:</span> ${parte.horas_trabajo}h</div>
          <br/><button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 5px; cursor: pointer;">Imprimir / Guardar PDF</button>
        </body>
      </html>
    `);
    ventanaPdf.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      <header className="max-w-4xl mx-auto bg-slate-800 p-4 rounded-xl shadow-lg flex justify-between items-center mb-6 border border-slate-700">
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold tracking-wide">Andamak SAT</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCurrentView('home')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${currentView === 'home' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>Partes</button>
          <button onClick={() => setCurrentView('nuevo_parte')} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-sm font-medium transition"><Plus className="w-4 h-4" /> Nuevo Parte</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {currentView === 'home' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-300">Historial de Partes de Trabajo</h2>
              <span className="text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700 text-slate-400">{partes.length} Registrados</span>
            </div>

            {loading ? (
              <p className="text-center text-slate-400 py-10">Cargando registros...</p>
            ) : partes.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-slate-400 mb-3">No hay partes de trabajo registrados todavía.</p>
                <button onClick={() => setCurrentView('nuevo_parte')} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium">Crear el primero</button>
              </div>
            ) : (
              <div className="space-y-3">
                {partes.map((p) => (
                  <div key={p.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-400">{p.numero_parte}</span>
                        <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">{p.estado}</span>
                      </div>
                      <p className="font-medium text-slate-200 mt-1">{p.cliente_nombre} - <span className="text-slate-400 text-sm">{p.maquina_info}</span></p>
                      <p className="text-sm text-slate-400 mt-1 line-clamp-1">{p.descripcion_averia}</p>
                    </div>
                    <button onClick={() => generarPDF(p)} className="flex items-center gap-1.5 bg-slate-700 hover:bg-blue-600 px-3.5 py-2 rounded-lg text-sm font-medium transition self-end sm:self-center">
                      <FileText className="w-4 h-4" /> Generar PDF
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'nuevo_parte' && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setCurrentView('home')} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
              <h2 className="text-lg font-semibold">Registrar Nuevo Parte / Aviso SAT</h2>
            </div>

            <form onSubmit={handleSubmitParte} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del Cliente</label>
                <input type="text" required placeholder="Ej. Carpintería Hermanos Gómez" value={formData.cliente_nombre} onChange={e => setFormData({...formData, cliente_nombre: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Máquina / Equipo</label>
                <input type="text" required placeholder="Ej. Seccionadora SCM / CNC" value={formData.maquina_info} onChange={e => setFormData({...formData, maquina_info: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Descripción de la Avería</label>
                <textarea rows="3" required placeholder="Detalle del fallo reportado..." value={formData.descripcion_averia} onChange={e => setFormData({...formData, descripcion_averia: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-blue-500"></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Trabajos Realizados</label>
                <textarea rows="3" placeholder="Reparaciones efectuadas..." value={formData.trabajos_realizados} onChange={e => setFormData({...formData, trabajos_realizados: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-blue-500"></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Técnico Asignado</label>
                  <input type="text" placeholder="Nombre del técnico" value={formData.tecnico_asignado} onChange={e => setFormData({...formData, tecnico_asignado: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Horas de Trabajo</label>
                  <input type="number" step="0.5" placeholder="Ej. 2.5" value={formData.horas_trabajo} onChange={e => setFormData({...formData, horas_trabajo: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Ubicación GPS</label>
                <div className="flex gap-2">
                  <input type="text" readOnly placeholder="Pulsa el botón para capturar GPS" value={formData.ubicacion_gps} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-400 text-sm" />
                  <button type="button" onClick={obtenerGPS} className="bg-slate-700 hover:bg-slate-600 px-4 rounded-lg flex items-center gap-1.5 text-sm font-medium transition"><MapPin className="w-4 h-4 text-emerald-400" /> GPS</button>
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-semibold transition mt-2">Guardar y Sincronizar Parte</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
