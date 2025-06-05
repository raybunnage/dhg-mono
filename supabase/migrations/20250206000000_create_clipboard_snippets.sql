-- Create clipboard snippets table for persistent storage
CREATE TABLE IF NOT EXISTS public.clipboard_snippets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    last_used TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add RLS policies
ALTER TABLE public.clipboard_snippets ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own snippets
CREATE POLICY "Users can view own snippets" ON public.clipboard_snippets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snippets" ON public.clipboard_snippets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snippets" ON public.clipboard_snippets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own snippets" ON public.clipboard_snippets
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_clipboard_snippets_user_id ON public.clipboard_snippets(user_id);
CREATE INDEX idx_clipboard_snippets_category ON public.clipboard_snippets(category);

-- Add updated_at trigger
CREATE TRIGGER update_clipboard_snippets_updated_at
    BEFORE UPDATE ON public.clipboard_snippets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to sys_table_definitions for tracking
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'clipboard_snippets', 'Stores user clipboard snippets', 'Persistent storage for frequently used text snippets in the clipboard manager', CURRENT_DATE);

-- Down migration
-- DROP TABLE IF EXISTS public.clipboard_snippets CASCADE;