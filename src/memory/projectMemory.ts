export interface ProjectSummary {
  totalFiles: number;
  importantFiles: string[];
  structure: Record<string, any>;
  codeSamples: Record<string, string>;
}

export interface ProjectMemory {
  analyzed: boolean;
  summary: ProjectSummary | string | null;
  importantFiles: string[];
  packageInfo?: any;
  tsConfig?: any;
  codeSamples?: Record<string, string>;
}

export const projectMemory: ProjectMemory = {
  analyzed: false,
  summary: null,
  importantFiles: [],
  packageInfo: {},
  tsConfig: {},
  codeSamples: {},
};