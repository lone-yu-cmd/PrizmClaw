# PrizmClaw

Telegram Bot Bridge for CodeBuddy CLI with Web API.

## Features

### AI CLI Proxy (F-011)

PrizmClaw acts as an intelligent proxy layer for AI CLI tools. Users can interact with AI capabilities through natural language messages via Telegram.

- **Natural Language Execution**: Send messages to execute AI-powered tasks
- **Multi-turn Conversation**: Context is preserved across multiple messages
- **Task Interrupt**: Use `/stop` to interrupt long-running tasks
- **Heartbeat Progress**: Progress notifications for long-running operations
- **MarkdownV2 Formatting**: Output is properly formatted for Telegram

### Command Executor (F-009)

Execute system commands safely with:
- Command blacklist
- High-risk keyword detection
- Confirmation flow for dangerous operations
- Output pagination with `/more`

### File Manager (F-010)

Browse and manage files remotely:
- `/ls`, `/tree` - List directories
- `/cat`, `/head`, `/tail` - View file contents
- `/find` - Search for files
- `/upload`, `/download` - Transfer files

### Pipeline Control (F-001, F-002, F-003)

Manage development pipelines:
- `/pipeline`, `/bugfix`, `/planner` - Start pipelines
- `/status` - Check pipeline status
- `/logs` - View pipeline logs
- `/stop` - Stop running pipelines

## Configuration

### Environment Variables

```bash
# Telegram
ENABLE_TELEGRAM=true
TELEGRAM_BOT_TOKEN=your-bot-token
ALLOWED_USER_IDS=12345678,99887766

# CodeBuddy CLI
CODEBUDDY_BIN=codebuddy
CODEBUDDY_PERMISSION_FLAG=-y
CODEBUDDY_ECHO_STDIO=true

# AI CLI Proxy (F-011)
AI_CLI_HEARTBEAT_THRESHOLD_MS=10000
AI_CLI_HEARTBEAT_INTERVAL_MS=30000
AI_CLI_ENABLE_HEARTBEAT=true

# Web Server
WEB_HOST=127.0.0.1
WEB_PORT=8787

# Permissions
USER_PERMISSIONS=123456789:admin,987654321:operator
```

### Permission Roles

- `admin` - Full access to all commands
- `operator` - Can execute most commands, high-risk operations require confirmation
- `viewer` - Read-only access (status, logs)

## Usage

### Telegram Commands

```
/start          - Start the bot
/help           - Show help message
/reset          - Reset session context
/stop           - Stop running task or pipeline
/status         - Show pipeline status
/logs           - View pipeline logs

# File Operations
/ls [path]      - List directory
/tree [path]    - Show directory tree
/cat <path>     - View file contents
/find <pattern> - Search for files

# Pipeline Control
/pipeline       - Run feature pipeline
/bugfix         - Run bugfix pipeline
/planner        - Run planner pipeline
/retry <id>     - Retry failed target
```

### Natural Language Messages

Simply send a text message to interact with the AI CLI:

```
User: Help me refactor the parseDate function in src/utils.js
Bot: [AI processes and responds with suggestions]
```

For multi-turn conversations:

```
User: Create a new utility file for date parsing
Bot: [Creates file and shows result]
User: Now add timezone support to it
Bot: [Remembers context and adds timezone support]
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit configuration
vim .env

# Run tests
npm test

# Start server
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test tests/services/ai-cli-service.test.js

# Run integration tests
node --test tests/integration/ai-cli-telegram.test.js
```

## Architecture

```
src/
├── adapters/           # External service adapters
│   └── codebuddy.js    # CodeBuddy CLI adapter
├── bot/                # Telegram bot
│   ├── commands/       # Command handlers
│   └── telegram.js     # Bot setup and message handling
├── security/           # Security modules
│   ├── permission-guard.js
│   ├── param-sanitizer.js
│   └── confirmation-manager.js
├── services/           # Core services
│   ├── ai-cli-service.js   # F-011: AI CLI execution
│   ├── session-store.js    # Session management
│   └── ...
├── utils/              # Utilities
│   ├── markdown-v2-formatter.js  # F-011: Telegram formatting
│   ├── heartbeat-manager.js      # F-011: Heartbeat utility
│   └── logger.js
└── config.js           # Configuration
```

## License

MIT
