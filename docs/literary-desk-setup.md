# Literary Desk setup

1. In Supabase SQL Editor, run `docs/supabase-literary-desk.sql`.
2. Use the Supabase Dashboard to deploy the function without installing anything:

   - Open **Edge Functions -> Secrets** and add `BOOKED_DESK_CRON_SECRET` with a long random value.
   - Open **Edge Functions -> Deploy a new function -> Via Editor**.
   - Name it `refresh-literary-desk`, turn off JWT verification, and replace the editor contents with `supabase/functions/refresh-literary-desk/index.ts` from this repository.
   - Deploy it, then use the built-in **Test** control with method `POST` and the header `x-booked-cron-secret` set to that same value. A successful result includes a `refreshed` count.

   Supabase already provides the function's `SUPABASE_URL` and service-role environment variables; do not add those yourself.

   Alternatively, install the Supabase CLI, log in, and from this repository run:

   ```powershell
   supabase link --project-ref vlsotmfdcbilcrwvlzqy
   supabase secrets set BOOKED_DESK_CRON_SECRET="choose-a-long-random-secret"
   supabase functions deploy refresh-literary-desk --no-verify-jwt
   ```

3. In GitHub, open the Booked repository: **Settings -> Secrets and variables -> Actions**. Add:

   - `BOOKED_DESK_FUNCTION_URL`: `https://vlsotmfdcbilcrwvlzqy.supabase.co/functions/v1/refresh-literary-desk`
   - `BOOKED_DESK_CRON_SECRET`: the same value used in Supabase.

4. Push the included GitHub workflow. It refreshes the desk daily at 08:27 UTC. You can also run it immediately from the **Actions** tab.

The source list lives at the top of `supabase/functions/refresh-literary-desk/index.ts`. Each source is labelled with its region and editorial focus; failed feeds are skipped so one publication cannot take down the desk. The function ranks book-centred criticism, reading lists, recommendations, prizes, authors, poetry, publishing, and literature in translation above generic culture news, while limiting each source to two items.
