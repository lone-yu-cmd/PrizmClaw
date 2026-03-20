# AI CLI Backend Switcher (F-015)

## Overview

The AI CLI Backend Switcher feature allows users to dynamically switch between different AI CLI backends without restarting the bot. This enables seamless switching between different AI models (e.g., Claude, CodeBuddy, etc.) based on task requirements or user preference.

## Features

- **Dynamic Backend Switching**: Switch AI backends on-the-fly
- **Session-Specific Backends**: Each user session maintains its own backend preference
- **Backend Validation**: Automatic validation of backend binary accessibility
- **Backward Compatibility**: Maintains compatibility with existing CODEBUDDY_BIN configuration
- **Fallback Mechanism**: Graceful fallback to default backend if selected backend becomes unavailable

## Usage

### Basic Commands

```bash
/cli                    # Show current backend information
/cli list              # List all available backends
/cli <backend>         # Switch to specified backend
/cli reset             # Reset to default backend
```

### Command Aliases

- `/backend` - Alias for `/cli`
- `/ai-backend` - Alias for `/cli`

### Examples

```bash
# Show current backend
/cli

# List available backends
/cli list

# Switch to Claude backend
/cli claude

# Switch to CodeBuddy backend
/cli codebuddy

# Reset to default backend
/cli reset
```

## Configuration

### Environment Variables

```bash
# Backend configuration
AI_CLI_BACKENDS=claude:/usr/bin/claude,codebuddy:/usr/bin/codebuddy
AI_CLI_DEFAULT_BACKEND=codebuddy
AI_CLI_BACKEND_VALIDATION=true
AI_CLI_BACKEND_FALLBACK=true

# Backward compatibility (existing)
CODEBUDDY_BIN=/usr/bin/codebuddy
```

### Backend Configuration Format

Backends are configured using a comma-separated list of `name:binPath` pairs:

```bash
AI_CLI_BACKENDS=name1:/path/to/bin1,name2:/path/to/bin2,name3:/path/to/bin3
```

## Technical Implementation

### Backend Registry

The system maintains a registry of available backends with validation:

```javascript
class BackendRegistry {
  registerBackend(name, binPath, options = {})
  unregisterBackend(name)
  getBackend(name)
  listBackends()
  validateBackend(name)
  getDefaultBackend()
  setDefaultBackend(name)
}
```

### Session Management

Each user session maintains its own backend preference:

```javascript
// Session store extensions
sessionStore.getCurrentBackend(sessionKey)
sessionStore.setCurrentBackend(sessionKey, backendName)
sessionStore.resetBackend(sessionKey)
```

### AI CLI Service Integration

The AI CLI service automatically uses the session-specific backend:

```javascript
// In executeAiCli function
const sessionBackendName = sessionStore.getCurrentBackend(sessionId);
const sessionBackend = sessionBackendName ? backendRegistry.getBackend(sessionBackendName) : null;
const effectiveBin = bin || (sessionBackend?.binPath) || config.codebuddyBin;
```

## Error Handling

### Invalid Backend Detection

If a backend becomes unavailable (e.g., binary deleted), the system:

1. Detects the issue during validation
2. Resets the session backend to default
3. Returns a clear error message to the user
4. Logs the incident for monitoring

### Fallback Mechanism

When a backend validation fails, the system:

- Falls back to the default backend
- Preserves user session state
- Provides clear feedback about the issue
- Allows user to switch to another backend

## Security Considerations

- **Binary Validation**: All backend binaries are validated for existence and executability
- **Path Security**: Binary paths are validated to prevent path traversal attacks
- **Permission Checks**: Backend switching requires operator-level permissions
- **Audit Logging**: All backend switches are logged for security auditing

## Testing

### Unit Tests

- Backend registry functionality
- Session store backend tracking
- CLI command handler
- AI CLI service integration

### Integration Tests

- End-to-end backend switching
- Session persistence across switches
- Error handling for invalid backends
- Backward compatibility testing

## Migration from Previous Versions

### Backward Compatibility

The feature maintains full backward compatibility:

- Existing CODEBUDDY_BIN configuration continues to work
- Sessions without explicit backend settings use the default backend
- No breaking changes to existing functionality

### Configuration Migration

No migration required. Existing configurations continue to function normally.

## Troubleshooting

### Common Issues

1. **Backend not found**: Verify the backend binary path exists and is executable
2. **Permission denied**: Check file permissions on backend binaries
3. **Backend validation fails**: Ensure the binary path is correct and accessible

### Debug Commands

```bash
# Check backend configuration
/cli list

# Verify backend accessibility
/cli <backend>  # Will show validation errors if backend is inaccessible

# Reset to default if issues persist
/cli reset
```

## Related Features

- **F-011**: AI CLI Proxy - Provides the underlying CLI execution infrastructure
- **F-013**: Session and Context Manager - Manages session-specific backend preferences
- **F-009**: Command Executor - Handles command routing and execution

## Future Enhancements

- **Backend Discovery**: Automatic discovery of installed AI CLI backends
- **Backend Profiles**: Pre-configured backend profiles for different use cases
- **Performance Metrics**: Backend performance tracking and comparison
- **Backend Health Monitoring**: Continuous monitoring of backend availability