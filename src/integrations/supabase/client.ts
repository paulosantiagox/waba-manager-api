// Cliente ÚNICO do Supabase deste sistema.
// A URL e a publishable/anon key vêm de VITE_* (build time). NUNCA use service_role aqui.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// NOTA: o client fica sem o generic <Database> porque src/integrations/supabase/types.ts
// está como stub gerado vazio (Tables: never). Tipar com ele quebraria TODA query do app.
// Para ligar a tipagem depois, regerar o arquivo:
//   npx supabase gen types typescript --project-id dfrfeirfllwmdkenylwk > src/integrations/supabase/types.ts
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // storageKey próprio: os sistemas 3SMAX dividem o mesmo domínio raiz e, sem
    // isso, um derruba a sessão do outro.
    storageKey: 'sb-waba-3smax',
    persistSession: true,
    autoRefreshToken: true,
  },
});

export { SUPABASE_URL };
