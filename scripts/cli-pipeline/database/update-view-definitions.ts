#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

interface ViewInfo {
  table_schema: string;
  table_name: string;
  view_name: string;
  is_updatable: boolean;
  is_insertable: boolean;
  view_dependencies?: string[];
}

class ViewDefinitionsUpdater {
  private supabase = SupabaseClientService.getInstance().getClient();

  async update() {
    console.log('🔍 Checking for views to add to sys_table_definitions...\n');

    try {
      // Get all views from the database
      const { data: allViews, error: viewsError } = await this.supabase
        .rpc('get_all_views_with_info');

      if (viewsError) throw viewsError;

      // Get all registered views in sys_table_definitions
      const { data: registeredViews, error: regError } = await this.supabase
        .from('sys_table_definitions')
        .select('table_name')
        .eq('object_type', 'view');

      if (regError) throw regError;

      const registeredViewNames = new Set(registeredViews?.map((v: any) => v.table_name) || []);
      
      // Find unregistered views
      const unregisteredViews = allViews?.filter((v: any) => 
        v.view_schema === 'public' && !registeredViewNames.has(v.view_name)
      ) || [];

      console.log(`Found ${unregisteredViews.length} unregistered views\n`);

      if (unregisteredViews.length === 0) {
        console.log('✅ All views are already registered!');
        
        // Still run the populate function to update existing view metadata
        console.log('\n🔄 Updating existing view metadata...');
        const { error: populateError } = await this.supabase.rpc('populate_view_definitions');
        if (populateError) {
          console.error('❌ Error updating view metadata:', populateError);
        } else {
          console.log('✅ View metadata updated successfully!');
        }
        
        return;
      }

      // Run the database function to populate views
      console.log('🔄 Running populate_view_definitions...');
      const { error: populateError } = await this.supabase.rpc('populate_view_definitions');
      
      if (populateError) {
        console.error('❌ Error populating views:', populateError);
        return;
      }

      console.log('✅ Successfully populated view definitions!');
      
      // Show what was added
      for (const view of unregisteredViews) {
        console.log(`\n📝 Registered view: ${view.view_name}`);
        console.log(`   Updatable: ${view.is_updatable ? 'Yes' : 'No'}`);
        console.log(`   Insertable: ${view.is_insertable ? 'Yes' : 'No'}`);
        if (view.table_dependencies?.length > 0) {
          console.log(`   Dependencies: ${view.table_dependencies.join(', ')}`);
        }
      }

    } catch (error) {
      console.error('❌ Error updating view definitions:', error);
      process.exit(1);
    }
  }

  async analyzeViews() {
    console.log('\n📊 Analyzing all views in the database...\n');

    try {
      const { data: views, error } = await this.supabase
        .from('sys_table_definitions')
        .select('*')
        .eq('object_type', 'view')
        .order('table_name');

      if (error) throw error;

      if (!views || views.length === 0) {
        console.log('No views found in sys_table_definitions');
        return;
      }

      // Group views by prefix
      const viewsByPrefix = new Map<string, any[]>();
      
      for (const view of views) {
        const prefix = this.getPrefix(view.table_name);
        if (!viewsByPrefix.has(prefix)) {
          viewsByPrefix.set(prefix, []);
        }
        viewsByPrefix.get(prefix)!.push(view);
      }

      // Display analysis
      console.log(`Total views: ${views.length}\n`);
      
      for (const [prefix, prefixViews] of viewsByPrefix) {
        console.log(`📁 ${prefix} (${prefixViews.length} views)`);
        
        for (const view of prefixViews) {
          console.log(`   • ${view.table_name}`);
          if (view.description) {
            console.log(`     ${view.description}`);
          }
          if (view.depends_on && view.depends_on.length > 0) {
            console.log(`     Dependencies: ${view.depends_on.join(', ')}`);
          }
        }
        console.log('');
      }

    } catch (error) {
      console.error('❌ Error analyzing views:', error);
      process.exit(1);
    }
  }

  private getPrefix(viewName: string): string {
    const prefixes = [
      'ai_', 'auth_', 'batch_', 'clipboard_', 'command_', 'dev_', 'doc_',
      'document_', 'email_', 'expert_', 'filter_', 'google_', 'import_',
      'learn_', 'media_', 'registry_', 'scripts_', 'service_', 'sys_', 'worktree_'
    ];

    const prefix = prefixes.find(p => viewName.startsWith(p));
    return prefix ? prefix.slice(0, -1).toUpperCase() : 'OTHER';
  }
}

// Check command line arguments
const command = process.argv[2];
const updater = new ViewDefinitionsUpdater();

if (command === 'analyze') {
  updater.analyzeViews();
} else {
  updater.update();
}