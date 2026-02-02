#!/usr/bin/env tsx
import fs from 'fs/promises';
await fs.touch('$HOME/.checker-called');
