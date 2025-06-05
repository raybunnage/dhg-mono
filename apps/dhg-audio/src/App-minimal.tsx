// Minimal App to test Vite server
export default function App() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Minimal DHG Audio App</h1>
      <p>Testing Vite server connection...</p>
      <p>Environment variables:</p>
      <ul>
        <li>VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL || 'MISSING'}</li>
        <li>VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING'}</li>
      </ul>
    </div>
  );
}