
import { v4 as uuidv4 } from 'uuid';
import { FileNode, NodeType } from '../../types';

interface RawOutlineItem {
  name: string;
  level: number;
  lineIndex: number;
  children: RawOutlineItem[];
  id: string;
}

export const generateFromOutline = async (
  text: string, 
  rootParentId: string | null,
  addNodes: (nodes: FileNode[]) => Promise<void>
) => {
  const lines = text.split('\n');
  const rawItems: RawOutlineItem[] = [];
  
  // First pass: Parse lines and determine indentation levels
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match unordered list: - , * , +
    // Match ordered list: 1. , 2) , a. , i. etc.
    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)]|[a-zA-Z][.)])\s+(.*)$/);
    
    if (listMatch) {
      const indent = listMatch[1].length;
      const name = listMatch[3].trim();
      
      rawItems.push({
        name,
        level: indent,
        lineIndex: i,
        children: [],
        id: uuidv4()
      });
    }
  }

  if (rawItems.length === 0) return;

  // Second pass: Build tree structure based on indentation
  const root: RawOutlineItem[] = [];
  const stack: RawOutlineItem[] = [];

  for (const item of rawItems) {
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    stack.push(item);
  }

  // Third pass: Collect all nodes into a flat array
  const allNodes: FileNode[] = [];
  const collectNodes = (items: RawOutlineItem[], parentId: string | null) => {
    for (const item of items) {
      const isFolder = item.children.length > 0;
      
      const newNode: FileNode = {
        id: item.id,
        parentId: parentId,
        name: item.name,
        type: isFolder ? NodeType.FOLDER : NodeType.FILE,
        content: '',
        createdAt: Date.now()
      };

      allNodes.push(newNode);

      if (isFolder) {
        collectNodes(item.children, item.id);
      }
    }
  };

  collectNodes(root, rootParentId);
  
  // Perform bulk operation
  if (allNodes.length > 0) {
    await addNodes(allNodes);
  }
};
