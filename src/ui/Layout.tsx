import { NavLink, Outlet } from 'react-router';

const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/analysis', label: 'Analysis', icon: '🧪' },
  { to: '/studies', label: 'Studies', icon: '📚' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Layout() {
  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="lg:flex">
        <nav className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-e border-neutral-200 bg-white p-3 lg:flex dark:border-neutral-800 dark:bg-neutral-950">
          <p className="mb-4 px-3 text-xl font-bold">♞ ChessMaster</p>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2.5 font-medium ${isActive ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`
              }
            >
              <span className="me-2">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 px-4 pt-4 pb-24 lg:p-6">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-neutral-800 dark:bg-neutral-950">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-2 text-xs font-medium ${isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-500'}`
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
