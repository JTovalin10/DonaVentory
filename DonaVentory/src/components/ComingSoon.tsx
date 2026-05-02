interface ComingSoonProps {
  label: string;
  description: string;
}

export default function ComingSoon({ label, description }: ComingSoonProps) {
  return (
    <div className="p-8 max-w-2xl">
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted border border-border text-muted-foreground">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-md px-2.5 py-1">
          Coming soon
        </span>
      </div>
    </div>
  );
}
