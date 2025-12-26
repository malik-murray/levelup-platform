'use client';

export default function OtherAppsPage() {
  const apps = [
    {
      name: 'Finance App',
      description: 'Personal finance management and budgeting',
      href: '/finance',
      icon: '💰',
    },
    {
      name: 'Stock Analyzer',
      description: 'Stock market analysis and portfolio management',
      href: '/markets',
      icon: '📈',
    },
    {
      name: 'Content Automation Engine',
      description: 'Automate content creation and publishing',
      href: '#',
      icon: '🤖',
      comingSoon: true,
    },
    {
      name: 'Fitness Tracker',
      description: 'Track workouts, meals, and fitness metrics',
      href: '/fitness',
      icon: '💪',
    },
  ];

  return (
    <div className="lg:ml-64 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Other Apps by LevelUp Solutions</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <div
              key={app.name}
              className="rounded-lg border border-slate-800 bg-slate-950 p-6 hover:border-amber-500/50 transition-colors"
            >
              <div className="text-4xl mb-4">{app.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{app.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{app.description}</p>
              {app.comingSoon ? (
                <span className="inline-block px-3 py-1 rounded-md bg-slate-800 text-slate-400 text-xs">
                  Coming Soon
                </span>
              ) : (
                <a
                  href={app.href}
                  className="inline-block px-4 py-2 rounded-md bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors text-sm"
                >
                  Open App
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


