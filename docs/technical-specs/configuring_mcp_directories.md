# Configuring MCP directories and resolving Claude GitHub authentication errors

Claude's Model Context Protocol (MCP) enables secure file system access through a JSON configuration file, while GitHub integration offers multiple methods with distinct authentication requirements. Here's how to expand your MCP directory access and troubleshoot common GitHub authentication errors.

## Adding the new directory to your MCP configuration

Your Claude Desktop configuration file is located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS. To add `/Users/raybunnage/Documents/github/dhg-mono` to your existing setup, you'll need to modify the filesystem server arguments.

**Current configuration** likely looks like this:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/raybunnage/apps/MCP"
      ]
    }
  }
}
```

**Updated configuration** with both directories:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/raybunnage/apps/MCP",
        "/Users/raybunnage/Documents/github/dhg-mono"
      ]
    }
  }
}
```

### Implementation steps for MCP directory addition

First, create a backup of your current configuration:
```bash
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup
```

Next, edit the configuration file and add the new directory path as an additional string in the args array. **Critical requirements**: use absolute paths only (no relative paths), ensure proper JSON syntax with commas between array elements, and verify both directories exist before saving.

After making changes, completely quit Claude Desktop (not just minimize) and restart the application. Look for the **hammer/tool icon** in the bottom of the input box to verify the configuration loaded successfully.

### Alternative approaches for enhanced stability

For improved reliability, consider installing the filesystem server globally:
```bash
npm install -g @modelcontextprotocol/server-filesystem
```

You can also configure separate MCP servers for different directory contexts:
```json
{
  "mcpServers": {
    "filesystem-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/raybunnage/apps/MCP"]
    },
    "filesystem-github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/raybunnage/Documents/github/dhg-mono"]
    }
  }
}
```

## Resolving GitHub integration authentication errors

Claude offers four distinct GitHub integration methods, each with specific authentication requirements and common failure points. Understanding which integration you're using is crucial for troubleshooting.

### Repository access errors in Claude.ai web interface

The most common issue is **"Repository Not Found"** or seeing only a subset of your repositories. This typically stems from insufficient GitHub App permissions or organization restrictions.

To resolve this, visit `https://github.com/apps/claude-for-github/installations/select_target` and ensure the Claude for GitHub app has access to all necessary repositories. If repositories are still missing, use the **"Paste GitHub URL"** option in Claude Desktop/Web to manually add repository URLs, even if they don't appear in the list.

For organization repositories, administrators must approve access requests. You'll need to wait for admin approval before the repositories become accessible. As a workaround, consider cloning organization repos locally and accessing them through MCP filesystem integration.

### Branch browsing limitations and solutions

Claude.ai's GitHub integration **only syncs one branch at a time**, requiring manual synchronization after branch changes. Files won't automatically update when you switch branches in GitHub.

To work with different branches, use the **"Sync now"** button in Claude.ai after switching branches in your repository. Be aware that you'll need to reconfigure file selections after branch switches. The integration excludes commit history, pull requests, and issues - it only provides access to file contents from the selected branch.

For more dynamic branch access, consider using Claude Code CLI instead:
```bash
git checkout feature-branch
claude "analyze the changes in this branch"
```

### Authentication error troubleshooting by error type

**HTTP 403 Forbidden errors** typically indicate expired OAuth tokens or account issues. Re-authenticate by running:
```bash
claude logout
claude login
```

Verify your Claude Max subscription is active and billing information is current. For persistent issues, try setting the API key directly:
```bash
export ANTHROPIC_API_KEY=your-api-key
```

**"Invalid x-api-key" (401) errors** require generating a fresh API key from the Anthropic Console. Ensure the key format starts with 'sk-ant-' and test connectivity:
```bash
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "content-type: application/json" \
     https://api.anthropic.com/v1/messages
```

### Best practices for reliable GitHub integration

Start with small repositories to test functionality before attempting large codebases. Claude has repository size limitations, so exclude unnecessary directories like `.git`, `node_modules`, and build artifacts using the file configuration options.

For Claude Code CLI, create a `.claudeignore` file to manage exclusions automatically. Keep repositories within token limits by strategically selecting core files for analysis rather than syncing entire repositories.

Implement proper security by never hardcoding API keys, using GitHub Secrets for automation, granting minimal necessary permissions, and regularly rotating authentication tokens.

## Advanced MCP tools and management

The MCP ecosystem includes powerful CLI tools for configuration management. Install the Go-based MCP tools via Homebrew:
```bash
brew tap f/mcptools && brew install mcp
```

These tools enable interactive debugging:
```bash
# Test MCP server connections
mcp shell npx -y @modelcontextprotocol/server-filesystem ~/Code

# Call specific tools
mcp call read_file --params '{"path": "/path/to/file"}'
```

For comprehensive configuration management across multiple applications:
```bash
# Add servers to multiple configurations
mcp configs set vscode,cursor,claude-desktop my-server npm run mcp-server

# Synchronize configurations between applications
mcp configs sync vscode cursor --output vscode
```

## Security considerations for expanded file access

When granting Claude access to additional directories, follow the **principle of least privilege**. Only include directories that Claude needs for your specific use cases. Avoid granting access to parent directories when only subdirectories are required.

Review your configuration periodically to remove unnecessary directory access. On macOS, ensure Claude Desktop has Full Disk Access permissions in System Preferences > Security & Privacy if you encounter permission issues.

For enterprise environments or sensitive codebases, consider implementing MCP gateways for centralized access management and audit logging. The MCP protocol supports OAuth 2.1 authorization, though implementation varies by server.

## Conclusion

Successfully expanding Claude's MCP directory access requires careful JSON configuration and proper restart procedures, while GitHub integration issues often stem from permission misconfigurations or API synchronization delays. The key to reliable operation is understanding the **distinct authentication mechanisms** for each integration type and maintaining **minimal necessary permissions** for security.

With your new directory added to MCP configuration and GitHub authentication properly configured, Claude can seamlessly access both your local development files and remote repository contents. Remember to test access after configuration changes and monitor for any authentication token expirations that may require re-authentication.