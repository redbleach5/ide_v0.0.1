import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { EditorPanel } from './EditorPanel';
import { Tab, IDESettings } from '../types';
import { Split, X, Maximize2 } from 'lucide-react';

interface SplitEditorPanelProps {
  tabs: Tab[];
  activeTab: Tab | null;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tab: Tab) => void;
  onTabContentChange: (tabId: string, content: string) => void;
  onSave?: (tabId: string) => void;
  settings: IDESettings;
  projectContext?: {
    files?: Tab[];
    projectPath?: string;
  };
}

type SplitDirection = 'horizontal' | 'vertical' | 'none';

interface EditorGroup {
  id: string;
  tabs: Tab[];
  activeTab: Tab | null;
}

export const SplitEditorPanel: React.FC<SplitEditorPanelProps> = ({
  tabs,
  activeTab,
  onTabClose,
  onTabSelect,
  onTabContentChange,
  onSave,
  settings,
  projectContext
}) => {
  const [splitDirection, setSplitDirection] = useState<SplitDirection>('none');
  const [editorGroups, setEditorGroups] = useState<EditorGroup[]>([
    { id: 'main', tabs: tabs, activeTab: activeTab }
  ]);

  const handleSplit = (direction: 'horizontal' | 'vertical') => {
    if (splitDirection === 'none') {
      // Create second editor group
      const newGroup: EditorGroup = {
        id: `editor-${Date.now()}`,
        tabs: [],
        activeTab: null
      };
      setEditorGroups([...editorGroups, newGroup]);
      setSplitDirection(direction);
    } else {
      // Toggle split direction
      setSplitDirection(direction);
    }
  };

  const handleUnsplit = () => {
    // Merge all tabs back to first group
    const allTabs = editorGroups.flatMap(g => g.tabs);
    setEditorGroups([{ id: 'main', tabs: allTabs, activeTab: activeTab }]);
    setSplitDirection('none');
  };

  const handleTabCloseInGroup = (groupId: string, tabId: string) => {
    setEditorGroups(groups =>
      groups.map(group => {
        if (group.id === groupId) {
          const newTabs = group.tabs.filter(t => t.id !== tabId);
          const newActiveTab = group.activeTab?.id === tabId
            ? (newTabs.length > 0 ? newTabs[newTabs.length - 1] : null)
            : group.activeTab;
          return { ...group, tabs: newTabs, activeTab: newActiveTab };
        }
        return group;
      })
    );
    onTabClose(tabId);
  };

  const handleTabSelectInGroup = (groupId: string, tab: Tab) => {
    setEditorGroups(groups =>
      groups.map(group =>
        group.id === groupId ? { ...group, activeTab: tab } : group
      )
    );
    onTabSelect(tab);
  };

  const handleTabContentChangeInGroup = (groupId: string, tabId: string, content: string) => {
    setEditorGroups(groups =>
      groups.map(group => {
        if (group.id === groupId) {
          return {
            ...group,
            tabs: group.tabs.map(t =>
              t.id === tabId ? { ...t, content, isDirty: true } : t
            )
          };
        }
        return group;
      })
    );
    onTabContentChange(tabId, content);
  };

  // Sync with external tabs/activeTab changes
  React.useEffect(() => {
    if (editorGroups.length > 0) {
      const mainGroup = editorGroups[0];
      // Update main group with external changes
      setEditorGroups(groups =>
        groups.map((group, index) =>
          index === 0
            ? { ...group, tabs: tabs, activeTab: activeTab }
            : group
        )
      );
    }
  }, [tabs, activeTab]);

  if (splitDirection === 'none') {
    return (
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Split controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shadow-lg">
          <button
            onClick={() => handleSplit('horizontal')}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Разделить горизонтально (Ctrl+\)"
          >
            <Split className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => handleSplit('vertical')}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Разделить вертикально (Ctrl+Alt+\)"
          >
            <Split className="w-4 h-4 text-gray-600 dark:text-gray-400 rotate-90" />
          </button>
        </div>

        <EditorPanel
          tabs={tabs}
          activeTab={activeTab}
          onTabClose={onTabClose}
          onTabSelect={onTabSelect}
          onTabContentChange={onTabContentChange}
          onSave={onSave}
          settings={settings}
          projectContext={projectContext}
        />
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* Split controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shadow-lg">
        <button
          onClick={() => setSplitDirection('horizontal')}
          className={`p-1.5 rounded transition-colors ${
            splitDirection === 'horizontal'
              ? 'bg-blue-500 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
          title="Горизонтальное разделение"
        >
          <Split className="w-4 h-4" />
        </button>
        <button
          onClick={() => setSplitDirection('vertical')}
          className={`p-1.5 rounded transition-colors ${
            splitDirection === 'vertical'
              ? 'bg-blue-500 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
          title="Вертикальное разделение"
        >
          <Split className="w-4 h-4 rotate-90" />
        </button>
        <button
          onClick={handleUnsplit}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
          title="Объединить (Ctrl+Alt+W)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <PanelGroup
        direction={splitDirection === 'horizontal' ? 'horizontal' : 'vertical'}
        className="flex-1"
      >
        {editorGroups.map((group, index) => (
          <React.Fragment key={group.id}>
            <Panel defaultSizePercentage={50} minSizePercentage={20} className="flex flex-col overflow-hidden">
              <EditorPanel
                tabs={group.tabs}
                activeTab={group.activeTab}
                onTabClose={(tabId) => handleTabCloseInGroup(group.id, tabId)}
                onTabSelect={(tab) => handleTabSelectInGroup(group.id, tab)}
                onTabContentChange={(tabId, content) =>
                  handleTabContentChangeInGroup(group.id, tabId, content)
                }
                onSave={onSave}
                settings={settings}
                projectContext={projectContext}
              />
            </Panel>
            {index < editorGroups.length - 1 && (
              <PanelResizeHandle className="w-1 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors" />
            )}
          </React.Fragment>
        ))}
      </PanelGroup>
    </div>
  );
};
