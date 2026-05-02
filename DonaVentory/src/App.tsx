import { useState } from 'react';
import Sidebar, { NAV_ITEMS } from '@/components/Sidebar';
import type { Tab } from '@/components/Sidebar';
import ProductionIntake from '@/components/ProductionIntake';
import ComingSoon from '@/components/ComingSoon';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('intake');

  const currentItem = NAV_ITEMS.find((item) => item.id === activeTab)!;

  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex flex-col flex-1 min-w-0">
        <header className="px-8 py-6 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">{currentItem.label}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{currentItem.description}</p>
        </header>

        {activeTab === 'intake' && <ProductionIntake />}
        {activeTab !== 'intake' && (
          <ComingSoon label={currentItem.label} description={currentItem.description} />
        )}
      </main>
    </div>
  );
}
