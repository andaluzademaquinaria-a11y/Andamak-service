import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Capturador de errores global para evitar pantallas en blanco o negras
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#020617', padding: '20px', color: '#f87171', fontFamily: 'sans-serif' }}>
          <div style={{ backgroundColor: '#0f172a', border: '2px solid #ef4444', padding: '20px', borderRadius: '10px' }}>
            <h2 style={{ color: '#ffffff', marginTop: 0 }}>💥 Error de Arranque (React)</h2>
            <p><strong>Mensaje:</strong> {this.state.error?.message}</p>
            <button onClick={() => window.location.reload()} style={{ padding: '10px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', marginTop: '10px' }}>
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
