
-- Allow employees to cancel their own pending requests (update status to cancelled)
CREATE POLICY "Employees can cancel own pending requests"
ON public.leave_requests
FOR UPDATE
USING (employee_id = auth.uid() AND status = 'pending')
WITH CHECK (employee_id = auth.uid() AND status = 'cancelled');
