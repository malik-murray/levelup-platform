# Debugging Survey Save Error

If you're getting an empty error object `{}` when saving the survey, here are things to check:

## 1. Check Supabase RLS Policies

Make sure the RLS policies for `user_survey` table are correct:

```sql
-- Run this in Supabase SQL Editor to verify policies exist:
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'user_survey';
```

You should see 3 policies:
- "Users can view their own survey" (SELECT)
- "Users can insert their own survey" (INSERT)
- "Users can update their own survey" (UPDATE)

## 2. Check if Table Exists

```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_survey'
);
```

## 3. Check Browser Console

Look for the detailed error in the browser console. The updated code should show:
- Response status code
- Response status text
- Error message
- Error data object
- Response URL

## 4. Check Server Logs

Look at your Next.js server terminal for detailed error logs including:
- Supabase error codes
- Database error details
- User ID being used
- Survey data being sent

## 5. Common Issues

### Issue: RLS Policy Not Allowing Insert
**Symptom**: Error code `42501` or `new row violates row-level security policy`

**Fix**: Verify the RLS policy uses `auth.uid() = user_id` and that the user is authenticated.

### Issue: Table Doesn't Exist
**Symptom**: Error code `42P01` (relation does not exist)

**Fix**: Run migration `019_financial_concierge_tables.sql`

### Issue: Column Type Mismatch
**Symptom**: Error code `42804` (datatype mismatch)

**Fix**: Check that all fields match the expected types in the migration

### Issue: Missing Required Field
**Symptom**: Error code `23502` (not-null constraint violation)

**Fix**: Ensure `risk_tolerance`, `income_stability`, and `household_size` are provided

## 6. Test Query

Try running this directly in Supabase SQL Editor (replace USER_ID with your actual user ID):

```sql
-- First, get your user ID:
SELECT id, email FROM auth.users LIMIT 1;

-- Then test insert (replace USER_ID):
INSERT INTO user_survey (
    user_id,
    risk_tolerance,
    income_stability,
    household_size,
    goal_debt_payoff,
    goal_saving
) VALUES (
    'USER_ID_HERE',
    'moderate',
    'stable',
    1,
    false,
    true
) RETURNING *;
```

If this fails, you'll see the exact error.

## 7. Check Authentication

The API route needs to properly authenticate. Check:
- Is the session token being sent in the Authorization header?
- Is `createServerClient` properly configured?
- Are cookies being passed correctly?

## Next Steps

After checking these, share:
1. The HTTP status code from the error
2. Any Supabase error codes
3. The server log output
4. Browser console error details

This will help identify the exact issue.

