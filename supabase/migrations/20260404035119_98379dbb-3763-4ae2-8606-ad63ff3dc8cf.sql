
-- Add subtype column to incidents
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS subtype text;

-- Migrate existing categories to new system
UPDATE public.incidents SET category = 'Verbal Comment', subtype = 'Statement' WHERE category = 'Communication';
UPDATE public.incidents SET category = 'Work Allocation', subtype = 'Other' WHERE category = 'Action / Change';
UPDATE public.incidents SET category = 'Process / Procedure', subtype = 'Other' WHERE category = 'Process Event';
UPDATE public.incidents SET category = 'Work Allocation', subtype = 'Other' WHERE category = 'Pay / Benefits';
UPDATE public.incidents SET category = 'Safety / Operational', subtype = 'Other' WHERE category = 'Working Conditions';
UPDATE public.incidents SET category = 'Non-Verbal Behaviour', subtype = 'Other' WHERE category = 'Observed Behaviour';
UPDATE public.incidents SET category = 'Written Communication', subtype = 'Formal Communication' WHERE category = 'Record Issued';

-- Migrate rights_guidance categories
UPDATE public.rights_guidance SET incident_category = 'Verbal Comment' WHERE incident_category = 'Communication';
UPDATE public.rights_guidance SET incident_category = 'Work Allocation' WHERE incident_category = 'Action / Change';
UPDATE public.rights_guidance SET incident_category = 'Process / Procedure' WHERE incident_category = 'Process Event';
UPDATE public.rights_guidance SET incident_category = 'Work Allocation' WHERE incident_category = 'Pay / Benefits';
UPDATE public.rights_guidance SET incident_category = 'Safety / Operational' WHERE incident_category = 'Working Conditions';
UPDATE public.rights_guidance SET incident_category = 'Non-Verbal Behaviour' WHERE incident_category = 'Observed Behaviour';
UPDATE public.rights_guidance SET incident_category = 'Written Communication' WHERE incident_category = 'Record Issued';
