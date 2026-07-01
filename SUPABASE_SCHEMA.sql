-- ====================================================================
-- DATABASE SCHEMA: SMART YIELD & COST TRACKER PRO
-- Designed for Supabase / PostgreSQL
-- ====================================================================

-- 1. Create Profile / User Metadata Table (Optional, linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create Ingredients Table
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    gross_weight NUMERIC(10, 4) NOT NULL CHECK (gross_weight > 0),
    net_weight NUMERIC(10, 4) NOT NULL CHECK (net_weight >= 0),
    total_purchase_price NUMERIC(12, 2) NOT NULL CHECK (total_purchase_price >= 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT net_less_than_gross CHECK (net_weight <= gross_weight)
);

-- 3. Create Calculation History Table (For logging audits, recalculations, or tracking trends)
CREATE TABLE IF NOT EXISTS public.calculation_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id UUID REFERENCES public.ingredients ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    action_type TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    old_yield_percent NUMERIC(5, 2),
    new_yield_percent NUMERIC(5, 2),
    old_real_cost NUMERIC(12, 2),
    new_real_cost NUMERIC(12, 2),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES (สำหรับระบบ User Isolation)
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_history ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------
-- POLICIES FOR INGREDIENTS
----------------------------------------------------------------------

-- Policy 1: Users can read only their own ingredients
CREATE POLICY "Users can view their own ingredients" 
ON public.ingredients 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Users can insert their own ingredients
CREATE POLICY "Users can insert their own ingredients" 
ON public.ingredients 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update only their own ingredients
CREATE POLICY "Users can update their own ingredients" 
ON public.ingredients 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete only their own ingredients
CREATE POLICY "Users can delete their own ingredients" 
ON public.ingredients 
FOR DELETE 
USING (auth.uid() = user_id);


----------------------------------------------------------------------
-- POLICIES FOR PROFILE / USERS
----------------------------------------------------------------------

CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can edit their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);


----------------------------------------------------------------------
-- POLICIES FOR CALCULATION HISTORY
----------------------------------------------------------------------

CREATE POLICY "Users can view their own calculation history" 
ON public.calculation_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can record history logs" 
ON public.calculation_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);


-- ====================================================================
-- AUTOMATED PROFILE CREATION TRIGGER (จาก auth.users สู่ public.profiles)
-- ====================================================================

-- Create function to handle new registered users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
