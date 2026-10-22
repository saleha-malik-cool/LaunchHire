-- LaunchHire Supabase setup
-- Designed to work with the six starter tables already created by the earlier instructions.
-- Run this in Supabase Dashboard -> SQL Editor. It does not drop any existing data.

-- Add the remaining tables from the 13-table ER schema.
CREATE TABLE IF NOT EXISTS public.job_seeker_skills (
    user_id UUID NOT NULL REFERENCES public.job_seekers(user_id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    PRIMARY KEY (user_id, skill)
);

CREATE TABLE IF NOT EXISTS public.employed (
    user_id UUID PRIMARY KEY REFERENCES public.job_seekers(user_id) ON DELETE CASCADE,
    current_company VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.unemployed (
    user_id UUID PRIMARY KEY REFERENCES public.job_seekers(user_id) ON DELETE CASCADE,
    availability_date DATE
);

CREATE TABLE IF NOT EXISTS public.job_salary_ranges (
    job_id INT PRIMARY KEY REFERENCES public.jobs(job_id) ON DELETE CASCADE,
    salary_range VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.portal_user_phones (
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    phone VARCHAR(15) NOT NULL,
    PRIMARY KEY (user_id, phone)
);

CREATE TABLE IF NOT EXISTS public.recruiter_phones (
    user_id UUID NOT NULL REFERENCES public.recruiters(user_id) ON DELETE CASCADE,
    phone VARCHAR(15) NOT NULL,
    PRIMARY KEY (user_id, phone)
);

CREATE TABLE IF NOT EXISTS public.startup_industries (
    startup_id INT NOT NULL REFERENCES public.startups(startup_id) ON DELETE CASCADE,
    industry VARCHAR(100) NOT NULL,
    PRIMARY KEY (startup_id, industry)
);

-- Supabase Auth trigger: automatically create profile + role-specific row on signup.
CREATE OR REPLACE FUNCTION public.handle_new_launchhire_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_role VARCHAR(20);
    new_startup_id INT;
BEGIN
    new_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'seeker');
    IF new_role NOT IN ('seeker', 'recruiter') THEN
        new_role := 'seeker';
    END IF;

    INSERT INTO public.profiles (user_id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'LaunchHire User'),
        NEW.email,
        new_role
    )
    ON CONFLICT (user_id) DO NOTHING;

    IF new_role = 'seeker' THEN
        INSERT INTO public.job_seekers (user_id, experience_years)
        VALUES (NEW.id, 0)
        ON CONFLICT (user_id) DO NOTHING;
    ELSE
        INSERT INTO public.startups (startup_name, website, location)
        VALUES (
            COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'startup_name', ''), 'My Startup'),
            NULLIF(NEW.raw_user_meta_data ->> 'website', ''),
            NULLIF(NEW.raw_user_meta_data ->> 'location', '')
        )
        RETURNING startup_id INTO new_startup_id;

        INSERT INTO public.recruiters (user_id, startup_id)
        VALUES (NEW.id, new_startup_id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_launchhire ON auth.users;
CREATE TRIGGER on_auth_user_created_launchhire
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_launchhire_user();

-- Enable Row Level Security on every application table.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_seekers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_seeker_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unemployed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_salary_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_user_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_industries ENABLE ROW LEVEL SECURITY;

-- Remove policies with these names first so this script can be re-run safely.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS startups_public_read ON public.startups;
DROP POLICY IF EXISTS startups_recruiter_update ON public.startups;
DROP POLICY IF EXISTS job_seekers_select_own ON public.job_seekers;
DROP POLICY IF EXISTS job_seekers_update_own ON public.job_seekers;
DROP POLICY IF EXISTS recruiters_select_own ON public.recruiters;
DROP POLICY IF EXISTS jobs_public_read ON public.jobs;
DROP POLICY IF EXISTS jobs_recruiter_insert ON public.jobs;
DROP POLICY IF EXISTS jobs_recruiter_update ON public.jobs;
DROP POLICY IF EXISTS jobs_recruiter_delete ON public.jobs;
DROP POLICY IF EXISTS applications_seeker_read_own ON public.applications;
DROP POLICY IF EXISTS applications_seeker_apply ON public.applications;
DROP POLICY IF EXISTS applications_seeker_withdraw ON public.applications;
DROP POLICY IF EXISTS applications_recruiter_read ON public.applications;
DROP POLICY IF EXISTS applications_recruiter_update ON public.applications;
DROP POLICY IF EXISTS skills_own_all ON public.job_seeker_skills;
DROP POLICY IF EXISTS employed_own_all ON public.employed;
DROP POLICY IF EXISTS unemployed_own_all ON public.unemployed;
DROP POLICY IF EXISTS user_phones_own_all ON public.portal_user_phones;
DROP POLICY IF EXISTS recruiter_phones_own_all ON public.recruiter_phones;
DROP POLICY IF EXISTS industries_public_read ON public.startup_industries;
DROP POLICY IF EXISTS industries_recruiter_manage ON public.startup_industries;
DROP POLICY IF EXISTS salaries_public_read ON public.job_salary_ranges;
DROP POLICY IF EXISTS salaries_recruiter_manage ON public.job_salary_ranges;

-- Profiles and role tables.
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY job_seekers_select_own ON public.job_seekers
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY job_seekers_update_own ON public.job_seekers
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY recruiters_select_own ON public.recruiters
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Public can view startups and jobs. Only the owning recruiter can change their jobs/startup.
CREATE POLICY startups_public_read ON public.startups
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY startups_recruiter_update ON public.startups
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = startups.startup_id)
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = startups.startup_id)
);
CREATE POLICY jobs_public_read ON public.jobs
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY jobs_recruiter_insert ON public.jobs
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = jobs.startup_id)
);
CREATE POLICY jobs_recruiter_update ON public.jobs
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = jobs.startup_id)
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = jobs.startup_id)
);
CREATE POLICY jobs_recruiter_delete ON public.jobs
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = jobs.startup_id)
);

-- Applications: seekers manage their own applications; recruiters can view/update applications to their jobs.
CREATE POLICY applications_seeker_read_own ON public.applications
FOR SELECT TO authenticated USING (seeker_id = auth.uid());
CREATE POLICY applications_seeker_apply ON public.applications
FOR INSERT TO authenticated WITH CHECK (
    seeker_id = auth.uid() AND EXISTS (SELECT 1 FROM public.job_seekers s WHERE s.user_id = auth.uid())
);
CREATE POLICY applications_seeker_withdraw ON public.applications
FOR DELETE TO authenticated USING (seeker_id = auth.uid());
CREATE POLICY applications_recruiter_read ON public.applications
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.jobs j JOIN public.recruiters r ON r.startup_id = j.startup_id
        WHERE j.job_id = applications.job_id AND r.user_id = auth.uid()
    )
);
CREATE POLICY applications_recruiter_update ON public.applications
FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.jobs j JOIN public.recruiters r ON r.startup_id = j.startup_id
        WHERE j.job_id = applications.job_id AND r.user_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.jobs j JOIN public.recruiters r ON r.startup_id = j.startup_id
        WHERE j.job_id = applications.job_id AND r.user_id = auth.uid()
    )
);

-- Private user-owned multi-valued data.
CREATE POLICY skills_own_all ON public.job_seeker_skills
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY employed_own_all ON public.employed
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY unemployed_own_all ON public.unemployed
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_phones_own_all ON public.portal_user_phones
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY recruiter_phones_own_all ON public.recruiter_phones
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY industries_public_read ON public.startup_industries
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY industries_recruiter_manage ON public.startup_industries
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = startup_industries.startup_id)
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.recruiters r WHERE r.user_id = auth.uid() AND r.startup_id = startup_industries.startup_id)
);
CREATE POLICY salaries_public_read ON public.job_salary_ranges
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY salaries_recruiter_manage ON public.job_salary_ranges
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.jobs j JOIN public.recruiters r ON r.startup_id = j.startup_id
            WHERE j.job_id = job_salary_ranges.job_id AND r.user_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j JOIN public.recruiters r ON r.startup_id = j.startup_id
            WHERE j.job_id = job_salary_ranges.job_id AND r.user_id = auth.uid())
);

-- NOTE: Supabase Auth uses UUID user IDs; this is the practical adaptation of the ERD's INT USER ID.
-- Passwords must stay in Supabase Auth, not in a custom password_hash column.
