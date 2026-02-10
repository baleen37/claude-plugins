# LSP Kotlin

Language Server Protocol support for Kotlin. Provides code completion, diagnostics,
go-to-definition, and other IDE features for Kotlin development.

## Installation

Install kotlin-language-server via Homebrew:

```bash
brew install kotlin-language-server
```

## Requirements

- **Homebrew** - Package manager
- **Java runtime** - Required for Kotlin compilation and execution
- **Kotlin** - Optional, but recommended for running Kotlin code

## Supported File Types

- `.kt` - Kotlin source files
- `.kts` - Kotlin script files

## Usage

Once kotlin-language-server is installed, Claude Code will automatically use it when
editing Kotlin files.

### Examples

- "Find the definition of this function"
- "Show me diagnostics for this file"
- "Complete this code"
- "What errors are in this file?"
- "Refactor this function"

## Troubleshooting

### LSP server not found

Verify kotlin-language-server is installed:

```bash
which kotlin-language-server
```

If not found, install via Homebrew:

```bash
brew install kotlin-language-server
```

### Diagnostics not working

Ensure you have a valid Kotlin project structure with proper build configuration
(e.g., Gradle, Maven, or standalone Kotlin files).

## References

- [kotlin-language-server](https://github.com/fwcd/kotlin-language-server)
- [Kotlin Language](https://kotlinlang.org/)
