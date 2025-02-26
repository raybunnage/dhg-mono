// Follow this setup guide to integrate the Deno runtime and Supabase client:
// https://deno.com/deploy/docs/supabase
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Get the request body
  const { access_token, refresh_token, expires_in, token_type, scope } = await req.json();
  
  // Create a Supabase client with the service role key
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  );

  // Get authenticated user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);
    
    // Store the token in the database
    const { data, error } = await supabase
      .from('google_auth_tokens')
      .insert({
        user_id: user.id,
        access_token,
        refresh_token,
        token_type: token_type || 'Bearer',
        expires_at: expiresAt.toISOString(),
        scope
      })
      .select()
      .single();
      
    if (error) {
      throw new Error(`Failed to store token: ${error.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      expires_at: expiresAt.toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error storing token:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}) 