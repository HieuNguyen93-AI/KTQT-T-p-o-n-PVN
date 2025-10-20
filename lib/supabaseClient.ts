
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://jpbfsccqvnnfheefzfnd.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwYmZzY2Nxdm5uZmhlZWZ6Zm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNTQ0OTIsImV4cCI6MjA3NTYzMDQ5Mn0.OmS6AWJEqUt4L8IJ8fmPZzSsucjXvplsZd8IP9jDZpE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);