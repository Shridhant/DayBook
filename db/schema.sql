\restrict dbmate

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scope text,
    password text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: booking_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    booking_id uuid NOT NULL,
    service_id uuid NOT NULL,
    name_snapshot text NOT NULL,
    price_snapshot_paise integer NOT NULL,
    duration_snapshot_min smallint NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    CONSTRAINT booking_items_duration_snapshot_min_check CHECK ((duration_snapshot_min > 0)),
    CONSTRAINT booking_items_price_snapshot_paise_check CHECK ((price_snapshot_paise >= 0))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT uuidv7() NOT NULL,
    code text NOT NULL,
    customer_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    source text NOT NULL,
    total_paise integer NOT NULL,
    amount_due_now_paise integer DEFAULT 0 NOT NULL,
    hold_expires_at timestamp with time zone,
    notes text,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    created_by_user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bookings_amount_due_now_paise_check CHECK ((amount_due_now_paise >= 0)),
    CONSTRAINT bookings_check CHECK ((ends_at > starts_at)),
    CONSTRAINT bookings_check1 CHECK ((amount_due_now_paise <= total_paise)),
    CONSTRAINT bookings_check2 CHECK (((status <> 'pending'::text) OR (hold_expires_at IS NOT NULL))),
    CONSTRAINT bookings_check3 CHECK (((status <> 'cancelled'::text) OR (cancelled_at IS NOT NULL))),
    CONSTRAINT bookings_code_check CHECK ((code ~ '^DB-[0-9A-Z]{4,8}$'::text)),
    CONSTRAINT bookings_source_check CHECK ((source = ANY (ARRAY['online'::text, 'walk_in'::text, 'phone'::text]))),
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'no_show'::text, 'cancelled'::text, 'expired'::text]))),
    CONSTRAINT bookings_total_paise_check CHECK ((total_paise >= 0))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customers_email_check CHECK (((email IS NULL) OR (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
    CONSTRAINT customers_phone_check CHECK ((phone ~ '^[6-9][0-9]{9}$'::text))
);


--
-- Name: instagram_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instagram_posts (
    id uuid DEFAULT uuidv7() NOT NULL,
    url text NOT NULL,
    kind text NOT NULL,
    thumbnail_path text,
    caption text,
    placement text DEFAULT 'portfolio'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instagram_posts_kind_check CHECK ((kind = ANY (ARRAY['reel'::text, 'post'::text]))),
    CONSTRAINT instagram_posts_placement_check CHECK ((placement = ANY (ARRAY['hero'::text, 'portfolio'::text, 'reviews'::text]))),
    CONSTRAINT instagram_posts_url_check CHECK ((url ~ '^https://www\.instagram\.com/(p|reel)/[A-Za-z0-9_-]+/?$'::text))
);


--
-- Name: opening_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opening_hours (
    weekday smallint NOT NULL,
    opens_at time without time zone NOT NULL,
    closes_at time without time zone NOT NULL,
    CONSTRAINT opening_hours_check CHECK ((closes_at > opens_at)),
    CONSTRAINT opening_hours_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    rzp_event_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT uuidv7() NOT NULL,
    booking_id uuid NOT NULL,
    provider text DEFAULT 'razorpay'::text NOT NULL,
    rzp_order_id text NOT NULL,
    rzp_payment_id text,
    amount_paise integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    refunded_paise integer DEFAULT 0 NOT NULL,
    rzp_refund_id text,
    needs_review boolean DEFAULT false NOT NULL,
    raw jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_paise_check CHECK ((amount_paise > 0)),
    CONSTRAINT payments_check CHECK ((refunded_paise <= amount_paise)),
    CONSTRAINT payments_currency_check CHECK ((currency = 'INR'::text)),
    CONSTRAINT payments_provider_check CHECK ((provider = 'razorpay'::text)),
    CONSTRAINT payments_refunded_paise_check CHECK ((refunded_paise >= 0)),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['created'::text, 'authorized'::text, 'captured'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text])))
);


--
-- Name: portfolio_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    image_path text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    alt text NOT NULL,
    caption text,
    category_id uuid,
    featured boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT portfolio_items_height_check CHECK ((height > 0)),
    CONSTRAINT portfolio_items_width_check CHECK ((width > 0))
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    count integer NOT NULL,
    last_request bigint NOT NULL
);


--
-- Name: salon_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salon_closures (
    id uuid DEFAULT uuidv7() NOT NULL,
    date date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_categories_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT uuidv7() NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    price_paise integer NOT NULL,
    price_is_from boolean DEFAULT false NOT NULL,
    duration_min smallint NOT NULL,
    booking_amount_override_paise integer,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT services_booking_amount_override_paise_check CHECK ((booking_amount_override_paise >= 0)),
    CONSTRAINT services_duration_min_check CHECK (((duration_min > 0) AND (((duration_min)::integer % 5) = 0))),
    CONSTRAINT services_price_paise_check CHECK ((price_paise >= 0)),
    CONSTRAINT services_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    ip_address text,
    user_agent text,
    user_id uuid NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id boolean DEFAULT true NOT NULL,
    salon_name text DEFAULT 'Daybook'::text NOT NULL,
    booking_amount_type text DEFAULT 'fixed'::text NOT NULL,
    booking_amount_fixed_paise integer DEFAULT 50000 NOT NULL,
    booking_amount_percent smallint DEFAULT 20 NOT NULL,
    cancel_window_hours smallint DEFAULT 24 NOT NULL,
    slot_interval_min smallint DEFAULT 15 NOT NULL,
    booking_window_days smallint DEFAULT 30 NOT NULL,
    lead_time_min smallint DEFAULT 60 NOT NULL,
    hold_minutes smallint DEFAULT 15 NOT NULL,
    show_customer_phone_to_staff boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT settings_booking_amount_fixed_paise_check CHECK ((booking_amount_fixed_paise >= 0)),
    CONSTRAINT settings_booking_amount_percent_check CHECK (((booking_amount_percent >= 0) AND (booking_amount_percent <= 100))),
    CONSTRAINT settings_booking_amount_type_check CHECK ((booking_amount_type = ANY (ARRAY['fixed'::text, 'percent'::text]))),
    CONSTRAINT settings_booking_window_days_check CHECK (((booking_window_days >= 1) AND (booking_window_days <= 180))),
    CONSTRAINT settings_cancel_window_hours_check CHECK (((cancel_window_hours >= 0) AND (cancel_window_hours <= 168))),
    CONSTRAINT settings_hold_minutes_check CHECK (((hold_minutes >= 5) AND (hold_minutes <= 60))),
    CONSTRAINT settings_id_check CHECK (id),
    CONSTRAINT settings_lead_time_min_check CHECK (((lead_time_min >= 0) AND (lead_time_min <= 1440))),
    CONSTRAINT settings_slot_interval_min_check CHECK ((slot_interval_min = ANY (ARRAY[5, 10, 15, 20, 30, 60])))
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    photo_path text,
    bio text,
    specialties text,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))
);


--
-- Name: staff_leave; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_leave (
    id uuid DEFAULT uuidv7() NOT NULL,
    staff_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    reason text,
    status text DEFAULT 'approved'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_leave_check CHECK ((ends_at > starts_at)),
    CONSTRAINT staff_leave_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: staff_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_services (
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL,
    price_override_paise integer,
    CONSTRAINT staff_services_price_override_paise_check CHECK ((price_override_paise >= 0))
);


--
-- Name: staff_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_shifts (
    id uuid DEFAULT uuidv7() NOT NULL,
    staff_id uuid NOT NULL,
    weekday smallint NOT NULL,
    starts_at time without time zone NOT NULL,
    ends_at time without time zone NOT NULL,
    CONSTRAINT staff_shifts_check CHECK ((ends_at > starts_at)),
    CONSTRAINT staff_shifts_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);


--
-- Name: testimonials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testimonials (
    id uuid DEFAULT uuidv7() NOT NULL,
    name text NOT NULL,
    quote text NOT NULL,
    rating smallint DEFAULT 5 NOT NULL,
    service_label text,
    media_url text,
    visible boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    image text,
    role text DEFAULT 'staff'::text NOT NULL,
    staff_id uuid,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'receptionist'::text, 'staff'::text])))
);


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: booking_items booking_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_code_key UNIQUE (code);


--
-- Name: bookings bookings_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (staff_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text])));


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: instagram_posts instagram_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instagram_posts
    ADD CONSTRAINT instagram_posts_pkey PRIMARY KEY (id);


--
-- Name: instagram_posts instagram_posts_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instagram_posts
    ADD CONSTRAINT instagram_posts_url_key UNIQUE (url);


--
-- Name: opening_hours opening_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opening_hours
    ADD CONSTRAINT opening_hours_pkey PRIMARY KEY (weekday);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_rzp_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_rzp_event_id_key UNIQUE (rzp_event_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_rzp_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_rzp_order_id_key UNIQUE (rzp_order_id);


--
-- Name: payments payments_rzp_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_rzp_payment_id_key UNIQUE (rzp_payment_id);


--
-- Name: portfolio_items portfolio_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_key_key UNIQUE (key);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: salon_closures salon_closures_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_closures
    ADD CONSTRAINT salon_closures_date_key UNIQUE (date);


--
-- Name: salon_closures salon_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salon_closures
    ADD CONSTRAINT salon_closures_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_slug_key UNIQUE (slug);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_slug_key UNIQUE (slug);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: staff_leave staff_leave_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_leave
    ADD CONSTRAINT staff_leave_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_services staff_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_pkey PRIMARY KEY (staff_id, service_id);


--
-- Name: staff_shifts staff_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_pkey PRIMARY KEY (id);


--
-- Name: staff_shifts staff_shifts_staff_id_weekday_starts_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_staff_id_weekday_starts_at_key UNIQUE (staff_id, weekday, starts_at);


--
-- Name: staff staff_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_slug_key UNIQUE (slug);


--
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_staff_id_key UNIQUE (staff_id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: accounts_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounts_user_id_idx ON public.accounts USING btree (user_id);


--
-- Name: booking_items_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_items_booking_idx ON public.booking_items USING btree (booking_id, "position");


--
-- Name: bookings_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_customer_idx ON public.bookings USING btree (customer_id, starts_at DESC);


--
-- Name: bookings_pending_holds_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_pending_holds_idx ON public.bookings USING btree (hold_expires_at) WHERE (status = 'pending'::text);


--
-- Name: bookings_staff_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_staff_time_idx ON public.bookings USING btree (staff_id, starts_at);


--
-- Name: bookings_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_starts_at_idx ON public.bookings USING btree (starts_at);


--
-- Name: payments_booking_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_booking_idx ON public.payments USING btree (booking_id);


--
-- Name: payments_needs_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_needs_review_idx ON public.payments USING btree (created_at) WHERE needs_review;


--
-- Name: portfolio_items_listing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portfolio_items_listing_idx ON public.portfolio_items USING btree (sort_order) WHERE active;


--
-- Name: services_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_category_idx ON public.services USING btree (category_id, sort_order);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: staff_leave_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_leave_lookup_idx ON public.staff_leave USING btree (staff_id, starts_at) WHERE (status = 'approved'::text);


--
-- Name: staff_services_service_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_services_service_idx ON public.staff_services USING btree (service_id);


--
-- Name: verifications_identifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_identifier_idx ON public.verifications USING btree (identifier);


--
-- Name: bookings bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: instagram_posts instagram_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER instagram_posts_updated_at BEFORE UPDATE ON public.instagram_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: portfolio_items portfolio_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER portfolio_items_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_categories service_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_categories_updated_at BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: services services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: settings settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: staff_leave staff_leave_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staff_leave_updated_at BEFORE UPDATE ON public.staff_leave FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: staff staff_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: testimonials testimonials_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: booking_items booking_items_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_items booking_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- Name: bookings bookings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: bookings bookings_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT;


--
-- Name: portfolio_items portfolio_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL;


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_leave staff_leave_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_leave
    ADD CONSTRAINT staff_leave_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_services staff_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: staff_services staff_services_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_shifts staff_shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: users users_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20261115120000'),
    ('20261115120100'),
    ('20261115120200'),
    ('20261115120300'),
    ('20261116120000');
