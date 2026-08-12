import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://oyasjdewobeojldihict.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95YXNqZGV3b2Jlb2psZGloaWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyOTc2NzQsImV4cCI6MjEwMTg3MzY3NH0.qZfdAHfgfGyryC_d4Yv6L8xJkSs0-CGC1EpvQpimO0A";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
