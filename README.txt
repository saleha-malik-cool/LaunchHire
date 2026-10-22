LAUNCHHIRE — SUPABASE + FRONTEND STARTER
========================================

This package keeps the existing LaunchHire design and adds Supabase Auth + database-backed jobs and applications.

FILES
-----
index.html             Existing LaunchHire frontend, with recruiter workspace and startup fields
style.css              Existing styles plus workspace styles
script.js              Supabase-connected browser JavaScript
config.js              Add your Supabase Project URL and Publishable key here
supabase_setup.sql     Creates remaining schema tables, signup trigger, and RLS policies

SETUP (DO THESE IN ORDER)
-------------------------
1. Open your Supabase project -> SQL Editor -> New query.
2. Open supabase_setup.sql from this folder, copy all of it into SQL Editor, and click Run.
   This script is designed for the six starter tables already created earlier. It uses
   CREATE TABLE IF NOT EXISTS and does not drop table data. If you have changed the schema
   manually, stop and review any SQL error instead of repeatedly running random SQL.
3. In Supabase Dashboard, find Project URL and Publishable key (not secret/service_role key).
4. Open config.js and replace the two PASTE_YOUR... values with your own Project URL and Publishable key.
   Never put a secret/service_role key in frontend code.
5. In VS Code, open this folder and use Live Server on index.html. Do not open it with file://.
6. Test sign up. If email confirmation is enabled, confirm the email before logging in.
7. Sign up as Recruiter / Startup to create a startup and recruiter profile. Sign up as Job seeker
   to create a seeker profile. The SQL trigger creates the related records automatically.
8. Recruiters can publish, view, edit and delete their jobs in the workspace. Job seekers can view
   jobs, apply, view their applications, and withdraw an application.

DATABASE DESIGN NOTES
---------------------
The 13-table concept from the supplied ERD is preserved with PostgreSQL-friendly names:
profiles (ERD USER), portal_user_phones (USER_PHONE), job_seekers (JOB_SEEKER),
job_seeker_skills (JOB_SEEKER_SKILL), employed (EMPLOYED), unemployed (UNEMPLOYED),
startups (STARTUP), startup_industries (STARTUP_INDUSTRY), recruiters (RECRUITER),
recruiter_phones (RECRUITER_PHONE), jobs (JOB), job_salary_ranges (JOB_SALARY_RANGE),
applications (APPLICATION).

Supabase Auth uses UUID IDs. Therefore profiles.user_id and related user foreign keys are UUID,
not the INT shown in the ER diagram. Passwords are managed by Supabase Auth and are NOT stored
in a custom password_hash column. Explain this as an implementation adaptation during viva.

The frontend's primary CRUD demonstration is job posting (Create, Read, Update, Delete), plus
application create/read/withdraw. RLS policies restrict job management to the owning recruiter
and application management to the relevant seeker/recruiter.

TROUBLESHOOTING
---------------
- "Invalid API key" or no connection: check config.js and make sure you used the Publishable key.
- "relation does not exist": run supabase_setup.sql and read the exact SQL error.
- "permission denied" / RLS error: confirm the SQL script completed successfully.
- Email not confirmed: click the confirmation link sent by Supabase, then log in.
- If you have already run a different schema and get an error, send the exact error message before
  changing or deleting tables. Do not drop tables just to make the error disappear.
