ALTER TABLE public.investments
  ADD COLUMN broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL;

CREATE INDEX investments_broker_idx ON public.investments(broker_id);

ALTER TABLE public.investments ALTER COLUMN broker DROP NOT NULL;