import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Users } from 'lucide-react';

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-header">Admin Panel</h1>
        <p className="section-sub">Manage stocks, users, and market dynamics</p>
      </div>

      {/* Admin Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto">
        {[
          { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
          { to: '/admin/stocks', label: 'Stocks', icon: TrendingUp },
          { to: '/admin/users', label: 'Users', icon: Users },
        ].map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${
                isActive
                  ? 'border-gain text-gain'
                  : 'border-transparent text-white/50 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
