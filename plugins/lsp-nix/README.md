# LSP Nix

Language Server Protocol support for Nix. Provides code completion,
diagnostics, go-to-definition, and other IDE features for Nix files using the
nil language server.

## Supported Languages

- **Nix** - via [nil](https://github.com/oxalica/nil)

## Nix LSP

### Installation

```bash
cargo install --git https://github.com/oxalica/nil nil
```

### Requirements

- Rust toolchain (cargo)
- Nix 2.4+

### Supported File Types

`.nix`

### Alternative: nixd

An alternative is **nixd** (more features, less stable):

```bash
cargo install --git https://github.com/nix-community/nixd nixd
```

## Usage

Once the LSP server is installed, Claude Code will automatically use it when
editing Nix files.

### Examples

- "Find the definition of this Nix expression"
- "Show me diagnostics for this Nix file"
- "Complete this Nix code"
- "What errors are in this flake.nix?"

## Troubleshooting

### LSP server not found

Verify the nil server is installed:

```bash
which nil
```

### Diagnostics not working

Ensure your Nix files are syntactically valid and that nil is properly
configured.

## References

- [nil](https://github.com/oxalica/nil)
- [nixd](https://github.com/nix-community/nixd)
