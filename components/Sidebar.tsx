import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  FolderPlus, 
  Trash2, 
  Edit2,
  Check,
  Download,
  RotateCcw,
  RefreshCw,
  BookOpen,
  Layout,
  Settings
} from 'lucide-react';
import { FileNode, NodeType } from '../types';
import { CORNELL_TEMPLATE } from '../initialData';

interface SidebarProps {
  nodes: FileNode[];
  activeFileId: string | null;
  expandedFolders: Set<string>;
  onFileSelect: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onAddFile: (parentId: string | null, content?: string, name?: string, isCornell?: boolean) => Promise<void>;
  onAddFolder: (parentId: string | null) => Promise<void>;
  onDeleteNode: (id: string) => Promise<void>;
  onRenameNode: (id: string, newName: string) => Promise<void>;
  onMoveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
  onShowSettings: () => void;
}

// Map structure for O(1) children lookup
type NodeMap = Map<string | null, FileNode[]>;

interface NodeItemProps extends Omit<SidebarProps, 'nodes'> {
  node: FileNode;
  level: number;
  nodeMap: NodeMap;
  editingId: string | null;
  onEditStart: (id: string) => void;
  onEditCancel: () => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}

const NodeItem: React.FC<NodeItemProps> = ({ 
  node, 
  level, 
  nodeMap, 
  activeFileId, 
  expandedFolders, 
  editingId,
  onFileSelect, 
  onToggleFolder,
  onAddFile,
  onAddFolder,
  onDeleteNode,
  onRenameNode,
  onMoveNode,
  onEditStart,
  onEditCancel,
  onContextMenu,
  onShowSettings
}) => {
  const isEditing = editingId === node.id;
  const [editName, setEditName] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFolder = node.type === NodeType.FOLDER;
  const isExpanded = expandedFolders.has(node.id);
  const isActive = node.id === activeFileId;
  
  const children = nodeMap.get(node.id) || [];

  useEffect(() => {
    if (isEditing) {
      setEditName(node.name);
    }
  }, [isEditing, node.name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editName.trim() && editName.trim() !== node.name) {
      onRenameNode(node.id, editName.trim());
    }
    onEditCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onEditCancel();
    } else if (e.key === 'Enter') {
      handleRenameSubmit(e);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
        onDeleteNode(node.id);

  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('nodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFolder) {
        setIsDragOver(true);
        e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (!isFolder) return;
    
    const draggedNodeId = e.dataTransfer.getData('nodeId');
    if (draggedNodeId && draggedNodeId !== node.id) {
        onMoveNode(draggedNodeId, node.id);
        if (!isExpanded) {
            onToggleFolder(node.id);
        }
    }
  };

  return (
    <div className="select-none">
      <div 
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex items-start px-3 py-1.5 cursor-pointer transition-all relative text-xs font-medium rounded-lg mx-1 my-0.5 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'} ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
        onClick={() => isFolder ? onToggleFolder(node.id) : onFileSelect(node.id)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <span className="mr-2 opacity-40 flex shrink-0 mt-0.5">
          {isFolder && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
          {!isFolder && <span className="w-3.5 inline-block" />}
        </span>
        
        <span className={`mr-2.5 shrink-0 mt-0.5 ${isActive ? 'text-white' : (isFolder ? 'text-amber-400/80' : 'text-blue-400/80')}`}>
          {isFolder ? (isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />) : (node.isCornell ? <BookOpen size={16} /> : <FileText size={16} />)}
        </span>

        {isEditing ? (
          <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()} className="flex-1 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-slate-900 text-white border border-blue-500/50 rounded-md px-2 h-6 text-[11px] outline-none shadow-inner"
              onBlur={handleRenameSubmit}
            />
            <button type="submit" className="ml-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"><Check size={14} /></button>
          </form>
        ) : (
          <span className="flex-1 break-words whitespace-normal py-0.5 min-w-0 pr-2">{node.name}</span>
        )}

        {/* Quick Actions */}
        {!isEditing && (
          <div className="hidden group-hover:flex shrink-0 ml-auto gap-1 items-center self-start mt-0.5 bg-inherit pl-1">
             <button 
               onClick={(e) => { e.stopPropagation(); onEditStart(node.id); }}
               className="p-1 rounded-md text-white/20 hover:bg-white/10 hover:text-white transition-all"
               title="Rename"
             >
               <Edit2 size={12} />
             </button>
             
             {isFolder && (
               <>
                 <button 
                  onClick={(e) => { e.stopPropagation(); onAddFile(node.id); }}
                  className="p-1 rounded-md text-white/20 hover:bg-white/10 hover:text-white transition-all"
                  title="New File"
                 >
                   <Plus size={12} />
                 </button>
                 <button 
                  onClick={(e) => { e.stopPropagation(); onAddFolder(node.id); }}
                  className="p-1 rounded-md text-white/20 hover:bg-white/10 hover:text-white transition-all"
                  title="New Folder"
                 >
                   <FolderPlus size={12} />
                 </button>
               </>
             )}

             <button 
                onClick={handleDeleteClick}
                className="p-1 rounded-md text-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition-all"
                title="Delete"
             >
               <Trash2 size={12} />
             </button>
          </div>
        )}
      </div>

      {isFolder && isExpanded && (
        <div>
          {children.map(child => (
            <NodeItem 
              key={child.id} 
              node={child} 
              level={level + 1}
              nodeMap={nodeMap}
              editingId={editingId}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onContextMenu={onContextMenu}
              {...{activeFileId, expandedFolders, onFileSelect, onToggleFolder, onAddFile, onAddFolder, onDeleteNode, onRenameNode, onMoveNode, onShowSettings}}
            />
          ))}
          {children.length === 0 && (
            <div 
              className="italic text-[10px] text-white/20 py-2"
              style={{ paddingLeft: `${(level + 1) * 12 + 36}px` }}
            >
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = (props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, node: FileNode} | null>(null);
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string | null, FileNode[]>();
    props.nodes.forEach(node => {
      const parentId = node.parentId;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(node);
    });
    map.forEach(list => {
      list.sort((a, b) => {
        if (a.type !== b.type) return a.type === NodeType.FOLDER ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    });
    return map;
  }, [props.nodes]);

  const rootNodes = nodeMap.get(null) || [];

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleAction = (action: () => void) => {
      action();
      setContextMenu(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      if (e.target === e.currentTarget) setIsRootDragOver(true);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      if (e.target === e.currentTarget) setIsRootDragOver(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsRootDragOver(false);
      if (e.target === e.currentTarget) {
          const draggedNodeId = e.dataTransfer.getData('nodeId');
          if (draggedNodeId) props.onMoveNode(draggedNodeId, null);
      }
  };

  return (
    <div 
      className={`h-full flex flex-col relative bg-slate-950 border-r border-white/5 ${isRootDragOver ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
      onClick={() => setEditingId(null)}
    >
      {/* Context Menu */}
      {contextMenu && (
          <div 
            className="fixed inset-0 z-[10000]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          >
              <div 
                className="absolute bg-slate-900 border border-white/10 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] py-2 min-w-[200px] animate-in fade-in zoom-in duration-200 backdrop-blur-xl"
                style={{ 
                    top: Math.min(contextMenu.y, window.innerHeight - 240), 
                    left: Math.min(contextMenu.x, window.innerWidth - 210),
                }}
              >
                  <div className="px-4 py-2 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] border-b border-white/5 mb-2 truncate">
                      {contextMenu.node.name}
                  </div>
                  <button onClick={() => handleAction(() => setEditingId(contextMenu.node.id))} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                      <Edit2 size={14} className="opacity-50" /> Rename
                  </button>
                  {contextMenu.node.type === NodeType.FOLDER && (
                      <>
                        <button onClick={() => handleAction(() => props.onAddFile(contextMenu.node.id))} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                            <Plus size={14} className="opacity-50" /> New File
                        </button>
                        <button onClick={() => handleAction(() => props.onAddFile(contextMenu.node.id, CORNELL_TEMPLATE, 'Cornell Note', true))} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                            <BookOpen size={14} className="opacity-50" /> New Cornell Note
                        </button>
                        <button onClick={() => handleAction(() => props.onAddFolder(contextMenu.node.id))} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-all">
                            <FolderPlus size={14} className="opacity-50" /> New Folder
                        </button>
                      </>
                  )}
                  <div className="h-px bg-white/5 my-2 mx-2"></div>
                  <button 
                    onClick={() => {
                        if (deleteConfirmId === contextMenu.node.id) {
                            props.onDeleteNode(contextMenu.node.id);
                            setContextMenu(null);
                            setDeleteConfirmId(null);
                        } else {
                            setDeleteConfirmId(contextMenu.node.id);
                            setTimeout(() => setDeleteConfirmId(null), 3000);
                        }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-all ${deleteConfirmId === contextMenu.node.id ? 'text-red-400 bg-red-500/10' : 'text-red-500/60 hover:bg-red-500/10 hover:text-red-400'}`}
                  >
                      <Trash2 size={14} className="opacity-50" /> {deleteConfirmId === contextMenu.node.id ? 'Confirm Delete' : 'Delete'}
                  </button>
              </div>
          </div>
      )}

      <div className="h-16 border-b border-white/5 flex items-center justify-between px-5 shrink-0 bg-slate-950/50 backdrop-blur-md">
        <h2 className="font-black text-[10px] tracking-[0.25em] text-white/40 flex items-center gap-3">
           <FolderOpen size={18} className="text-blue-500"/>
           EXPLORER
        </h2>
        <div className="flex gap-1">
          <button onClick={() => props.onAddFile(null)} className="p-2 rounded-xl text-white/30 hover:bg-white/5 hover:text-white transition-all" title="New File"><Plus size={16} /></button>
          <button onClick={() => props.onAddFile(null, CORNELL_TEMPLATE, 'Cornell Note', true)} className="p-2 rounded-xl text-white/30 hover:bg-white/5 hover:text-white transition-all" title="New Cornell Note"><BookOpen size={16} /></button>
          <button onClick={() => props.onAddFolder(null)} className="p-2 rounded-xl text-white/30 hover:bg-white/5 hover:text-white transition-all" title="New Folder"><FolderPlus size={16} /></button>
          <button onClick={props.onShowSettings} className="p-2 rounded-xl text-white/30 hover:bg-white/5 hover:text-white transition-all" title="Settings"><Settings size={16} /></button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-10 custom-scrollbar">
        {rootNodes.map(node => (
          <NodeItem 
            key={node.id} 
            node={node} 
            level={0} 
            nodeMap={nodeMap}
            editingId={editingId}
            onEditStart={setEditingId}
            onEditCancel={() => setEditingId(null)}
            onContextMenu={handleContextMenu}
            {...props} 
          />
        ))}
        {rootNodes.length === 0 && (
          <div className="text-center mt-20 px-8">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
              <FileText size={24} className="text-white/20" />
            </div>
            <p className="text-xs text-white/30 font-medium leading-relaxed">
              No files found.<br/>Right click or use buttons to add.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};