/**
 * Language mapping for AST analysis
 * Maps file extensions to language identifiers and provides conversion to ast-grep Lang enum
 */

/**
 * Supported languages for AST analysis
 * Maps to ast-grep language identifiers
 */
export const SUPPORTED_LANGUAGES: [string, ...string[]] = [
  "javascript",
  "typescript",
  "tsx",
  "python",
  "ruby",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "c",
  "cpp",
  "csharp",
  "html",
  "css",
  "json",
  "yaml",
];

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Map file extensions to ast-grep language identifiers
 */
export const EXT_TO_LANG: Record<string, string> = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
};

/**
 * Convert lowercase language string to ast-grep Lang enum value
 * This provides type-safe language conversion without using 'as any'
 */
export function toLangEnum(
  sg: typeof import("@ast-grep/napi"),
  language: string,
): import("@ast-grep/napi").Lang {
  const langMap: Record<string, import("@ast-grep/napi").Lang> = {
    javascript: sg.Lang.JavaScript,
    typescript: sg.Lang.TypeScript,
    tsx: sg.Lang.Tsx,
    python: sg.Lang.Python,
    ruby: sg.Lang.Ruby,
    go: sg.Lang.Go,
    rust: sg.Lang.Rust,
    java: sg.Lang.Java,
    kotlin: sg.Lang.Kotlin,
    swift: sg.Lang.Swift,
    c: sg.Lang.C,
    cpp: sg.Lang.Cpp,
    csharp: sg.Lang.CSharp,
    html: sg.Lang.Html,
    css: sg.Lang.Css,
    json: sg.Lang.Json,
    yaml: sg.Lang.Yaml,
  };

  const lang = langMap[language];
  if (!lang) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return lang;
}
