# PNPM Commands Reference

## Database Commands

### Migration Management
| Command | Description |
|---------|-------------|
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:rollback` | Rollback last migration |
| `pnpm db:list` | List all migrations |
| `pnpm db:repair` | Repair migration state |
| `pnpm db:repair-applied` | Repair applied migrations |
| `pnpm db:check` | Check migration status |
| `pnpm migration:new` | Create new migration files |

### Database Access
| Command | Description |
|---------|-------------|
| `pnpm db:psql` | Start PostgreSQL session |
| `pnpm db:psql:check` | Show latest migration version |
| `pnpm db:psql:migrations` | List migrations with first statement |
| `pnpm db:psql:describe-migrations` | Show migrations table structure |

## Deployment Commands

### Environment Management
| Command | Description |
|---------|-------------|
| `pnpm deploy:init` | Initialize deployment setup |
| `pnpm deploy:app` | Deploy specific app |
| `pnpm deploy:backup` | Backup environment configs |
| `pnpm env:backup` | Backup environment variables |
| `pnpm env:restore` | Restore environment variables |

### App-Specific Deployment
| Command | Environment | Description |
|---------|------------|-------------|
| `pnpm deploy:dhg-a:development` | Development | Deploy dhg-a to dev |
| `pnpm deploy:dhg-a:prod` | Production | Deploy dhg-a to prod |
| `pnpm deploy:dhg-a:preview` | Preview | Deploy dhg-a to preview |
| `pnpm deploy:dhg-b:dev` | Development | Deploy dhg-b to dev |
| `pnpm deploy:dhg-b:prod` | Production | Deploy dhg-b to prod |
| `pnpm deploy:dhg-b:preview` | Preview | Deploy dhg-b to preview |
| `pnpm deploy:dhg-hub-lovable:dev` | Development | Deploy hub-lovable to dev |
| `pnpm deploy:dhg-hub-lovable:prod` | Production | Deploy hub-lovable to prod |
| `pnpm deploy:dhg-hub-lovable:preview` | Preview | Deploy hub-lovable to preview |

## Development Commands

### Build and Test
| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run linting |
| `pnpm clean` | Clean build artifacts |
| `pnpm test` | Run tests |
| `pnpm test:run` | Run tests without watch mode |

### App Management
| Command | Description |
|---------|-------------|
| `pnpm copy-app` | Copy lovable app template |
| `pnpm backup-configs` | Backup app configurations |
| `pnpm restore-configs` | Restore app configurations |
| `pnpm list-backups` | List all backups |
| `pnpm list-backups-date` | List backups by date |

### Data Management
| Command | Description |
|---------|-------------|
| `pnpm reset:sources-google` | Reset Google sources data |

## Internal Scripts
These commands use internal scripts located in:
- `./scripts/supabase/` - Database operations
- `./scripts/deployment/` - Deployment operations
- `./scripts/app-management/` - App management

