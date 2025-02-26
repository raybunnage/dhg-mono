// Follow this setup guide to integrate the Deno runtime and Supabase client:
// https://deno.com/deploy/docs/supabase
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Create a Supabase client with the service role key
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  )

  // Get authenticated user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Extract JWT token
  const token = authHeader.replace('Bearer ', '');
  
  // Verify the token and get user
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get the current token for the user
  const { data: tokens, error: tokensError } = await supabase
    .from('google_auth_tokens')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (tokensError || !tokens || !tokens.refresh_token) {
    return new Response(JSON.stringify({ 
      error: 'No refresh token found, need to reauthenticate' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Refresh the token using Google's OAuth API
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to refresh token: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Calculate new expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);
    
    // Update token in database
    const { data: updatedToken, error: updateError } = await supabase
      .from('google_auth_tokens')
      .update({
        access_token: data.access_token,
        token_type: data.token_type,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tokens.id)
      .select()
      .single();
      
    if (updateError) {
      throw new Error(`Failed to update token: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      access_token: data.access_token,
      token_type: data.token_type,
      expires_at: expiresAt.toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error refreshing token:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}) 