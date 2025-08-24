import { supabase } from './supabase';

export async function debugDatabase() {
  try {
    console.log('=== DATABASE DEBUG ===');
    
    // Check if we can connect to Supabase
    const { data: connection, error: connectionError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (connectionError) {
      console.error('Connection error:', connectionError);
      return;
    }
    
    console.log('✅ Connected to Supabase');
    console.log('Users table count:', connection);
    
    // Try to describe the table structure
    const { data: tableData, error: tableError } = await supabase.rpc(
      'get_table_structure', 
      { table_name: 'users' }
    ).single();
    
    if (tableError) {
      console.log('Could not get table structure:', tableError.message);
    } else {
      console.log('Table structure:', tableData);
    }
    
    // Try to insert a test record with Privy DID format
    const testUserId = 'did:privy:test123';
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: 'test@example.com',
        display_name: 'Test User'
      })
      .select();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      console.error('This confirms the DID format issue');
    } else {
      console.log('✅ Insert test successful:', insertData);
      
      // Clean up test record
      await supabase.from('users').delete().eq('id', testUserId);
      console.log('✅ Test record cleaned up');
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}