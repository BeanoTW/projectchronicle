UPDATE public.rights_guidance SET incident_category = 'Process Event' WHERE incident_category IN ('Disciplinary Meeting', 'Workplace Meeting');
UPDATE public.rights_guidance SET incident_category = 'Communication' WHERE incident_category IN ('Management Conduct', 'Verbal Comment', 'Written Communication');
UPDATE public.rights_guidance SET incident_category = 'Action / Change' WHERE incident_category IN ('Scheduling or Shift Change', 'Policy Application');
UPDATE public.rights_guidance SET incident_category = 'Pay / Benefits' WHERE incident_category = 'Pay or Payroll Issue';
UPDATE public.rights_guidance SET incident_category = 'Working Conditions' WHERE incident_category = 'Safety Concern';

UPDATE public.incidents SET category = 'Process Event' WHERE category IN ('Disciplinary Meeting', 'Workplace Meeting');
UPDATE public.incidents SET category = 'Communication' WHERE category IN ('Management Conduct', 'Verbal Comment', 'Written Communication');
UPDATE public.incidents SET category = 'Action / Change' WHERE category IN ('Scheduling or Shift Change', 'Policy Application');
UPDATE public.incidents SET category = 'Pay / Benefits' WHERE category = 'Pay or Payroll Issue';
UPDATE public.incidents SET category = 'Working Conditions' WHERE category = 'Safety Concern';