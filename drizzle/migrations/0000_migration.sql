-- Token balances: one row per user
CREATE TABLE public.token_balances (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.token_balances TO authenticated;
GRANT ALL ON public.token_balances TO service_role;
ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own balance" ON public.token_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Token ledger: every credit/debit
CREATE TABLE public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  kind text NOT NULL,
  engine_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.token_transactions TO authenticated;
GRANT ALL ON public.token_transactions TO service_role;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.token_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Engine runs history
CREATE TABLE public.engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  engine_id text NOT NULL,
  prompt text NOT NULL,
  result text,
  tokens_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.engine_runs TO authenticated;
GRANT ALL ON public.engine_runs TO service_role;
ALTER TABLE public.engine_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own runs" ON public.engine_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own runs" ON public.engine_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Orders for token pack purchases
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id text NOT NULL,
  tokens integer NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Atomic token spend: returns new balance or raises on insufficient funds
CREATE OR REPLACE FUNCTION public.spend_tokens(_user_id uuid, _amount integer, _engine_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  INSERT INTO public.token_balances (user_id, balance)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = _user_id AND balance >= _amount
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_tokens';
  END IF;

  INSERT INTO public.token_transactions (user_id, amount, kind, engine_id)
  VALUES (_user_id, -_amount, 'spend', _engine_id);

  RETURN new_balance;
END;
$$;

-- Atomic token grant (purchases, bonuses)
CREATE OR REPLACE FUNCTION public.grant_tokens(_user_id uuid, _amount integer, _kind text, _note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  INSERT INTO public.token_balances (user_id, balance)
  VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = token_balances.balance + _amount, updated_at = now()
  RETURNING balance INTO new_balance;

  INSERT INTO public.token_transactions (user_id, amount, kind, note)
  VALUES (_user_id, _amount, _kind, _note);

  RETURN new_balance;
END;
$$;