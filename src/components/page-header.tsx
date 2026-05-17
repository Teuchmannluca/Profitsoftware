interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex h-16 items-center justify-between px-8">
        <div className="space-y-0.5">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {action && <div className="flex items-center gap-3">{action}</div>}
      </div>
    </div>
  );
}
