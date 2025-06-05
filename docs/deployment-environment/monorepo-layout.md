# Understanding Our Monorepo Layout

## What is a Monorepo?
A monorepo (short for "monolithic repository") is like a big container that holds multiple related projects in one place. Think of it like a house with different rooms - each room (project) has its own purpose, but they're all part of the same house (repository).

## Our Structure

## Key Parts Explained

### 📁 Apps Directory
This is where our actual applications live. Each app is like its own mini-project, but they can share code and configuration. Currently we have:
- `dhg-a`: Our first application
- `dhg-b`: Our second application

Each app has its own:
- `package.json` (app-specific dependencies)
- `vite.config.js` (build settings)
- `netlify.toml` (deployment settings)
- `src/` folder (application code)

### 📝 Configuration Files
- `package.json`: Think of this as the master control panel. It lists:
  - What commands we can run
  - What tools we're using
  - How the projects are connected

- `pnpm-workspace.yaml`: This tells PNPM (our package manager) that we have multiple projects in one repository.

- `turbo.json`: Helps make our builds faster by being smart about what needs to be rebuilt.

### 🚀 Deployment Files
- Root `netlify.toml`: Main settings for deploying our applications
- App-specific `netlify.toml`: Settings for each individual app

## Common Tasks

### Adding Dependencies
1. For all apps (from root):

```bash
pnpm add -w package-name
```

2. For a specific app:
```bash
pnpm add package-name --filter dhg-a
```

### Running Commands
1. For all apps:
```bash
pnpm dev     # Start development servers
pnpm build   # Build all apps
pnpm clean   # Clean up build files
```

2. For a specific app:
```bash
cd apps/dhg-a
pnpm dev
```

## Why This Structure?
1. **Sharing is Easy**: Apps can share code and configuration
2. **Consistency**: All apps follow the same patterns
3. **Efficiency**: Build tools can optimize across all apps
4. **Simplicity**: One place to manage everything

## Common Questions

### "Where do I put new code?"
- New app? Create a new folder in `apps/`
- Changes to existing app? Go to its folder in `apps/`

### "How do I know which directory to run commands from?"
- App-specific commands: Run from the app's directory
- Project-wide commands: Run from the root directory
- Check the cursor rules or documentation if unsure!

### "What's the difference between root and app package.json?"
- Root: Project-wide settings and commands
- App: App-specific dependencies and scripts

## Best Practices
1. Always use `pnpm` (not npm or yarn)
2. Run shared commands from root
3. Keep app-specific code in app directories
4. Follow the existing patterns for new apps
5. Check documentation when unsure

## Need Help?
- Check the cursor rules for command locations
- Look at other apps for examples
- Ask for help if something's unclear

Remember: This structure might seem complex at first, but it's designed to make our work easier and more organized as the project grows!
