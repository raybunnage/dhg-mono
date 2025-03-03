/**
 * Database Functions Utility
 * 
 * This utility provides type-safe access to database functions using
 * the generated TypeScript interfaces.
 */

import { supabase } from '../integrations/supabase/client';
import type { DbFunctions } from '../types/dbFunctions';

/**
 * Call a database function with type safety
 * 
 * @param functionName The name of the function to call (schema_functionname format)
 * @param params The parameters to pass to the function
 * @returns The result of the function call
 * 
 * @example
 * // Call a function with no parameters
 * const result = await callDbFunction('public_get_all_categories');
 * 
 * // Call a function with parameters
 * const result = await callDbFunction('public_get_command_history_by_category', {
 *   category_id: 1,
 *   limit: 10,
 *   offset: 0
 * });
 */
export async function callDbFunction<
  T extends keyof DbFunctions,
  P extends Parameters<DbFunctions[T]>[0],
  R extends ReturnType<DbFunctions[T]>
>(
  functionName: T,
  params?: P
): Promise<Awaited<R>> {
  // Split the function name into schema and function parts
  const [schema, name] = functionName.toString().split('_');
  
  // If no schema is provided, assume 'public'
  const actualSchema = name ? schema : 'public';
  const actualName = name || schema;
  
  // Call the function using Supabase RPC
  const { data, error } = await supabase.rpc(
    actualName,
    params as Record<string, any>
  );
  
  if (error) {
    console.error(`Error calling database function ${functionName}:`, error);
    throw error;
  }
  
  return data as Awaited<R>;
}

/**
 * Create a typed database function caller
 * 
 * @returns An object with methods for each database function
 * 
 * @example
 * const db = createDbFunctions();
 * 
 * // Call functions with type safety
 * const categories = await db.public_get_all_categories();
 * const history = await db.public_get_command_history_by_category({
 *   category_id: 1,
 *   limit: 10,
 *   offset: 0
 * });
 */
export function createDbFunctions<T extends DbFunctions>(): T {
  return new Proxy({} as T, {
    get: (target, prop) => {
      const functionName = prop.toString();
      
      return (params?: any) => {
        return callDbFunction(functionName as keyof DbFunctions, params);
      };
    }
  });
}

// Create a default instance
export const db = createDbFunctions();

/**
 * Example usage:
 * 
 * import { db } from '../utils/dbFunctions';
 * 
 * // In an async function:
 * const categories = await db.public_get_all_categories();
 * const history = await db.public_get_command_history_by_category({
 *   category_id: 1,
 *   limit: 10,
 *   offset: 0
 * });
 */ 