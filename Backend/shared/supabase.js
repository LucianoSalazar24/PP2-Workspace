// Backend/shared/supabase.js - Cliente Supabase compartido entre microservicios
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// Cliente con service_role (acceso total, bypasea RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('✅ Cliente Supabase inicializado:', supabaseUrl);

module.exports = supabase;
