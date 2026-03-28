
'use client';
import React, { useRef, useState } from 'react';
import { 
  Bold, Italic, Strikethrough, 
  Heading1, Heading2, Heading3, 
  List, ListOrdered, CheckSquare, 
  Quote, Code, Link, Image, Table, Minus,
  Sigma, Workflow, Hexagon, Activity, Atom, 
  Terminal, Upload, FileImage, Globe, Copy, Check, X,
  Layout, Cpu, MapPin, Pencil, Video, Volume2, Sparkles, Pin
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../utils/db';
import { 
  PLOT_TEMPLATE, PHYSICS_TEMPLATE, REACTION_TEMPLATE, getIdeTemplate, getAnnotateTemplate, getSketchTemplate, getVideoTemplate, getAudioTemplate, getMediaTemplate, getBoardTemplate, HPC_ROADMAP_TEMPLATE 
} from './templates';
import { compressImageToTarget } from '../../utils/imageUtils';

type TabName = 'Write' | 'Insert' | 'Math/Sci';

export const EditorToolbar = ({ 
  insertFormat, 
  readOnly, 
  isCornell, 
  isCornellMode, 
  onToggleCornell 
}: { 
  insertFormat: (p: string, s?: string, b?: boolean) => void, 
  readOnly?: boolean,
  isCornell?: boolean,
  isCornellMode?: boolean,
  onToggleCornell?: (val: boolean) => void
}) => {
  const [activeTab, setActiveTab] = useState<TabName>('Write');
  const [uploadStatus, setUploadStatus] = useState<{name: string, syntax: string, size?: number} | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (readOnly) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio' = 'image', mode: 'normal' | 'annotate' = 'normal') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Store in IndexedDB
      const blobId = uuidv4();
      await db.blobs.add({
        id: blobId,
        data: file,
        type: file.type,
        name: file.name,
        createdAt: Date.now()
      });

      const blobSrc = `blob-id:${blobId}`;
      let syntax = '';
      
      if (type === 'image') {
        if (mode === 'annotate') {
          syntax = getAnnotateTemplate(blobSrc);
        } else {
          syntax = `<img src="${blobSrc}" alt="${file.name}" />`;
        }
      } else if (type === 'video') {
        syntax = getMediaTemplate('video', blobSrc);
      } else if (type === 'audio') {
        syntax = getMediaTemplate('audio', blobSrc);
      }

      insertFormat(`\n${syntax}\n`, '', true);
      setUploadStatus({ name: file.name, syntax, size: file.size });
    } catch (err) {
      console.error(err);
      alert(`Failed to upload ${type}.`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = () => {
    if (uploadStatus) {
      navigator.clipboard.writeText(uploadStatus.syntax);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const ToolbarButton = ({ icon: Icon, title, action, color }: { icon: any, title: string, action: () => void, color?: string }) => (
    <button 
      onClick={action} 
      className="p-1.5 rounded-md text-text-muted hover:bg-hover-bg hover:text-text-main transition-colors" 
      title={title} 
      style={{ color: color }}
    >
      <Icon size={16} />
    </button>
  );
  
  const Group = ({ children, label }: { children: React.ReactNode, label?: string }) => (
    <div className="flex items-center gap-0.5 px-2 border-r border-border-color relative last:border-r-0">
      {children}
      {label && <span className="absolute -bottom-1 left-0 right-0 text-center text-[6px] text-text-muted uppercase tracking-widest opacity-60 pointer-events-none">{label}</span>}
    </div>
  );

  return (
    <div className="border-b border-border-color bg-bg-toolbar relative">
       <div className="flex px-4 py-2 gap-2 bg-bg-main">
          {['Write', 'Insert', 'Math/Sci'].map((tab) => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab as TabName)}
               className={`px-3 py-1 text-[0.7rem] font-semibold rounded-full border border-border-color transition-colors cursor-pointer ${activeTab === tab ? 'bg-text-main text-bg-main' : 'bg-transparent text-text-main hover:bg-hover-bg'}`}
             >
               {tab}
             </button>
          ))}
       </div>

       <div className="px-2 pb-2 flex items-center overflow-x-auto h-12 no-scrollbar">
          {activeTab === 'Write' && (
            <>
              <Group label="Text">
                <ToolbarButton icon={Bold} title="Bold" action={() => insertFormat('**', '**')} />
                <ToolbarButton icon={Italic} title="Italic" action={() => insertFormat('*', '*')} />
                <ToolbarButton icon={Strikethrough} title="Strike" action={() => insertFormat('~~', '~~')} />
              </Group>
              <Group label="Header">
                <ToolbarButton icon={Heading1} title="H1" action={() => insertFormat('# ', '', true)} />
                <ToolbarButton icon={Heading2} title="H2" action={() => insertFormat('## ', '', true)} />
                <ToolbarButton icon={Heading3} title="H3" action={() => insertFormat('### ', '', true)} />
              </Group>
              <Group label="List">
                <ToolbarButton icon={List} title="Unordered" action={() => insertFormat('- ', '', true)} />
                <ToolbarButton icon={ListOrdered} title="Ordered" action={() => insertFormat('1. ', '', true)} />
                <ToolbarButton icon={CheckSquare} title="Tasks" action={() => insertFormat('- [ ] ', '', true)} />
              </Group>
              <Group label="Misc">
                <ToolbarButton icon={Quote} title="Quote" action={() => insertFormat('> ', '', true)} />
                <ToolbarButton icon={Minus} title="Divider" action={() => insertFormat('\n---\n', '', true)} />
                <ToolbarButton icon={Table} title="Table" action={() => insertFormat('| Col 1 | Col 2 |\n|---|---|\n| Cell | Cell |', '', true)} />
              </Group>
              {onToggleCornell && (
                <Group label="View">
                  <button 
                    onClick={() => onToggleCornell(!isCornellMode)} 
                    className={`p-1.5 rounded-md transition-colors ${isCornellMode ? 'bg-accent-color/10 text-accent-color' : 'text-text-muted hover:bg-hover-bg hover:text-text-main'}`}
                    title={isCornellMode ? "Switch to Standard View" : "Switch to Cornell View"}
                  >
                    <Layout size={16} />
                  </button>
                </Group>
              )}
            </>
          )}

          {activeTab === 'Insert' && (
            <>
              <Group label="Media">
                <ToolbarButton icon={Link} title="Web Link" action={() => insertFormat('[text](', ')') } />
                <ToolbarButton icon={Globe} title="Image URL" action={() => insertFormat('![alt](', ')') } />
                <ToolbarButton icon={MapPin} title="Annotated Image" action={() => insertFormat(getAnnotateTemplate(), '', true)} color="var(--accent-color)" />
                <ToolbarButton icon={Pencil} title="Sketch Board" action={() => insertFormat(getSketchTemplate(), '', true)} color="var(--accent-color)" />
                <ToolbarButton icon={Video} title="Video Player" action={() => insertFormat(getVideoTemplate(), '', true)} color="var(--accent-color)" />
                <ToolbarButton icon={Volume2} title="Audio Player" action={() => insertFormat(getAudioTemplate(), '', true)} color="var(--accent-color)" />
                <ToolbarButton icon={Upload} title="Upload Image" action={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.onchange = (e: any) => handleFileUpload(e, 'image');
                    fileInputRef.current.click();
                  }
                }} color="var(--accent-color)" />
                <ToolbarButton icon={Video} title="Upload Video" action={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'video/*';
                    fileInputRef.current.onchange = (e: any) => handleFileUpload(e, 'video');
                    fileInputRef.current.click();
                  }
                }} color="var(--accent-color)" />
                <ToolbarButton icon={Volume2} title="Upload Audio" action={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'audio/*';
                    fileInputRef.current.onchange = (e: any) => handleFileUpload(e, 'audio');
                    fileInputRef.current.click();
                  }
                }} color="var(--accent-color)" />
                <ToolbarButton icon={FileImage} title="Upload & Annotate" action={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.onchange = (e: any) => handleFileUpload(e, 'image', 'annotate');
                    fileInputRef.current.click();
                  }
                }} color="var(--accent-color)" />
                <input type="file" ref={fileInputRef} className="hidden" />
              </Group>
              <Group label="Code">
                <ToolbarButton icon={Code} title="Inline" action={() => insertFormat('`', '`')} />
                <ToolbarButton icon={Terminal} title="Block" action={() => insertFormat('```\n', '\n```', true)} />
                <ToolbarButton icon={Cpu} title="Interactive IDE" action={() => insertFormat(getIdeTemplate(), '', true)} color="var(--accent-color)" />
              </Group>
              <Group label="Diagram">
                <ToolbarButton icon={Workflow} title="Mermaid" action={() => insertFormat('```mermaid\n', '\n```', true)} color="#c084fc" />
                <ToolbarButton icon={Activity} title="Plotly" action={() => insertFormat(PLOT_TEMPLATE, '', true)} color="#c084fc" />
                <ToolbarButton icon={Pin} title="Investigation Board" action={() => insertFormat(getBoardTemplate(), '', true)} color="#c084fc" />
                <ToolbarButton icon={Cpu} title="HPC Roadmap" action={() => insertFormat(HPC_ROADMAP_TEMPLATE, '', true)} color="#c084fc" />
              </Group>
            </>
          )}

          {activeTab === 'Math/Sci' && (
            <>
              <Group label="LaTeX">
                <ToolbarButton icon={Sigma} title="Math" action={() => insertFormat('$$\n', '\n$$', true)} color="#60a5fa" />
              </Group>
              <Group label="Chemistry">
                <ToolbarButton icon={Hexagon} title="SMILES" action={() => insertFormat('```smiles\n', '\n```', true)} color="#60a5fa" />
                <ToolbarButton icon={Activity} title="Reaction" action={() => insertFormat(REACTION_TEMPLATE, '', true)} color="#60a5fa" />
              </Group>
              <Group label="Physics">
                <ToolbarButton icon={Atom} title="Physics" action={() => insertFormat(PHYSICS_TEMPLATE, '', true)} color="#f87171" />
              </Group>
            </>
          )}
       </div>

       {uploadStatus && (
         <div className="absolute top-full left-0 right-0 z-[100] bg-bg-sidebar border-b border-border-color px-4 py-2 flex items-center justify-between text-[0.75rem] shadow-xl animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                <FileImage size={14} className="text-accent-color" />
                <span className="text-text-muted">Uploaded:</span>
                <code className="bg-hover-bg px-1 rounded text-accent-color truncate max-w-[300px]">{uploadStatus.syntax}</code>
                {uploadStatus.size !== undefined && <span className="ml-2 text-text-muted font-mono">({(uploadStatus.size / 1024).toFixed(1)} KB)</span>}
            </div>
            <div className="flex gap-2 ml-4">
                <button onClick={copyToClipboard} className="flex items-center gap-1.5 px-2 py-1 rounded border border-border-color text-text-main hover:bg-hover-bg transition-colors">
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => setUploadStatus(null)} className="p-1 text-text-muted hover:text-text-main transition-colors"><X size={14}/></button>
            </div>
         </div>
       )}
    </div>
  );
};
