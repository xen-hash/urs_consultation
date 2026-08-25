import DepartmentIcon, { shortDepartment, departmentColor } from "../ui/DepartmentIcon.jsx";

/**
 * The department filter, shared by Faculty and Credentials.
 *
 * The two tabs list the same forty-odd people for different reasons, and they
 * used to look like different products doing it — one a row of chips, the other
 * sticky department bands over a table. Same roster, same shape: this is the
 * filter both of them use.
 *
 * Chips scroll rather than wrap. A wrapping row changes height as you filter,
 * which shifts the list under your thumb mid-tap.
 */
export default function DepartmentChips({ chips, value, onChange, label = "Filter by department" }) {
  return (
    <div role="tablist" aria-label={label}
      className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-4">
      {chips.map(chip => {
        const selected = chip.id === value;
        const color = departmentColor(chip.id);
        return (
          <button
            key={chip.id || "all"}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(chip.id)}
            className={`shrink-0 inline-flex items-center gap-2 pl-2.5 pr-3 min-h-[40px] rounded-full
              border text-sm font-medium transition-colors duration-150
              ${selected
                ? "border-transparent text-white bg-brand"
                : "border-border bg-surface text-fg hover:bg-surface-2"}`}
          >
            {chip.id && (
              <span className="w-5 h-5 rounded-full grid place-items-center shrink-0"
                style={selected
                  ? { background: "rgb(255 255 255 / 0.22)", color: "#fff" }
                  : { background: color.tint, color: color.ink }}>
                <DepartmentIcon department={chip.id} size={12} />
              </span>
            )}
            {chip.id ? shortDepartment(chip.id) : "All"}
            <span className={`text-xs tabular-nums ${selected ? "text-white/75" : "text-muted-fg"}`}>
              {chip.count}/{chip.total}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The tile that marks which department a row belongs to. Fixed size: Tailwind
 *  compiles the classes it can see, so an interpolated `w-${n}` never lands. */
export function DepartmentTile({ department }) {
  const color = departmentColor(department);
  return (
    <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
      style={{ background: color.tint, color: color.ink }}>
      <DepartmentIcon department={department} size={17} />
    </span>
  );
}
