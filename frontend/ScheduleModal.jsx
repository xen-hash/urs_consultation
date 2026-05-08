import { useState } from "react";
import { Save, Clock, Ban, Plus, Trash2 } from "lucide-react";
import { Modal } from "./SharedUI.jsx";
import { DAYS, DAY_LABELS, TIME_OPTIONS } from "./constants.js";

const DEFAULT_SLOT = () => ({ start: "08:00 AM", end: "09:00 AM" });

const DEFAULT_SCHEDULE = () =>
  Object.fromEntries(
    DAYS.map(d => [d, { unavailable: false, slots: [DEFAULT_SLOT()], limit: 10 }])
  );

function normalizeSchedule(raw) {
  const base = DEFAULT_SCHEDULE();
  if (!raw || typeof raw !== "object") return base;
  const result = { ...base };
  for (const day of DAYS) {
    if (!raw[day]) continue;
    const d = raw[day];
    // Legacy format: { start, end, unavailable } → convert to new format
    if (d.start && !d.slots) {
      result[day] = {
        unavailable: !!d.unavailable,
        slots: [{ start: d.start, end: d.end || "05:00 PM" }],
        limit: d.limit || 10,
      };
    } else {
      result[day] = {
        unavailable: !!d.unavailable,
        slots: Array.isArray(d.slots) && d.slots.length > 0 ? d.slots : [DEFAULT_SLOT()],
        limit: d.limit || 10,
      };
    }
  }
  return result;
}

export default function ScheduleModal({ open, onClose, onSave, initial }) {
  const [schedule, setSchedule] = useState(() => normalizeSchedule(initial));
  const [saving, setSaving] = useState(false);

  const updateField = (day, field, value) =>
    setSchedule(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));

  const updateSlot = (day, idx, field, value) =>
    setSchedule(prev => {
      const slots = [...prev[day].slots];
      slots[idx] = { ...slots[idx], [field]: value };
      return { ...prev, [day]: { ...prev[day], slots } };
    });

  const addSlot = (day) =>
    setSchedule(prev => {
      if (prev[day].slots.length >= 4) return prev;
      return { ...prev, [day]: { ...prev[day], slots: [...prev[day].slots, DEFAULT_SLOT()] } };
    });

  const removeSlot = (day, idx) =>
    setSchedule(prev => {
      const slots = prev[day].slots.filter((_, i) => i !== idx);
      return { ...prev, [day]: { ...prev[day], slots: slots.length ? slots : [DEFAULT_SLOT()] } };
    });

  const handleSave = async () => {
    setSaving(true);
    await onSave(schedule);
    setSaving(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Weekly Consultation Schedule" size="xl">
      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {DAYS.map(day => {
          const s = schedule[day];
          return (
            <div key={day} className={`rounded-2xl border transition-all ${
              s.unavailable ? "bg-gray-50 border-gray-200 opacity-60" : "bg-blue-50 border-blue-100"
            }`}>
              {/* Day header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="w-10 font-bold text-sm text-[#003366] font-display">
                  {DAY_LABELS[day]}
                </span>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={s.unavailable}
                    onChange={e => updateField(day, "unavailable", e.target.checked)}
                    className="rounded" />
                  <Ban size={12} className="text-gray-400" /> No Class
                </label>
                {!s.unavailable && (
                  <>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Limit:</span>
                      <input
                        type="number" min={1} max={50}
                        value={s.limit}
                        onChange={e => updateField(day, "limit", Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]/30 text-center font-bold"
                      />
                      <span className="text-xs text-gray-400">slots</span>
                    </div>
                    {s.slots.length < 4 && (
                      <button onClick={() => addSlot(day)}
                        className="flex items-center gap-1 text-xs text-[#003366] font-semibold hover:bg-blue-100 px-2 py-1 rounded-lg transition-all">
                        <Plus size={12} /> Add Time
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Time slots */}
              {!s.unavailable && (
                <div className="px-4 pb-3 space-y-2">
                  {s.slots.map((slot, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-blue-100">
                      <span className="text-xs text-gray-400 font-medium w-16">
                        {idx === 0 ? "Morning" : idx === 1 ? "Noon" : idx === 2 ? "Afternoon" : "Evening"}
                      </span>
                      <Clock size={13} className="text-[#003366]" />
                      <select value={slot.start}
                        onChange={e => updateSlot(day, idx, "start", e.target.value)}
                        className="text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]/30">
                        {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <span className="text-gray-400 text-xs">to</span>
                      <select value={slot.end}
                        onChange={e => updateSlot(day, idx, "end", e.target.value)}
                        className="text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]/30">
                        {TIME_OPTIONS.map(t => <option key={t}>{t}</option>)}
                      </select>
                      {s.slots.length > 1 && (
                        <button onClick={() => removeSlot(day, idx)}
                          className="ml-auto text-red-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-3 border-t border-gray-100 pt-4">
        <button onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
          <Save size={15} />
          {saving ? "Saving..." : "Save Schedule"}
        </button>
      </div>
    </Modal>
  );
}