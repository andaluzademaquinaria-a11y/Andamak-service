import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    cliente_nombre: '',
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
      const { data: pData } = await supabase.from('partes_trabajo').select('*').order('created_at', { ascending: false });
      if (pData) setPartes(pData);
    } catch (e) {
      console.error('Error al cargar datos:', e);
    } finally {
      setLoading(false);
    }
  }

  const obtenerGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `Lat: ${position.coords.latitude.toFixed(6)}, Lon: ${position.coords.longitude.toFixed(6)}`;
          setFormData(prev => ({ ...prev, ubicacion_gps: coords }));
          alert('¡Ubicación GPS obtenida con éxito!');
        },
        () => {
          alert('No se pudo obtener la ubicación GPS. Comprueba los permisos.');
        }
      );
    } else {
      alert('La geolocalización no es compatible con este navegador.');
    }
  };

  const handleSubmitParte = async (e) => {
    e.preventDefault();
    try {
      const numeroParte = `SAT-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('partes_trabajo').insert([{
        numero_parte: numeroParte,
        cliente_nombre: formData.cliente_nombre || 'Cliente General',
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
        cliente_nombre: '', maquina_info: '',
        descripcion_averia: '', trabajos_realizados: '', repuestos_utilizados: '',
        tecnico_asignado: '', horas_trabajo: '', ubicacion_gps: ''
      });
      setCurrentView('home');
      fetchData();
    } catch (err) {
      setErrorMsg('Error al guardar el parte en Supabase.');
    }
  };

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
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f1f5f9', padding: '16px', fontFamily: 'sans-serif' }}>
      <header style={{ maxWidth: '800px', margin: '0 auto 24px auto', backgroundColor: '#1e293b', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #334155' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Andamak SAT</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setCurrentView('home')} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: currentView === 'home' ? '#2563eb' : '#334155', color: '#fff', cursor: 'pointer' }}>Partes</button>
          <button onClick={() => setCurrentView('nuevo_parte')} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', cursor: 'pointer' }}>+ Nuevo Parte</button>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto' }}>
        {errorMsg && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{errorMsg}</div>}

        {currentView === 'home' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#cbd5e1', margin: 0 }}>Historial de Partes</h2>
              <span style={{ fontSize: '0.85rem', background: '#1e293b', padding: '4px 12px', borderRadius: '999px', border: '1px solid #334155', color: '#94a3b8' }}>{partes.length} Registrados</span>
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Cargando registros...</p>
            ) : partes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid #334155' }}>
                <p style={{ color: '#94a3b8', marginBottom: '16px' }}>No hay partes de trabajo registrados todavía.</p>
                <button onClick={() => setCurrentView('nuevo_parte')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}>Crear el primero</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {partes.map((p) => (
                  <div key={p.id} style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{p.numero_parte}</span>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '999px' }}>{p.estado}</span>
                      </div>
                      <p style={{ fontWeight: '500', color: '#e2e8f0', margin: '4px 0' }}>{p.cliente_nombre} - <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{p.maquina_info}</span></p>
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>{p.descripcion_averia}</p>
                    </div>
                    <button onClick={() => generarPDF(p)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>Generar PDF</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'nuevo_parte' && (
          <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button onClick={() => setCurrentView('home')} style={{ padding: '6px 12px', background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← Volver</button>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Registrar Nuevo Parte / Aviso SAT</h2>
            </div>

            <form onSubmit={handleSubmitParte} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '6px' }}>Nombre del Cliente</label>
                <input type="text" required placeholder="Ej. Carpintería Hermanos Gómez" value={formData.cliente_nombre} onChange={e => setFormData({...formData, cliente_nombre: e.target.value})} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#f1f5f9', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '6px' }}>Máquina / Equipo</label>
                <input type="text" required placeholder="Ej. Seccionadora SCM / CNC" value={formData.maquina_info} onChange={e => setFormData({...formData, maquina_info: e.target.value})} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#f1f5f9', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '6px' }}>Descripción de la Avería</label>
                <textarea rows="3" required placeholder="Detalle del fallo reportado..." value={formData.descripcion_averia} onChange={e => setFormData({...formData, descripcion_averia: e.target.value})} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#f1f5f9', boxSizing: 'border-box' }}></textarea>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '6px' }}>Trabajos Realizados</label>
                <textarea rows="3" placeholder="Reparaciones efectuadas..." value={formData.trabajos_realizados} onChange={e => setFormData({...formData, trabajos_realizados: e.target.value})} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#f1f5f9', boxSizing: 'border-box' }}></textarea>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '6px' }}>Técnico Asignado</label>
                  <input type="text" placeholder="Nombre del técnico" value={formData.tecnico_asignado} onChange={e => setFormData({...formData, tecnico_asignado: e.target.value})} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#f1f5f9', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '6px' }}>Horas de Trabajo</label>
                  <input type="number" step="0.5" placeholder="Ej. 2.5" value={formData.horas_trabajo} onChange={e => setFormData({...formData, horas_trabajo: e.target.value})} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#f1f5f9', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '6px' }}>Ubicación GPS</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" readOnly placeholder="Pulsa el botón para capturar GPS" value={formData.ubicacion_gps} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px', color: '#94a3b8', boxSizing: 'border-box' }} />
                  <button type="button" onClick={obtenerGPS} style={{ background: '#334155', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>📍 GPS</button>
                </div>
              </div>

              <button type="submit" style={{ width: '100%', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}>Guardar y Sincronizar Parte</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
