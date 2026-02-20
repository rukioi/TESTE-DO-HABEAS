import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Building,
  Key,
  Settings,
  LogOut,
  CheckCircle,
  PlugZap,
  ChevronLeft,
  ChevronRight,
  Menu,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { Badge } from '@/components/ui/badge';

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Tenants', href: '/admin/tenants', icon: Building },
  { name: 'Chaves de Registro', href: '/admin/keys', icon: Key },
  { name: 'Evolution API', href: '/admin/evolution', icon: PlugZap },
  { name: 'Planos', href: '/admin/plans', icon: Activity },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Evitar hydration mismatch: ler preferência só no client
  useEffect(() => {
    const stored = localStorage.getItem('admin_sidebar_collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/admin/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Falha ao sair');
      navigate('/admin/login');
    }
  };

  const closeMobile = () => setMobileOpen(false);

  const NavLink = ({
    item,
    isActive,
    showLabel = true,
  }: {
    item: (typeof navigation)[0];
    isActive: boolean;
    showLabel?: boolean;
  }) => (
    <Link
      to={item.href}
      onClick={closeMobile}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium transition-colors',
        showLabel ? 'space-x-3 px-3 py-2' : 'justify-center p-2.5',
        isActive
          ? 'bg-[#e19a00] text-white hover:bg-[#c78b00]'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {showLabel && <span>{item.name}</span>}
    </Link>
  );

  const sidebarContent = (showLabel: boolean) => (
    <>
      <div
        className={cn(
          'relative w-full border-b border-white/10 overflow-hidden bg-[#0D1117]',
          showLabel ? 'h-[80px]' : 'h-[64px]'
        )}
      >
        <img
          src="/logo_oficial.png"
          alt="Habea Desk"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const link = (
            <NavLink key={item.name} item={item} isActive={isActive} showLabel={showLabel} />
          );
          if (!showLabel) {
            return (
              <Tooltip key={item.name} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="bg-[#2A2F45] border-gray-700 text-white">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full text-gray-300 hover:text-white hover:bg-white/10',
                !showLabel && 'justify-center p-2'
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src="/placeholder.svg" alt="Admin" />
                <AvatarFallback className="bg-[#2A2F45] text-gray-300">
                  {user?.name?.charAt(0) || 'A'}
                </AvatarFallback>
              </Avatar>
              {showLabel && (
                <div className="flex-1 text-left ml-3 min-w-0">
                  <div className="text-sm font-medium truncate">{user?.name || 'Admin'}</div>
                  <div className="text-xs text-gray-400 truncate">{user?.role || 'Administrador'}</div>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-[#2A2F45] border-gray-700"
            align={showLabel ? 'end' : 'start'}
            side={showLabel ? 'right' : 'right'}
            forceMount
          >
            <div className="flex items-center gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none min-w-0">
                <p className="font-medium text-white truncate">{user?.name || 'Usuário Admin'}</p>
                <p className="w-full truncate text-sm text-gray-400">{user?.email || ''}</p>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-gray-700" />
            <DropdownMenuItem
              className="text-gray-300 focus:bg-[#1B223C] focus:text-white"
              onSelect={(e) => e.preventDefault()}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-700" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-gray-300 focus:bg-[#1B223C] focus:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen bg-[#1B223C] overflow-hidden">
        {/* Overlay mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={closeMobile}
            aria-hidden
          />
        )}

        {/* Sidebar desktop: recolhível */}
        <aside
          className={cn(
            'hidden lg:flex flex-col bg-[#0D1117] text-white transition-[width] duration-200 ease-in-out z-50 relative',
            collapsed ? 'w-[72px]' : 'w-64'
          )}
        >
          {sidebarContent(!collapsed)}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-6 z-10 h-7 w-7 rounded-full border border-white/20 bg-[#0D1117] text-gray-400 hover:text-white hover:bg-white/10 shadow-md flex items-center justify-center"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </aside>

        {/* Sidebar mobile: drawer */}
        <aside
          className={cn(
            'fixed top-0 left-0 z-50 flex flex-col w-64 h-full bg-[#0D1117] text-white transition-transform duration-200 ease-in-out lg:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent(true)}
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-[#1B223C] border-b border-gray-800 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                {collapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </Button>
              <h2 className="text-base md:text-lg font-semibold text-white truncate">
                Painel Administrativo
              </h2>
            </div>
            <Badge
              variant="outline"
              className="text-green-400 border-green-500 bg-green-500/10 text-xs shrink-0"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Sistema Saudável</span>
            </Badge>
          </header>

          <main className="flex-1 overflow-auto bg-[#1B223C]">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
