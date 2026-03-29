import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret_id = searchParams.get('secret_id');

  if (!secret_id) {
    return Response.json({ error: 'secret_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('secret_id', secret_id)
    .single();

  if (error || !data) {
    return Response.json({ error: 'Shop not found' }, { status: 404 });
  }

  return Response.json({ shop: data });
}
