-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Command Categories Table
CREATE TABLE command_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some initial categories
INSERT INTO command_categories (name, description, color) VALUES
('git', 'Git version control commands', '#F05032'),
('pnpm', 'Package management commands', '#F9AD00'),
('build', 'Project build commands', '#2B7489'),
('deploy', 'Deployment related commands', '#3178C6'),
('database', 'Database operations', '#336791'),
('system', 'System administration commands', '#4EAA25'),
('other', 'Miscellaneous commands', '#808080');

-- Create Command History Table
CREATE TABLE command_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_text TEXT NOT NULL,
  sanitized_command TEXT NOT NULL, -- Version with potential secrets removed
  category_id UUID REFERENCES command_categories(id),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER,
  exit_code INTEGER,
  success BOOLEAN,
  notes TEXT,
  tags TEXT[]
);

-- Add index for faster queries on common filters
CREATE INDEX idx_command_history_category ON command_history(category_id);
CREATE INDEX idx_command_history_executed_at ON command_history(executed_at);
CREATE INDEX idx_command_history_success ON command_history(success);

-- Create Favorite Commands Table
CREATE TABLE favorite_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  command_text TEXT NOT NULL,
  category_id UUID REFERENCES command_categories(id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[]
);

-- Create Command Patterns Table (for sanitization rules)
CREATE TABLE command_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern TEXT NOT NULL,
  replacement TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some initial sanitization patterns
INSERT INTO command_patterns (pattern, replacement, description) VALUES
('--password=[^ ]+', '--password=***', 'Hide password parameters'),
('-p [^ ]+', '-p ***', 'Hide password after -p flag'),
('token=[a-zA-Z0-9_-]+', 'token=***', 'Hide API tokens'),
('key=[a-zA-Z0-9_-]+', 'key=***', 'Hide API keys'),
('secret=[a-zA-Z0-9_-]+', 'secret=***', 'Hide secrets');

-- Enable RLS on the tables
ALTER TABLE command_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_patterns ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming you have a user authentication system)
CREATE POLICY "Users can view their own command history"
  ON command_history FOR SELECT
  USING (auth.uid() = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Users can insert their own command history"
  ON command_history FOR INSERT
  WITH CHECK (auth.uid() = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Users can view command categories"
  ON command_categories FOR SELECT
  USING (true);

CREATE POLICY "Users can view command patterns"
  ON command_patterns FOR SELECT
  USING (true);

CREATE POLICY "Users can view their favorite commands"
  ON favorite_commands FOR SELECT
  USING (auth.uid() = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Users can manage their favorite commands"
  ON favorite_commands FOR ALL
  USING (auth.uid() = current_setting('app.current_user_id', true)::uuid); 