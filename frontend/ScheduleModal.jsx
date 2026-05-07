import { useState } from "react";
import { Save, Clock, Ban } from "lucide-react";
import { Modal } from "./SharedUI.jsx";
import { DAYS, DAY_LABELS, TIME_OPTIONS } from "./constants.js";

const DEFAULT_SCHEDULE = () =>
  Object.fromEntries(
    DAYS.map(d => [d, { start: "08:00 AM", end: "05:00 PM", unavailable: false }])
  );

export default function ScheduleModal({ open, onClose, onSave, initial }) {
  const [schedule, setSchedule] = useState(() => {
    if (initial && typeof initial === "object") {
      return { ...DEFAULT_SCHEDULE(), ...initial };
    }
    return DEFAULT_SCHEDULE();
  });
  const [saving, setSaving] = useState(false);

  const update = (day, field, value) => {
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(schedule);
    setSaving(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Weekly Consultation Schedule" size="xl">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {DAYS.map(day => {
          const s = schedule[day] || { start: "08:00 AM", end: "05:00 PM", unavailable: false };
          return (
            <div
              key={day}
              className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border transition-all ${
                s.unavailable ? "bg-gray-50 border-gray-200 opacity-60" : "bg-blue-50 border-blue-100"
              }`}
            >
              <span className="w-10 font-semibold text-sm text-urs-blue font-display">
                {DAY_LABELS[day]}
              </span>
              <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={s.unavailable}
                  onChange={e => update(day, "unavailable", e.target.checked)}
                  className="rounded"
                />
                <Ban size={12} className="text-gray-400" />
                No Class
              </label>
              {!s.unavailable && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-urs-blue" />
                    <select
                      value={s.start}
                      onChange={e => update(day, "start", e.target.value)}
                      className="text-sm border border-blue-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-urs-blue/30"
                    >
                      {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <span className="text-gray-400 text-xs">to</span>
                    <select
                      value={s.end}
                      onChange={e => update(day, "end", e.target.value)}
                      className="text-sm border border-blue-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-urs-blue/30"
                    >
                      {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-gray-100 pt-4">
        <button onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
          <Save size={15} />
          {saving ? "Saving..." : "Save Schedule"}
        </button>
      </div>
    </Modal>
  );
}

