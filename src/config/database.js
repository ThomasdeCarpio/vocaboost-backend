let supabase;

if (process.env.NODE_ENV !== 'test' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY // Dùng service key cho backend
    );

    // Test connection
    const testConnection = async () => {
        try {
            // ✅ CHANGED: Query 'profiles' table instead of the old 'users' table.
            // This confirms we can connect and access our main application tables.
            const { error } = await supabase
                .from('profiles')
                .select('id')
                .limit(1);

            if (error) throw error;
            console.log('✅ Supabase connected successfully');
        } catch (error) {
            console.error('❌ Supabase connection failed:', error.message);
        }
    };

    // Test on application startup
    testConnection();

} else {
    // This mock client is excellent for testing and requires no changes.
    console.warn('Supabase credentials not found or in test mode - using mock database client');
    const dummyResult = Promise.resolve({ data: null, error: null });
    const chain = {
        select() { return this; },
        insert() { return this; },
        update() { return this; },
        delete() { return this; },
        limit() { return this; },
        eq() { return this; },
        single() { return dummyResult; },
        maybeSingle() { return dummyResult; },
        selectCount() { return dummyResult; }
    };
    supabase = {
        from() { return chain; }
    };
}

module.exports = supabase;