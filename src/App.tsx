import { Routes, Route, Navigate } from 'react-router-dom';
import BoardRoute from './routes/BoardRoute';
import ItemRoute from './routes/ItemRoute';
import Shell from './components/Shell';
import { AuthGate } from './components/AuthGate';

export default function App() {
  return (
    <AuthGate>
      <Shell>
        <Routes>
          <Route path="/" element={<BoardRoute />} />
          <Route path="/items/:id" element={<ItemRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </AuthGate>
  );
}
