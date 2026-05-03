import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Tab = 'intake' | 'batch' | 'receipt' | 'adjustment' | 'reports';

export interface NavItem {
  id: Tab;
  label: string;
  description: string;
  icon: ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'intake',
    label: 'Production Orders',
    description: 'Log finished goods produced in-house',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'batch',
    label: 'Batch Production Orders',
    description: 'Log multiple finished goods at once',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="6" height="6" rx="1"/>
        <path d="M3 17h6M3 20h4"/>
        <path d="M13 6h8M13 12h8M13 18h8"/>
      </svg>
    ),
  },
  {
    id: 'receipt',
    label: 'Purchase Orders',
    description: 'Track and receive incoming supplier orders',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    id: 'adjustment',
    label: 'Stock Adjustment',
    description: 'Correct inventory discrepancies',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14"/>
        <line x1="4" y1="10" x2="4" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12" y2="3"/>
        <line x1="20" y1="21" x2="20" y2="16"/>
        <line x1="20" y1="12" x2="20" y2="3"/>
        <line x1="1" y1="14" x2="7" y2="14"/>
        <line x1="9" y1="8" x2="15" y2="8"/>
        <line x1="17" y1="16" x2="23" y2="16"/>
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'View activity logs and inventory trends',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="flex flex-col w-56 shrink-0 border-r border-border bg-sidebar h-svh sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shrink-0">
          D
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">DonaVentory</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-left text-sm transition-colors',
              activeTab === item.id
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="leading-tight">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
