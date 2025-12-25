import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://umvcvhntawijmlxxrteg.supabase.co';
const supabaseKey = 'sb_publishable_EW4yIGZzcrWssqBTr6idIA_vna4cpdZ';

export const supabase = createClient(supabaseUrl, supabaseKey);