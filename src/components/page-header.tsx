import { MobileMenuButton } from "@/components/sidebar";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <div className="space-y-0.5">
            <h1 className="text-sm md:text-base font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">{subtitle}</p>
          </div>
        </div>
        {action && <div className="flex items-center gap-2 md:gap-3">{action}</div>}
      </div>
    </div>
  );
}
