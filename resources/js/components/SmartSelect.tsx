import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { labInputClass } from "../xpande/XpandeUi";

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SmartSelectProps {
  options: SelectOption[];
  value: string | number | "";
  onChange: (value: string) => void;
  /** Si se pasa, agrega una primera opción vacía con este texto (ej: "Seleccionar…", "—"). */
  emptyLabel?: string;
  disabled?: boolean;
  isLight: boolean;
  /** Sobreescribe el umbral global definido en selectConfig.ts */
  threshold?: number;
}

/**
 * Select inteligente: si las opciones son pocas (≤ umbral) usa select nativo;
 * si superan el umbral muestra un campo con búsqueda/autocomplete.
 * Umbral global configurable en resources/js/config/selectConfig.ts.
 */
export function SmartSelect({
  options,
  value,
  onChange,
  emptyLabel,
  disabled = false,
  isLight,
}: SmartSelectProps) {
  return (
    <AutocompleteSelect
      options={options}
      value={value}
      onChange={onChange}
      emptyLabel={emptyLabel}
      disabled={disabled}
      isLight={isLight}
    />
  );
}

// ---------------------------------------------------------------------------

function AutocompleteSelect({
  options,
  value,
  onChange,
  emptyLabel,
  disabled = false,
  isLight,
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const allOptions: SelectOption[] =
    emptyLabel !== undefined ? [{ value: "", label: emptyLabel }, ...options] : options;

  const filtered = query.trim()
    ? allOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : allOptions;

  const selected = allOptions.find((o) => String(o.value) === String(value));
  const isEmpty = value === "" || value === null || value === undefined;

  // Cierra al hacer click fuera del componente
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Foco en el buscador al abrir
  useEffect(() => {
    if (open) {
      setHighlighted(0);
      // Pequeño delay para esperar que el DOM se monte
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Scroll automático al item resaltado
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const opt = filtered[highlighted];
        if (opt) {
          onChange(String(opt.value));
          setOpen(false);
          setQuery("");
        }
        break;
      }
    }
  }

  function select(opt: SelectOption) {
    onChange(String(opt.value));
    setOpen(false);
    setQuery("");
  }

  // Estilos del botón disparador
  const triggerClass = [
    labInputClass(isLight),
    "flex items-center justify-between gap-2 text-left",
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
  ].join(" ");

  // Color del texto disparador: placeholder vs valor seleccionado
  const triggerTextClass = isEmpty
    ? isLight
      ? "flex-1 truncate text-[#9CA3AF]"
      : "flex-1 truncate text-zinc-600"
    : "flex-1 truncate";

  // Contenedor del dropdown
  const dropdownClass = isLight
    ? "absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-lg"
    : "absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-white/[0.10] bg-[#161616] shadow-2xl";

  // Separador entre buscador y lista
  const dividerClass = isLight ? "border-b border-[#E5E7EB]" : "border-b border-white/[0.06]";

  function itemClass(i: number, opt: SelectOption) {
    const base = "px-3 py-2 text-sm cursor-pointer select-none transition-colors";
    const isHL = i === highlighted;
    const isSel = String(opt.value) === String(value);
    if (isHL) {
      return isLight
        ? `${base} bg-[#EBF5FF] text-[#007BFF]`
        : `${base} bg-[#007BFF]/15 text-[#7AB8FF]`;
    }
    if (isSel) {
      return isLight
        ? `${base} bg-[#F0F9FF] text-[#005BBF] font-medium`
        : `${base} bg-[#007BFF]/10 text-[#7AB8FF] font-medium`;
    }
    return isLight
      ? `${base} text-[#111827] hover:bg-[#F3F4F6]`
      : `${base} text-zinc-200 hover:bg-white/[0.05]`;
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={triggerClass}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={triggerTextClass}>
          {selected ? selected.label : (emptyLabel ?? "Seleccionar…")}
        </span>
        <ChevronDown
          size={14}
          className={["shrink-0 transition-transform duration-150", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <div className={dropdownClass}>
          <div className={`px-2 pt-2 pb-1.5 ${dividerClass}`}>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              placeholder="Buscar…"
              className={labInputClass(isLight)}
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li
                className={[
                  "px-3 py-2 text-sm",
                  isLight ? "text-[#9CA3AF]" : "text-zinc-600",
                ].join(" ")}
              >
                Sin resultados
              </li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={String(opt.value)}
                  role="option"
                  aria-selected={String(opt.value) === String(value)}
                  className={itemClass(i, opt)}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => select(opt)}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
