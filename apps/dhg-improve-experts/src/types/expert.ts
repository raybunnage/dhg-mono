export interface ExpertFolder {
  id: string;
  name: string;
  path: string[];
  documents: {
    docx: Array<{id: string, name: string, path: string}>;
    pdf: Array<{id: string, name: string, path: string}>;
  }
} 