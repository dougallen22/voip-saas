-- RLS Policies for voip_users
-- Allow authenticated users to read all voip_users
CREATE POLICY "Allow authenticated users to read voip_users"
ON public.voip_users
FOR SELECT
TO authenticated
USING (true);

-- Allow users to update their own availability and profile
CREATE POLICY "Allow users to update own record"
ON public.voip_users
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Allow super_admin to update all voip_users
CREATE POLICY "Allow super_admin to update all voip_users"
ON public.voip_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.voip_users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow super_admin to insert voip_users
CREATE POLICY "Allow super_admin to insert voip_users"
ON public.voip_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.voip_users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow super_admin to delete voip_users
CREATE POLICY "Allow super_admin to delete voip_users"
ON public.voip_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.voip_users
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- RLS Policies for calls table
CREATE POLICY "Allow authenticated users to read calls"
ON public.calls
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert calls"
ON public.calls
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update calls"
ON public.calls
FOR UPDATE
TO authenticated
USING (true);

-- RLS Policies for parked_calls table
CREATE POLICY "Allow authenticated users to read parked_calls"
ON public.parked_calls
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert parked_calls"
ON public.parked_calls
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update parked_calls"
ON public.parked_calls
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete parked_calls"
ON public.parked_calls
FOR DELETE
TO authenticated
USING (true);
