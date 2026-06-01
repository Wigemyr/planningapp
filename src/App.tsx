import { Routes, Route, Navigate } from 'react-router-dom';
import BoardRoute from './routes/BoardRoute';
import ItemRoute from './routes/ItemRoute';
import GraphRoute from './routes/GraphRoute';
import SettingsRoute from './routes/SettingsRoute';
import TrashRoute from './routes/TrashRoute';
import PendingInviteRoute from './routes/PendingInviteRoute';
import Shell from './components/Shell';
import { AuthGate } from './components/AuthGate';
import { useStore } from './store/useStore';

export default function App() {
  return (
    <AuthGate>
      <AppInner />
    </AuthGate>
  );
}

function AppInner() {
  const needsInvite = useStore((s) => s.needsInvite);
  const loading = useStore((s) => s.loading);

  if (loading && !useStore.getState().currentWorkspaceId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-muted text-[13px]">
        Loading…
      </div>
    );
  }
  if (needsInvite) {
    return <PendingInviteRoute />;
  }
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<BoardRoute />} />
        <Route path="/items/:id" element={<ItemRoute />} />
        <Route path="/graph" element={<GraphRoute />} />
        <Route path="/settings" element={<SettingsRoute />} />
        <Route path="/trash" element={<TrashRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
