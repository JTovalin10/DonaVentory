export default function Disclaimer({ message }: { message: string }) {
    return (
        <div className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-mono bg-destructive/10 border-destructive/30 text-destructive">
            <span className="text-xs shrink-0">●</span>
            {message}
        </div>
    );
}
