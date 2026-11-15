// Interruptor de 28 × 48 px dentro de um rótulo de 44 px de altura (o Switch do shadcn tem 20 × 36: pequeno demais
// para o dedo no celular, regra B8 do padrão).
import * as SwitchPrimitives from "@radix-ui/react-switch";

export default function Interruptor({ checked, onCheckedChange, disabled, rotulo, ariaLabel, className = "" }) {
  return (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}>
      {rotulo && <span className={`text-sm font-semibold ${checked ? "text-ok-ink" : "text-ink-3"}`}>{rotulo}</span>}
      <SwitchPrimitives.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
        className="peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 data-[state=checked]:bg-ok data-[state=unchecked]:bg-ink-4"
      >
        <SwitchPrimitives.Thumb className="pointer-events-none block h-6 w-6 rounded-full bg-white shadow-lg transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
      </SwitchPrimitives.Root>
    </label>
  );
}
