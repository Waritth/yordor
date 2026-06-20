// Small shared presentational helpers (Tailwind). Rendered inside client trees.

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:pointer-events-none";
  const variants = {
    primary: "bg-[#1B5E20] text-white hover:bg-[#16511a] active:scale-[.98]",
    ghost: "bg-black/5 text-[#1B5E20] hover:bg-black/10",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
  } as const;
  return <button className={cx(base, variants[variant], className)} {...props} />;
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-black/5 bg-white p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-lg font-bold text-[#1B5E20]">{title}</h2>
        {subtitle && <p className="text-sm text-black/50">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
