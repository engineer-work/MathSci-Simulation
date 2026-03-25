
import Dexie, { Table } from 'dexie';
import { FileNode } from '../types';

export interface BinaryBlob {
  id: string;
  data: Blob;
  name: string;
  type: string;
  createdAt: number;
}

export class MathSciDatabase extends Dexie {
  nodes!: Table<FileNode>;
  blobs!: Table<BinaryBlob>;

  constructor() {
    super('MathSciDB');
    this.version(2).stores({
      nodes: 'id, parentId, type, name, createdAt',
      blobs: 'id, name, type, createdAt'
    });
  }
}

export const db = new MathSciDatabase();
