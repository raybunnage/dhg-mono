import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;