const STEPS = [
    'Go into Prediko',
    'Click on Orders',
    'Click on Production Orders',
    'Find the order you created',
    'Change the status to Partially Received',
    'Change the status to Closed',
];

export default function SOPSteps() {
    return (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-2">
            <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest">
                For immediate stock update
            </p>
            <ol className="space-y-1">
                {STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="font-mono text-xs text-muted-foreground shrink-0 w-4 pt-px">{i + 1}.</span>
                        {step}
                    </li>
                ))}
            </ol>
        </div>
    );
}
