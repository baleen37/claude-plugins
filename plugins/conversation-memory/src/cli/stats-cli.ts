import { getIndexStats, formatStats } from '../core/stats.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: conversation-memory stats

Display statistics about the indexed conversation archive.

Shows:
- Total conversations and exchanges
- Conversations with/without AI summaries
- Date range coverage
- Project breakdown
- Top projects by conversation count

EXAMPLES:
  # Show index statistics
  conversation-memory stats
`);
  process.exit(0);
}

getIndexStats()
  .then(stats => {
    console.log(formatStats(stats));
  })
  .catch(error => {
    console.error('Error getting stats:', error);
    process.exit(1);
  });
