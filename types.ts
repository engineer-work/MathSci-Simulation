
import React from 'react';

export enum NodeType {
  FILE = 'FILE',
  FOLDER = 'FOLDER'
}

export interface FileNode {
  id: string;
  parentId: string | null;
  name: string;
  type: NodeType;
  content: string; // Only relevant for files
  isCornell?: boolean; // Toggle for Cornell layout
  createdAt: number;
}

export interface FileSystemState {
  nodes: FileNode[];
  activeFileId: string | null;
  expandedFolders: Set<string>;
}

export interface ImportData {
  version: number;
  nodes: FileNode[];
}

export interface AppTheme {
  name: string;
  bgMain: string;
  bgSidebar: string;
  textMain: string;
  textMuted: string;
  border: string;
  accent: string;
  hover: string;
}

declare global {
  interface Window {
    katex: any;
    SmilesDrawer: any;
    Plotly: any;
    math: any;
    Matter: any;
    html2pdf: any;
    $3Dmol: any;
  }

  // Ensure JSX intrinsics are recognized
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}