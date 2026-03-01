/**
 * Mock CodeBuddy Script
 * This script is spawned by mock-codebuddy.js to simulate CLI behavior.
 */

const args = process.argv.slice(2);

let output = '';
let delay = 0;
let exitCode = 0;
let stderrContent = '';
let chunkInterval = 0;
let timeout = 0;

// Parse arguments
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];

  switch (key) {
    case '--output':
      output = value || '';
      break;
    case '--delay':
      delay = parseInt(value, 10) || 0;
      break;
    case '--exit-code':
      exitCode = parseInt(value, 10) || 0;
      break;
    case '--stderr':
      stderrContent = value || '';
      break;
    case '--chunk-interval':
      chunkInterval = parseInt(value, 10) || 0;
      break;
    case '--timeout':
      timeout = parseInt(value, 10) || 0;
      break;
  }
}

async function run() {
  // Write stderr if provided
  if (stderrContent) {
    process.stderr.write(stderrContent + '\n');
  }

  // Delay before output
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Timeout mode - run forever
  if (timeout > 0) {
    // Output initial message if any
    if (output) {
      process.stdout.write(output);
    }
    // Keep running forever
    await new Promise(() => {});
    return;
  }

  // Chunked output mode
  if (chunkInterval > 0 && output) {
    const lines = output.split('\n');
    for (const line of lines) {
      process.stdout.write(line + '\n');
      await new Promise((resolve) => setTimeout(resolve, chunkInterval));
    }
  } else {
    // Normal output
    if (output) {
      process.stdout.write(output);
    }
  }

  process.exit(exitCode);
}

run().catch((err) => {
  process.stderr.write(err.message);
  process.exit(1);
});
