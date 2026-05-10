import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

interface SOP {
    id: string;
    title: string;
    description: string;
    steps: string[];
}

const SOPS: SOP[] = [
    {
        id: 'production-immediate',
        title: 'Immediate Stock Update',
        description: 'Manually update stock in Prediko after logging a production order',
        steps: [
            'Go into Prediko',
            'Click on Orders',
            'Click on Production Orders',
            'Find the order you created',
            'Change the status to Partially Received',
            'Change the status to Closed',
        ],
    },
];

export default function SOPs() {
    const [selected, setSelected] = useState<SOP | null>(null);

    if (selected) {
        return (
            <div className="p-8 max-w-2xl space-y-6">
                <button
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSelected(null)}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to SOPs
                </button>

                <div>
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">{selected.title}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{selected.description}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 px-5 py-4 space-y-3">
                    <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest">Steps</p>
                    <ol className="space-y-2">
                        {selected.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                                <span className="font-mono text-xs text-muted-foreground shrink-0 w-4 pt-0.5">{i + 1}.</span>
                                {step}
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl space-y-3">
            {SOPS.map((sop) => (
                <Card
                    key={sop.id}
                    className="cursor-pointer transition-colors hover:bg-accent hover:border-primary"
                    onClick={() => setSelected(sop)}
                >
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{sop.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{sop.description}</p>
                        </div>
                        <span className="text-muted-foreground text-xs font-mono shrink-0 ml-4">
                            {sop.steps.length} steps →
                        </span>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
