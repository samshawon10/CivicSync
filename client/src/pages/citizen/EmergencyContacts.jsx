import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import EmergencyContactManager from '../../components/emergency/EmergencyContactManager.jsx';

export default function EmergencyContacts() {
  return (
    <CitizenLayout title="Emergency Contacts">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h2 className="text-lg font-black text-ink dark:text-slate-100">People we can reference during an SOS</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">When you activate SOS or "I'm Not Safe", your enabled contacts are recorded with the incident so Emergency Command can reach them.</p>
        </div>
        <EmergencyContactManager />
      </div>
    </CitizenLayout>
  );
}