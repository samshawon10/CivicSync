import { label } from '../../services/emergencyService.js';

/**
 * Emergency type selector with an explicit "I'm not sure" option.
 * When the category is not_sure and advisory text is available, the parent
 * can render a suggestion via `suggestion` + `onAcceptSuggestion`.
 */
export default function EmergencyTypeSelector({ categories = [], value, onChange, suggestion = null, onAcceptSuggestion, showSuggestion = true }) {
  const active = categories.find((item) => item.key === value.category);
  const subcategories = active?.subcategories || ['other'];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Emergency type
          <select value={value.category || 'not_sure'} onChange={(e) => onChange({ ...value, category: e.target.value, subcategory: 'other' })}>
            {categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">
          Specific type
          <select value={value.subcategory || 'other'} onChange={(e) => onChange({ ...value, subcategory: e.target.value })}>
            {subcategories.map((item) => <option key={item} value={item}>{label(item)}</option>)}
          </select>
        </label>
      </div>
      {showSuggestion && value.category === 'not_sure' && suggestion && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="font-black text-blue-800">Suggested classification{suggestion.confidence ? ` — ${suggestion.confidence} confidence` : ''}</p>
          <p className="mt-1 text-blue-900">{label(suggestion.category)}{suggestion.subcategory && suggestion.subcategory !== 'other' ? ` · ${label(suggestion.subcategory)}` : ''}</p>
          {suggestion.responseTypes?.length > 0 && <p className="text-blue-900">Possible response: {suggestion.responseTypes.join(' + ')}</p>}
          <p className="mt-1 text-xs text-blue-700">{suggestion.source === 'rule_engine' ? 'Rule-based advisory suggestion. Emergency Command makes the final decision.' : 'Advisory suggestion only.'}</p>
          {onAcceptSuggestion && <button type="button" onClick={onAcceptSuggestion} className="mt-2 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-black text-white">Use this classification</button>}
        </div>
      )}
    </div>
  );
}