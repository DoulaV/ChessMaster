import { NavLink, Outlet } from 'react-router';

const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true, mobile: true },
  { to: '/openings', label: 'Openings', icon: '📖', mobile: true },
  { to: '/practice', label: 'Play', icon: '🤖', mobile: true },
  { to: '/blunder-check', label: 'Blunders', icon: '🛡️', mobile: true },
  { to: '/analysis', label: 'Analysis', icon: '🔬', mobile: true },
  { to: '/studies', label: 'Studies', icon: '📚', mobile: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', mobile: false },
];

export function Layout() {
  return (
    <div className="min-h-dvh bg-cm-bg text-cm-text">
      <div className="lg:flex">
        <nav className="sticky top-0 hidden h-dvh w-48 shrink-0 flex-col bg-cm-panel py-3 lg:flex">
          <p className="mb-4 flex items-center gap-2 px-4 text-xl font-extrabold">
            <span className="text-2xl text-cm-green">♞</span>ChessMaster
          </p>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-[15px] font-bold ${isActive ? 'bg-cm-bg text-white' : 'text-cm-muted hover:bg-cm-bg/60 hover:text-white'}`
              }
            >
              <span className="text-xl">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 px-3 pt-3 pb-24 sm:px-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex bg-cm-panel pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.filter((n) => n.mobile).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-2 text-[11px] font-bold ${isActive ? 'text-white' : 'text-cm-faint'}`
            }
          >
            <span className="text-xl">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
