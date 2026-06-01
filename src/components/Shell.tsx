import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { NewItemDialog } from './NewItemDialog';
import { NewProjectDialog } from './NewProjectDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';
import { ProjectAppearanceDialog } from './ProjectAppearanceDialog';
import { AgentOverlay } from './AgentChat/AgentOverlay';
import { useUi } from '@/store/useUi';
import { useStore } from '@/store/useStore';
import { Bot } from './icons';

export default function Shell({ children }: { children: React.ReactNode }) {
  const openNewItem = useUi((s) => s.openNewItem);
  const newItemOpen = useUi((s) => s.newItemOpen);
  const newProjectOpen = useUi((s) => s.newProjectOpen);
  const closeNewProject = useUi((s) => s.closeNewProject);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const agentChatOpen = useUi((s) => s.agentChatOpen);
  const toggleAgentChat = useUi((s) => s.toggleAgentChat);
  const closeAgentChat = useUi((s) => s.closeAgentChat);

  // Global keyboard shortcut: "C" opens new-item dialog when not typing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (newItemOpen) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const editable = t?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
      if (editable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        openNewItem();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openNewItem, newItemOpen]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {children}
        {!agentChatOpen && (
          <button
            onClick={toggleAgentChat}
            title="Open planning agent"
            className="absolute bottom-5 right-5 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium shadow-lg shadow-violet-900/40 transition-colors z-10"
          >
            <Bot className="w-4 h-4" />
            Agent
          </button>
        )}
      </main>
      {agentChatOpen && <AgentOverlay onClose={closeAgentChat} />}
      <NewItemDialog />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={closeNewProject}
        onCreated={(id) => setCurrentProject(id)}
      />
      <ConfirmDialog />
      <ContextMenu />
      <ProjectAppearanceDialog />
    </div>
  );
}
