export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1A1D23] border border-white/10 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-black text-white">{title}</h1>
        {subtitle && <p className="text-sm text-[#8b8fa3] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, delta, color = "#22D1C3" }: { label: string; value: string | number; delta?: string; color?: string }) {
  return (
    <div className="bg-[#1A1D23] border border-white/10 rounded-2xl p-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b8fa3]">{label}</div>
      <div className="text-3xl font-black mt-2" style={{ color }}>{value}</div>
      {delta && <div className="text-xs text-[#a8b4cf] mt-1">{delta}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones = {
    neutral: "bg-white/10 text-[#dde3f5]",
    success: "bg-[#4ade80]/15 text-[#4ade80]",
    warning: "bg-[#FFD700]/15 text-[#FFD700]",
    danger: "bg-[#FF2D78]/15 text-[#FF2D78]",
    info: "bg-[#22D1C3]/15 text-[#22D1C3]",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-[#1A1D23] border border-white/10 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/10">
            {headers.map((h, i) => (
              <th key={i} className="text-left text-[11px] font-bold uppercase tracking-wider text-[#8b8fa3] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">{children}</tr>;
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

export function Button({ children, onClick, variant = "primary", size = "md", type = "button", disabled, className = "" }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-[#22D1C3] text-[#0F1115] hover:bg-[#1bb3a7]",
    secondary: "bg-white/10 text-white hover:bg-white/15",
    danger: "bg-[#FF2D78] text-white hover:bg-[#e0255f]",
    ghost: "text-[#dde3f5] hover:bg-white/5",
  };
  const sizes = { sm: "px-2.5 py-1 text-xs", md: "px-4 py-2 text-sm" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ name, defaultValue, value, onChange, placeholder, type = "text", required, className = "" }: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8b8fa3] focus:outline-none focus:border-[#22D1C3]/50 ${className}`}
    />
  );
}

export function Select({ name, value, defaultValue, onChange, children, className = "" }: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22D1C3]/50 ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({ name, defaultValue, value, onChange, placeholder, rows = 4, className = "" }: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      name={name}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8b8fa3] focus:outline-none focus:border-[#22D1C3]/50 ${className}`}
    />
  );
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {description && <p className="text-sm text-[#8b8fa3] mt-1 max-w-sm mx-auto">{description}</p>}
    </div>
  );
}
