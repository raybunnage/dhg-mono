import { NavLink } from 'react-router-dom';
import { Mail, FileText, BarChart3, Settings } from 'lucide-react';

function Navigation() {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-primary-800 text-white'
        : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated'
    }`;

  return (
    <nav className="bg-background-paper border-b border-border">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-gradient">DHG Research</h1>
            
            <div className="flex items-center gap-2">
              <NavLink to="/gmail" className={navLinkClass}>
                <Mail size={18} />
                <span>Gmail</span>
              </NavLink>
              
              <NavLink to="/viewer" className={navLinkClass}>
                <FileText size={18} />
                <span>Viewer</span>
              </NavLink>
              
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-elevated transition-colors">
                <BarChart3 size={18} />
                <span>Analytics</span>
              </button>
            </div>
          </div>
          
          <button className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-elevated transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;