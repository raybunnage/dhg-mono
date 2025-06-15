import { SingletonService } from '../base-classes/SingletonService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../../supabase/types';

export interface ArchivedTable {
  id: string;
  table_name: string;
  table_schema: string;
  create_statement: string;
  row_count: number;
  foreign_keys: any[];
  indexes: any[];
  triggers: any[];
  archived_at: string;
  archived_by: string;
  reason: string;
  metadata: any;
}

export class ArchiveService extends SingletonService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    super('ArchiveService');
    this.supabase = supabase;
  }

  async archiveTable(tableName: string, reason: string, archivedBy: string = 'system'): Promise<ArchivedTable> {
    try {
      // Get table DDL
      const { data: ddlData, error: ddlError } = await this.supabase.rpc('get_table_ddl', {
        table_name: tableName
      });

      if (ddlError) throw ddlError;

      // Get row count
      const { count, error: countError } = await this.supabase
        .from(tableName as any)
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Get foreign keys
      const { data: fkData, error: fkError } = await this.supabase.rpc('get_table_foreign_keys', {
        table_name: tableName
      });

      if (fkError) throw fkError;

      // Get indexes
      const { data: indexData, error: indexError } = await this.supabase.rpc('get_table_indexes', {
        table_name: tableName
      });

      if (indexError) throw indexError;

      // Store in sys_archived_tables
      const archiveRecord: Omit<ArchivedTable, 'id'> = {
        table_name: tableName,
        table_schema: 'public',
        create_statement: ddlData || '',
        row_count: count || 0,
        foreign_keys: fkData || [],
        indexes: indexData || [],
        triggers: [], // TODO: Get triggers
        archived_at: new Date().toISOString(),
        archived_by: archivedBy,
        reason: reason,
        metadata: {
          archive_version: '1.0',
          archive_method: 'full_schema'
        }
      };

      const { data, error } = await this.supabase
        .from('sys_archived_tables')
        .insert(archiveRecord)
        .select()
        .single();

      if (error) throw error;

      this.logger.info(`Table ${tableName} archived successfully`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to archive table ${tableName}:`, error);
      throw error;
    }
  }

  async restoreTable(archiveId: string): Promise<void> {
    try {
      // Get archive record
      const { data: archive, error } = await this.supabase
        .from('sys_archived_tables')
        .select('*')
        .eq('id', archiveId)
        .single();

      if (error) throw error;
      if (!archive) throw new Error('Archive record not found');

      // Execute create statement
      const { error: createError } = await this.supabase.rpc('execute_ddl', {
        ddl_statement: archive.create_statement
      });

      if (createError) throw createError;

      // Restore foreign keys
      for (const fk of archive.foreign_keys) {
        const { error: fkError } = await this.supabase.rpc('execute_ddl', {
          ddl_statement: fk.definition
        });
        if (fkError) throw fkError;
      }

      // Restore indexes
      for (const index of archive.indexes) {
        const { error: indexError } = await this.supabase.rpc('execute_ddl', {
          ddl_statement: index.definition
        });
        if (indexError) throw indexError;
      }

      this.logger.info(`Table ${archive.table_name} restored successfully`);
    } catch (error) {
      this.logger.error(`Failed to restore table:`, error);
      throw error;
    }
  }

  async listArchivedTables(): Promise<ArchivedTable[]> {
    const { data, error } = await this.supabase
      .from('sys_archived_tables')
      .select('*')
      .order('archived_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getArchiveDetails(tableNameOrId: string): Promise<ArchivedTable | null> {
    const { data, error } = await this.supabase
      .from('sys_archived_tables')
      .select('*')
      .or(`id.eq.${tableNameOrId},table_name.eq.${tableNameOrId}`)
      .single();

    if (error) throw error;
    return data;
  }
}