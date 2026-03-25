
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { MermaidDiagram } from './engines/MermaidDiagram';
import { SmilesDiagram } from './engines/SmilesDiagram';
import { InteractivePlot } from './engines/InteractivePlot';
import { ModelViewerEngine } from './engines/ModelViewerEngine';
import { SketchBoardEngine } from './engines/SketchBoardEngine';
import { PhysicsSimulation } from './engines/PhysicsSimulation';
import { ImageAnnotationEngine } from './engines/ImageAnnotationEngine';
import { CodeEditorEngine } from './engines/CodeEditorEngine';
import { EditorToolbar } from './editor/EditorToolbar';
import { FileNode } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface EditorProps {
  content: string;
  fileName: string;
  allNodes: FileNode[];
  onChange: (content: string) => void;
  readOnly?: boolean;
  viewMode?: 'split' | 'editor' | 'preview';
  isCornell?: boolean;
}

const safeJsonParse = (str: string) => {
  try { return JSON.parse(str); } catch (e) { return null; }
};

export const Editor: React.FC<EditorProps> = ({ 
  content, 
  fileName, 
  allNodes, 
  onChange, 
  readOnly = false, 
  viewMode = 'split',
  isCornell = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [localContent, setLocalContent] = useState(content);
  const [isCornellMode, setIsCornellMode] = useState(isCornell);
  const lastSavedContent = useRef(content);
  const localContentRef = useRef(content);

  // Sync ref with state
  useEffect(() => {
    localContentRef.current = localContent;
  }, [localContent]);
  
  // Update local state when file changes
  useEffect(() => {
    if (content !== lastSavedContent.current) {
      setLocalContent(content);
      lastSavedContent.current = content;
      localContentRef.current = content;
    }
    setIsCornellMode(isCornell);
  }, [content, isCornell]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    lastSavedContent.current = val;
    onChange(val); // Real-time sync to parent state
  };

  const insertFormat = (prefix: string, suffix: string = '', block: boolean = false) => {
    if (!textareaRef.current) return;
    const { selectionStart: start, selectionEnd: end, value } = textareaRef.current;
    const selectedText = value.substring(start, end);
    let insertion = prefix + selectedText + suffix;
    if (block && start !== 0 && value[start - 1] !== '\n') insertion = '\n' + insertion;
    const newVal = value.substring(0, start) + insertion + value.substring(end);
    setLocalContent(newVal);
    onChange(newVal);
  };

  const handleIDEUpdate = useCallback((targetId: string, newConfigStr: string) => {
    const updated = localContentRef.current.replace(/```ide\s*([\s\S]*?)\s*```/g, (match, inner) => {
      const parsed = safeJsonParse(inner.trim());
      if (parsed?.internal_block_id === targetId) {
        return `\`\`\`ide\n${newConfigStr}\n\`\`\``;
      }
      return match;
    });
    
    if (updated !== localContentRef.current) {
      setLocalContent(updated);
      lastSavedContent.current = updated;
      onChange(updated);
    }
  }, [onChange]);

  const handleAnnotateUpdate = useCallback((targetId: string, newConfigStr: string) => {
    const updated = localContentRef.current.replace(/```annotate\s*([\s\S]*?)\s*```/g, (match, inner) => {
      const parsed = safeJsonParse(inner.trim());
      if (parsed?.internal_block_id === targetId) {
        return `\`\`\`annotate\n${newConfigStr}\n\`\`\``;
      }
      return match;
    });
    
    if (updated !== localContentRef.current) {
      setLocalContent(updated);
      lastSavedContent.current = updated;
      onChange(updated);
    }
  }, [onChange]);

  const handlePlotUpdate = useCallback((targetId: string, newConfigStr: string) => {
    const updated = localContentRef.current.replace(/```plot\s*([\s\S]*?)\s*```/g, (match, inner) => {
      const parsed = safeJsonParse(inner.trim());
      if (parsed?.internal_block_id === targetId) {
        return `\`\`\`plot\n${newConfigStr}\n\`\`\``;
      }
      return match;
    });
    
    if (updated !== localContentRef.current) {
      setLocalContent(updated);
      lastSavedContent.current = updated;
      onChange(updated);
    }
  }, [onChange]);

  const handleModelUpdate = useCallback((targetId: string, newConfigStr: string) => {
    const updated = localContentRef.current.replace(/```model\s*([\s\S]*?)\s*```/g, (match, inner) => {
      const parsed = safeJsonParse(inner.trim());
      if (parsed?.internal_block_id === targetId) {
        return `\`\`\`model\n${newConfigStr}\n\`\`\``;
      }
      return match;
    });
    
    if (updated !== localContentRef.current) {
      setLocalContent(updated);
      lastSavedContent.current = updated;
      onChange(updated);
    }
  }, [onChange]);

  const handleSketchUpdate = useCallback((targetId: string, newConfigStr: string) => {
    const updated = localContentRef.current.replace(/```sketch\s*([\s\S]*?)\s*```/g, (match, inner) => {
      const parsed = safeJsonParse(inner.trim());
      if (parsed?.internal_block_id === targetId) {
        return `\`\`\`sketch\n${newConfigStr}\n\`\`\``;
      }
      return match;
    });
    
    if (updated !== localContentRef.current) {
      setLocalContent(updated);
      lastSavedContent.current = updated;
      onChange(updated);
    }
  }, [onChange]);

  const markdownComponents = useMemo(() => ({
    p: ({ children }: any) => {
      if (isCornellMode) {
        const childrenArray = React.Children.toArray(children);
        const firstChild = childrenArray[0];
        if (typeof firstChild === 'string' && firstChild.startsWith('? ')) {
          return <div className="bg-blue-50/50 border-l-4 border-blue-500 p-3 my-2 text-sm italic text-blue-800 rounded-r-lg">{children}</div>;
        }
      }
      return <p className="mb-4 leading-relaxed">{children}</p>;
    },
    img: ({ src, alt, ...props }: any) => {
      if (!src) return null;
      return <img src={src} alt={alt} {...props} referrerPolicy="no-referrer" className="max-w-full h-auto rounded-lg my-4 shadow-md" />;
    },
    pre: ({ children }: any) => {
      // If the child is one of our custom engines, don't wrap in <pre>
      // ReactMarkdown wraps code blocks in <pre><code>...</code></pre>
      // We want to avoid the <pre> styles for our interactive blocks
      return <>{children}</>;
    },
    code({node, inline, className, children, ...props}: any) {
        const match = /language-([\w-]+)/.exec(className || '');
        const rawCodeContent = String(children).replace(/\n$/, '');
        if (!inline && match?.[1] === 'ide') {
            const parsed = safeJsonParse(rawCodeContent.trim());
            if (!parsed?.internal_block_id) return <pre>{rawCodeContent}</pre>;
            return (
              <CodeEditorEngine 
                key={parsed.internal_block_id}
                config={parsed}
                onUpdate={(newStr) => handleIDEUpdate(parsed.internal_block_id, newStr)}
              />
            );
        }
        if (!inline && match?.[1] === 'annotate') {
            const parsed = safeJsonParse(rawCodeContent.trim());
            return (
              <ImageAnnotationEngine 
                key={parsed?.internal_block_id || rawCodeContent}
                configStr={rawCodeContent} 
                onUpdate={(newStr) => handleAnnotateUpdate(parsed?.internal_block_id, newStr)}
                readOnly={readOnly}
              />
            );
        }
        if (!inline) {
          switch (match?.[1]) {
            case 'mermaid': return <MermaidDiagram chart={rawCodeContent} />;
            case 'smiles': return <SmilesDiagram smiles={rawCodeContent} />;
            case 'plot': {
              const parsed = safeJsonParse(rawCodeContent.trim());
              return (
                <InteractivePlot 
                  key={parsed?.internal_block_id || rawCodeContent}
                  configStr={rawCodeContent} 
                  onUpdate={(newStr) => parsed?.internal_block_id && handlePlotUpdate(parsed.internal_block_id, newStr)}
                />
              );
            }
            case 'model': {
              const parsed = safeJsonParse(rawCodeContent.trim());
              return (
                <ModelViewerEngine 
                  key={parsed?.internal_block_id || rawCodeContent}
                  configStr={rawCodeContent} 
                  onUpdate={(newStr) => parsed?.internal_block_id && handleModelUpdate(parsed.internal_block_id, newStr)}
                  readOnly={readOnly}
                />
              );
            }
            case 'sketch': {
              const parsed = safeJsonParse(rawCodeContent.trim());
              return (
                <SketchBoardEngine 
                  key={parsed?.internal_block_id || rawCodeContent}
                  configStr={rawCodeContent} 
                  onUpdate={(newStr) => parsed?.internal_block_id && handleSketchUpdate(parsed.internal_block_id, newStr)}
                  readOnly={readOnly}
                />
              );
            }
            case 'physics': return <PhysicsSimulation configStr={rawCodeContent} />;
          }
        }
        return <code className={className} {...props}>{children}</code>;
    },
    'model-viewer': (props: any) => {
      const config = {
        internal_block_id: props.id || uuidv4(),
        src: props.src,
        alt: props.alt,
        autoRotate: props['auto-rotate'] !== undefined,
        cameraControls: props['camera-controls'] !== undefined,
        exposure: props.exposure ? parseFloat(props.exposure) : 1,
        shadowIntensity: props['shadow-intensity'] ? parseFloat(props['shadow-intensity']) : 1,
        ...props
      };
      return (
        <ModelViewerEngine 
          configStr={JSON.stringify(config)} 
          onUpdate={() => {}} 
          readOnly={true} 
        />
      );
    },
    'sketch-board': (props: any) => {
      const config = {
        internal_block_id: props.id || uuidv4(),
        elements: [],
        ...props
      };
      return (
        <SketchBoardEngine 
          configStr={JSON.stringify(config)} 
          onUpdate={() => {}} 
          readOnly={true} 
        />
      );
    }
  }), [handleIDEUpdate, handleAnnotateUpdate, handlePlotUpdate, handleModelUpdate, handleSketchUpdate, readOnly, isCornellMode]);

  const cornellData = useMemo(() => {
    if (!isCornellMode) return null;
    
    const sections = {
      cues: '',
      notes: '',
      summary: ''
    };

    // Split by headers
    const parts = localContent.split(/(?=# Cues|# Notes|# Summary)/i);
    
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed.toLowerCase().startsWith('# cues')) {
        sections.cues = trimmed.replace(/# cues/i, '').trim();
      } else if (trimmed.toLowerCase().startsWith('# notes')) {
        sections.notes = trimmed.replace(/# notes/i, '').trim();
      } else if (trimmed.toLowerCase().startsWith('# summary')) {
        sections.summary = trimmed.replace(/# summary/i, '').trim();
      } else if (!sections.notes && trimmed) {
        sections.notes = trimmed;
      }
    });

    return sections;
  }, [isCornellMode, localContent]);

  return (
    <div className="h-full w-full flex flex-col bg-bg-main">
      <div className="shrink-0">
        {(viewMode !== 'preview' && !readOnly) && (
          <EditorToolbar 
            insertFormat={insertFormat} 
            readOnly={readOnly} 
            isCornell={isCornell}
            isCornellMode={isCornellMode}
            onToggleCornell={setIsCornellMode}
          />
        )}
      </div>
      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'split' || viewMode === 'editor') && (
            <div className={`h-full flex flex-col overflow-hidden ${viewMode === 'split' ? 'w-1/2 border-r border-border-color' : 'w-full'}`}>
                <textarea 
                  ref={textareaRef} 
                  className="w-full h-full p-4 bg-bg-main text-text-main border-none outline-none resize-none leading-relaxed overflow-auto editor-textarea" 
                  value={localContent} 
                  onChange={handleTextareaChange}
                  placeholder="# Type here..." 
                  spellCheck={false} 
                  disabled={readOnly} 
                />
            </div>
        )}
        {(viewMode === 'split' || viewMode === 'preview') && (
            <div ref={previewRef} id="markdown-preview" className={`h-full p-8 overflow-y-auto bg-bg-main no-scrollbar ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                {isCornellMode && cornellData ? (
                  <div className="flex flex-col h-full gap-4">
                    <div className="flex flex-1 gap-4 min-h-0">
                      <div className="w-[30%] border-r border-border-color pr-4 overflow-y-auto no-scrollbar">
                        <div className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest mb-2 border-b border-border-color pb-0.5">CUE COLUMN</div>
                        <div className="markdown-body">
                          <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]} 
                              rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                              components={markdownComponents} 
                          >
                            {cornellData.cues}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="w-[70%] overflow-y-auto no-scrollbar">
                        <div className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest mb-2 border-b border-border-color pb-0.5">NOTES COLUMN</div>
                        <div className="markdown-body">
                          <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]} 
                              rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                              components={markdownComponents} 
                          >
                            {cornellData.notes}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-border-color pt-4 h-[200px] shrink-0 overflow-y-auto no-scrollbar">
                      <div className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest mb-2 border-b border-border-color pb-0.5">SUMMARY</div>
                      <div className="markdown-body">
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]} 
                            rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                            components={markdownComponents} 
                        >
                          {cornellData.summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="markdown-body">
                      <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                          components={markdownComponents} 
                      >
                        {localContent}
                      </ReactMarkdown>
                  </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
