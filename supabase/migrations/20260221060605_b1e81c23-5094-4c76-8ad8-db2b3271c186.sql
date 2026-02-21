
-- Drop the trigger and function that deducted from stored leave_balance
-- Balance is now computed dynamically from hire_date, monthly_accrual, and approved paid leave
DROP TRIGGER IF EXISTS on_leave_status_change ON public.leave_requests;
DROP FUNCTION IF EXISTS public.handle_leave_approval();

-- Allow admins to delete profiles (for deactivated users)
CREATE POLICY "Admins can delete inactive profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete user_roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete leave_requests for deleted users
CREATE POLICY "Admins can delete requests"
ON public.leave_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
