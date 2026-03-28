import { db } from '../../utils/db';

export interface ExportData {
  version: string;
  timestamp: number;
  files: any[];
  blobs: {
    id: string;
    name: string;
    type: string;
    data: string; // Base64 (Data URL)
    createdAt?: number;
  }[];
}

/**
 * Performance-optimized Blob to Base64 (Data URL) conversion.
 * Uses FileReader which is generally faster for large blobs than manual conversion.
 */
const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Performance-optimized Project Export.
 * Processes blobs in batches to avoid memory spikes.
 */
export const exportProject = async (
  files: any[], 
  onProgress?: (current: number, total: number) => void
): Promise<string> => {
  const allBlobs = await db.blobs.toArray();
  const total = allBlobs.length;
  const serializedBlobs = [];

  // Process in batches of 5 to balance speed and memory
  const BATCH_SIZE = 5;
  for (let i = 0; i < allBlobs.length; i += BATCH_SIZE) {
    const batch = allBlobs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (b) => {
      const dataUrl = await blobToDataURL(b.data);
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        data: dataUrl,
        createdAt: b.createdAt
      };
    }));
    serializedBlobs.push(...results);
    
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, total), total);
    }
  }

  const exportData: ExportData = {
    version: '1.1',
    timestamp: Date.now(),
    files,
    blobs: serializedBlobs
  };

  return JSON.stringify(exportData);
};

/**
 * Performance-optimized Project Import.
 * Uses native fetch for efficient Base64 to Blob conversion and bulkPut for speed.
 */
export const importProject = async (
  data: ExportData,
  onProgress?: (current: number, total: number) => void
) => {
  const total = data.blobs?.length || 0;
  
  if (data.blobs && Array.isArray(data.blobs)) {
    // Process in larger batches for better performance with bulkPut
    const BATCH_SIZE = 10;
    for (let i = 0; i < data.blobs.length; i += BATCH_SIZE) {
      const batch = data.blobs.slice(i, i + BATCH_SIZE);
      
      const blobsToPut = await Promise.all(batch.map(async (b) => {
        try {
          const res = await fetch(b.data);
          const blob = await res.blob();
          return {
            id: b.id,
            data: blob,
            name: b.name,
            type: b.type,
            createdAt: b.createdAt || Date.now()
          };
        } catch (err) {
          console.error(`Failed to convert blob ${b.id}:`, err);
          return null;
        }
      }));

      const validBlobs = blobsToPut.filter(b => b !== null);
      if (validBlobs.length > 0) {
        await db.blobs.bulkPut(validBlobs);
      }

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, total), total);
      }
      
      // Yield to UI thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return data.files;
};
