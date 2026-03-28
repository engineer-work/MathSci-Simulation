
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Volume2, 
  Video, 
  Image as ImageIcon,
  X,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { db } from '../../utils/db';
import { v4 as uuidv4 } from 'uuid';

interface MediaConfig {
  internal_block_id: string;
  type: 'image' | 'video' | 'audio';
  src: string;
}

export const MediaBlock = ({ configStr, onUpdate, readOnly = false }: { 
  configStr: string; 
  onUpdate: (newStr: string) => void;
  readOnly?: boolean;
}) => {
  const [config, setConfig] = useState<MediaConfig | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(configStr);
      setConfig(parsed);
    } catch (e) {
      console.error("Failed to parse media config", e);
    }
  }, [configStr]);

  useEffect(() => {
    if (!config?.src) {
      setMediaUrl(null);
      setLoading(false);
      return;
    }

    let active = true;
    let url: string | null = null;
    
    const loadMedia = async () => {
      setLoading(true);
      if (config.src.startsWith('blob-id:')) {
        const blobId = config.src.replace('blob-id:', '');
        const blobData = await db.blobs.get(blobId);
        if (blobData && active) {
          url = URL.createObjectURL(blobData.data);
          setMediaUrl(url);
        }
      } else if (active) {
        setMediaUrl(config.src);
      }
      if (active) setLoading(false);
    };

    loadMedia();
    
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [config?.src]);

  const updateConfig = (updates: Partial<MediaConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onUpdate(JSON.stringify(newConfig, null, 2));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const blobId = uuidv4();
      await db.blobs.add({
        id: blobId,
        data: file,
        name: file.name,
        type: file.type,
        createdAt: Date.now()
      });
      updateConfig({ src: `blob-id:${blobId}` });
    } catch (err) {
      console.error(err);
    }
  };

  if (!config) return null;

  if (loading) {
    return (
      <div className="w-full h-48 bg-bg-sidebar border border-border-color rounded-2xl animate-pulse my-6 flex items-center justify-center text-[0.6rem] text-text-muted uppercase tracking-widest shadow-xl">
        Loading Media...
      </div>
    );
  }

  const Icon = config.type === 'video' ? Video : config.type === 'audio' ? Volume2 : ImageIcon;

  return (
    <div className="w-full bg-bg-sidebar border border-border-color rounded-2xl overflow-hidden my-6 shadow-xl">
      <div className="p-4 border-b border-border-color bg-bg-main flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl">
            <Icon className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">
              {config.type.toUpperCase()} PLAYER
            </h3>
            <p className="text-[0.6rem] text-text-muted font-medium">Local Media Playback</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && config.src && (
            <>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-hover-bg rounded-lg text-text-muted transition-colors"
                title="Change File"
              >
                <Upload size={16} />
              </button>
              <button 
                onClick={() => updateConfig({ src: '' })}
                className="p-2 hover:bg-hover-bg rounded-lg text-text-muted transition-colors"
                title="Remove Media"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-6">
        {mediaUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-border-color bg-black/20 flex items-center justify-center min-h-[200px]">
            {config.type === 'image' && (
              <img src={mediaUrl} alt="Media" className="max-w-full max-h-[500px] object-contain" referrerPolicy="no-referrer" />
            )}
            {config.type === 'video' && (
              <video src={mediaUrl} controls className="w-full max-h-[500px]" />
            )}
            {config.type === 'audio' && (
              <div className="flex flex-col items-center gap-4 p-8 w-full">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <Volume2 className="w-8 h-8 text-blue-500" />
                </div>
                <audio src={mediaUrl} controls className="w-full" />
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={() => !readOnly && fileInputRef.current?.click()}
            className="w-full aspect-video rounded-xl border-2 border-dashed border-border-color bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-3 group"
            disabled={readOnly}
          >
            <div className="p-4 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-text-main">Upload {config.type}</p>
              <p className="text-[0.6rem] text-text-muted uppercase tracking-widest mt-1">Click to browse files</p>
            </div>
          </button>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept={config.type === 'image' ? 'image/*' : config.type === 'video' ? 'video/*' : 'audio/*'} 
          className="hidden" 
        />
      </div>
    </div>
  );
};
