import { Bell, Settings, Search } from 'lucide-react';

export function TopAppBar() {
  return (
    <header className="fixed top-0 right-0 left-64 h-20 px-8 flex items-center justify-between z-30 pointer-events-none">
      {/* Background glass layer that only covers the header area */}
      <div className="absolute inset-0 bg-[#111318]/60 backdrop-blur-xl border-b border-surface-border -z-10 pointer-events-auto mask-image-b-fade"></div>
      
      <div className="flex-1 pointer-events-auto">
        <div className="flex items-center space-x-4">
          <h2 className="font-headline font-bold text-2xl text-white">Terminal 01</h2>
          <div className="flex items-center px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse mr-2"></div>
            <span className="font-label text-xs font-medium text-secondary tracking-widest uppercase">Live</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-6 pointer-events-auto">
        <div className="relative group">
          <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search menu items..." 
            className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all w-64"
          />
        </div>

        <button className="relative p-2 text-white/60 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error glow-cyan"></span>
        </button>

        <button className="p-2 text-white/60 hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-full border-2 border-white/10 overflow-hidden ml-2 cursor-pointer hover:border-primary/50 transition-colors">
          <img src="https://i.pravatar.cc/150?img=11" alt="Profile" className="w-full h-full object-cover" />
        </div>
      </div>
    </header>
  );
}
