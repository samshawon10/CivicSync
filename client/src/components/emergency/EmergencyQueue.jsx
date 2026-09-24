import EmergencyCard, { EmptyState, LoadingState } from './EmergencyCard.jsx';

export default function EmergencyQueue({ items = [], loading, onOpen, emptyTitle = 'No emergencies match the current filters.' }) {
  if (loading && !items.length) return <LoadingState text="Loading emergency queue…" />;
  if (!items.length) return <EmptyState title={emptyTitle} hint="New incidents appear here in real time." />;
  return (
    <div className="space-y-3">
      {items.map((item) => <EmergencyCard key={item._id} emergency={item} onOpen={onOpen} />)}
    </div>
  );
}