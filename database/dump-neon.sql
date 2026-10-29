--
-- PostgreSQL database dump
--

-- \restrict wdynNNiInEzD0ZlJ3knMq7negeGhUlvUWUcNX2TP1uYTDLdoguGiYOnIsmfEJmB

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.wa_messages DROP CONSTRAINT IF EXISTS wa_messages_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_academic_year_id_fkey;
ALTER TABLE IF EXISTS ONLY public.attendance DROP CONSTRAINT IF EXISTS attendance_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.attendance DROP CONSTRAINT IF EXISTS attendance_class_id_fkey;
DROP TRIGGER IF EXISTS set_updated_at ON public.users;
DROP TRIGGER IF EXISTS set_updated_at ON public.students;
DROP TRIGGER IF EXISTS set_updated_at ON public.classes;
DROP TRIGGER IF EXISTS set_updated_at ON public.attendance;
DROP INDEX IF EXISTS public.uq_academic_year_active;
DROP INDEX IF EXISTS public.idx_wa_recent;
DROP INDEX IF EXISTS public.idx_wa_queue;
DROP INDEX IF EXISTS public.idx_students_name;
DROP INDEX IF EXISTS public.idx_students_guardian_phone;
DROP INDEX IF EXISTS public.idx_students_class;
DROP INDEX IF EXISTS public.idx_att_student_date;
DROP INDEX IF EXISTS public.idx_att_date_class;
DROP INDEX IF EXISTS public.idx_att_belum_pulang;
ALTER TABLE IF EXISTS ONLY public.wa_messages DROP CONSTRAINT IF EXISTS wa_messages_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.students DROP CONSTRAINT IF EXISTS students_pkey;
ALTER TABLE IF EXISTS ONLY public.students DROP CONSTRAINT IF EXISTS students_nis_key;
ALTER TABLE IF EXISTS ONLY public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE IF EXISTS ONLY public.holidays DROP CONSTRAINT IF EXISTS holidays_pkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_pkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_academic_year_id_name_key;
ALTER TABLE IF EXISTS ONLY public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_attendance_date_key;
ALTER TABLE IF EXISTS ONLY public.attendance DROP CONSTRAINT IF EXISTS attendance_pkey;
ALTER TABLE IF EXISTS ONLY public.academic_years DROP CONSTRAINT IF EXISTS academic_years_pkey;
ALTER TABLE IF EXISTS ONLY public.academic_years DROP CONSTRAINT IF EXISTS academic_years_name_key;
ALTER TABLE IF EXISTS public.wa_messages ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.attendance ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.academic_years ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.wa_messages_id_seq;
DROP TABLE IF EXISTS public.wa_messages;
DROP VIEW IF EXISTS public.v_rekap_harian_kelas;
DROP VIEW IF EXISTS public.v_rekap_bulanan_siswa;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.students;
DROP TABLE IF EXISTS public.settings;
DROP TABLE IF EXISTS public.holidays;
DROP TABLE IF EXISTS public.classes;
DROP SEQUENCE IF EXISTS public.attendance_id_seq;
DROP TABLE IF EXISTS public.attendance;
DROP SEQUENCE IF EXISTS public.academic_years_id_seq;
DROP TABLE IF EXISTS public.academic_years;
DROP FUNCTION IF EXISTS public.trg_set_updated_at();
DROP TYPE IF EXISTS public.user_role;
DROP TYPE IF EXISTS public.message_status;
DROP TYPE IF EXISTS public.attendance_status;
DROP EXTENSION IF EXISTS pgcrypto;
DROP EXTENSION IF EXISTS pg_trgm;
--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_status AS ENUM (
    'HADIR',
    'TERLAMBAT',
    'IZIN',
    'SAKIT',
    'ALPA'
);


--
-- Name: message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_status AS ENUM (
    'QUEUED',
    'SENT',
    'FAILED',
    'CANCELLED'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'SUPER_ADMIN',
    'ADMIN'
);


--
-- Name: trg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_years (
    id smallint NOT NULL,
    name character varying(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    CONSTRAINT academic_years_check CHECK ((end_date > start_date))
);


--
-- Name: academic_years_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.academic_years_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: academic_years_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.academic_years_id_seq OWNED BY public.academic_years.id;


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid,
    attendance_date date NOT NULL,
    status public.attendance_status NOT NULL,
    check_in_at timestamp with time zone,
    check_out_at timestamp with time zone,
    late_minutes smallint DEFAULT 0 NOT NULL,
    device_code character varying(20),
    note text,
    attachment_path text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year_id smallint NOT NULL,
    name character varying(30) NOT NULL,
    grade_level smallint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    holiday_date date NOT NULL,
    name character varying(120) NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key character varying(64) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nis character varying(20) NOT NULL,
    full_name character varying(120) NOT NULL,
    class_id uuid,
    guardian_phone character varying(20),
    notify boolean DEFAULT true NOT NULL,
    photo_path text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT students_guardian_phone_check CHECK (((guardian_phone IS NULL) OR ((guardian_phone)::text ~ '^[1-9][0-9]{7,14}$'::text)))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash text NOT NULL,
    full_name character varying(120) NOT NULL,
    role public.user_role DEFAULT 'ADMIN'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    token_version integer DEFAULT 1 NOT NULL,
    last_login_at timestamp with time zone,
    last_login_ip inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_rekap_bulanan_siswa; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_rekap_bulanan_siswa AS
 SELECT student_id,
    class_id,
    (date_trunc('month'::text, (attendance_date)::timestamp with time zone))::date AS bulan,
    count(*) FILTER (WHERE (status = 'HADIR'::public.attendance_status)) AS hadir,
    count(*) FILTER (WHERE (status = 'TERLAMBAT'::public.attendance_status)) AS terlambat,
    count(*) FILTER (WHERE (status = 'IZIN'::public.attendance_status)) AS izin,
    count(*) FILTER (WHERE (status = 'SAKIT'::public.attendance_status)) AS sakit,
    count(*) FILTER (WHERE (status = 'ALPA'::public.attendance_status)) AS alpa,
    COALESCE(sum(late_minutes), (0)::bigint) AS total_menit_terlambat,
    count(*) AS hari_efektif,
    round(((100.0 * (count(*) FILTER (WHERE (status = ANY (ARRAY['HADIR'::public.attendance_status, 'TERLAMBAT'::public.attendance_status]))))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS persen_hadir
   FROM public.attendance a
  GROUP BY student_id, class_id, (date_trunc('month'::text, (attendance_date)::timestamp with time zone));


--
-- Name: v_rekap_harian_kelas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_rekap_harian_kelas AS
 SELECT a.attendance_date,
    a.class_id,
    c.name AS class_name,
    count(*) AS total,
    count(*) FILTER (WHERE (a.status = 'HADIR'::public.attendance_status)) AS hadir,
    count(*) FILTER (WHERE (a.status = 'TERLAMBAT'::public.attendance_status)) AS terlambat,
    count(*) FILTER (WHERE (a.status = 'IZIN'::public.attendance_status)) AS izin,
    count(*) FILTER (WHERE (a.status = 'SAKIT'::public.attendance_status)) AS sakit,
    count(*) FILTER (WHERE (a.status = 'ALPA'::public.attendance_status)) AS alpa,
    round(((100.0 * (count(*) FILTER (WHERE (a.status = ANY (ARRAY['HADIR'::public.attendance_status, 'TERLAMBAT'::public.attendance_status]))))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS persen_hadir
   FROM (public.attendance a
     LEFT JOIN public.classes c ON ((c.id = a.class_id)))
  GROUP BY a.attendance_date, a.class_id, c.name;


--
-- Name: wa_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_messages (
    id bigint NOT NULL,
    student_id uuid,
    phone character varying(20) NOT NULL,
    body text NOT NULL,
    event character varying(20) NOT NULL,
    status public.message_status DEFAULT 'QUEUED'::public.message_status NOT NULL,
    attempts smallint DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone
);


--
-- Name: wa_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wa_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wa_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wa_messages_id_seq OWNED BY public.wa_messages.id;


--
-- Name: academic_years id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years ALTER COLUMN id SET DEFAULT nextval('public.academic_years_id_seq'::regclass);


--
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- Name: wa_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_messages ALTER COLUMN id SET DEFAULT nextval('public.wa_messages_id_seq'::regclass);


--
-- Data for Name: academic_years; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.academic_years VALUES (1, '2026/2027', '2026-07-13', '2027-06-19', true);


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.attendance VALUES (1, '921de934-955b-4707-8490-f5ab97b52646', '5817c864-e3d5-4bc8-9ca0-84bdc9ea3c37', '2026-10-02', 'HADIR', '2026-10-02 06:15:00+07', '2026-10-02 15:16:00+07', 0, NULL, 'Lupa bawa kartu', NULL, '616f86bf-5ee3-4943-8862-20580ffc45e2', '2026-10-02 14:44:46.744+07', '2026-10-02 15:27:10.461737+07');
INSERT INTO public.attendance VALUES (2, '921de934-955b-4707-8490-f5ab97b52646', '5817c864-e3d5-4bc8-9ca0-84bdc9ea3c37', '2026-10-26', 'SAKIT', NULL, NULL, 0, 'MANUAL', 'Demam tinggi dan flu', NULL, '616f86bf-5ee3-4943-8862-20580ffc45e2', '2026-10-26 12:51:52.998+07', '2026-10-26 12:51:53.040635+07');
INSERT INTO public.attendance VALUES (4, '5bb72a9e-368f-4ec1-9c84-65fb393354f9', '1c1e2eab-d186-48b4-bd80-269d0b6b2e61', '2026-10-26', 'IZIN', NULL, NULL, 0, 'MANUAL', 'Surat izin dokter menyusul', NULL, '616f86bf-5ee3-4943-8862-20580ffc45e2', '2026-10-26 12:56:06.629+07', '2026-10-26 12:56:06.709338+07');


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.classes VALUES ('5817c864-e3d5-4bc8-9ca0-84bdc9ea3c37', 1, 'VII-A', 7, true, '2026-10-02 13:59:44.7223+07', '2026-10-02 13:59:44.7223+07');
INSERT INTO public.classes VALUES ('daa9bc49-4ad2-423e-b1e1-4078abd83b1b', 1, 'VII-B', 7, true, '2026-10-02 13:59:44.7223+07', '2026-10-02 13:59:44.7223+07');
INSERT INTO public.classes VALUES ('b810a4f0-f08a-45ea-a55d-02ce7f8736b1', 1, 'VIII-A', 8, true, '2026-10-02 13:59:44.7223+07', '2026-10-02 13:59:44.7223+07');
INSERT INTO public.classes VALUES ('e0913df5-e081-4bc8-8806-66bb145c0384', 1, 'VIII-B', 8, true, '2026-10-02 13:59:44.7223+07', '2026-10-02 13:59:44.7223+07');
INSERT INTO public.classes VALUES ('1c1e2eab-d186-48b4-bd80-269d0b6b2e61', 1, 'IX-A', 9, true, '2026-10-02 13:59:44.7223+07', '2026-10-02 13:59:44.7223+07');
INSERT INTO public.classes VALUES ('5926e202-ebad-470b-9f74-50de3814dd8f', 1, 'IX-B', 9, true, '2026-10-02 13:59:44.7223+07', '2026-10-02 13:59:44.7223+07');


--
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.holidays VALUES ('2026-08-17', 'Hari Kemerdekaan RI');
INSERT INTO public.holidays VALUES ('2026-12-25', 'Hari Raya Natal');
INSERT INTO public.holidays VALUES ('2027-01-01', 'Tahun Baru Masehi');


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.settings VALUES ('sekolah', '{"nama": "SMP Negeri 1 Contoh", "alamat": "Jl. Pendidikan No. 1", "kepala_sekolah": "Drs. Contoh Nama, M.Pd."}', '2026-10-02 13:59:44.731216+07');
INSERT INTO public.settings VALUES ('scanners', '[]', '2026-10-02 13:59:44.731216+07');
INSERT INTO public.settings VALUES ('scan', '{"bunyi": true, "debounce_detik": 60, "tampilkan_foto": true}', '2026-10-02 13:59:44.731216+07');
INSERT INTO public.settings VALUES ('whatsapp', '{"aktif": false, "provider": "dummy", "jam_tenang": {"mulai": "18:30", "selesai": "06:00"}, "kirim_saat": ["MASUK", "PULANG", "TERLAMBAT", "ALPA"], "jeda_max_ms": 8000, "jeda_min_ms": 3000, "maks_per_hari": 200, "maks_percobaan": 3, "rekap_mingguan": true}', '2026-10-02 13:59:44.731216+07');
INSERT INTO public.settings VALUES ('presensi', '{"khusus": {}, "jam_masuk": "07:00", "batas_alpa": "13:00", "jam_pulang": "09:00", "hari_sekolah": [1, 2, 3, 4, 5], "toleransi_menit": 10, "batas_akhir_masuk": "08:00", "batas_akhir_pulang": "17:00"}', '2026-10-02 13:59:44.731216+07');
INSERT INTO public.settings VALUES ('template_wa', '{"ALPA": "{Assalamu''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nHingga pukul {jam} hari {tanggal}, ananda *{siswa}* ({kelas}) *BELUM TERCATAT HADIR* dan tidak ada keterangan izin.\n\n{Mohon konfirmasinya. Terima kasih.|Mohon hubungi pihak sekolah bila ananda berhalangan.|Terima kasih.}\n— {sekolah}", "IZIN": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) tercatat *IZIN* pada {tanggal}.\\nKeterangan: {catatan}.\\n\\n{Terima kasih atas informasinya.|Terima kasih.|Hormat kami.}\\n— {sekolah}", "MASUK": "{Assalamu''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) {telah HADIR|sudah sampai|tercatat hadir} di sekolah pada {tanggal} pukul *{jam}*.\n\n{Terima kasih.|Semoga ananda belajar dengan semangat.|Hormat kami.}\n— {sekolah}", "REKAP": "Bpk/Ibu, rekap kehadiran ananda *{siswa}* ({kelas}) bulan {bulan}:\n\nHadir: {hadir} hari\nTerlambat: {terlambat} hari\nIzin: {izin} hari\nSakit: {sakit} hari\nAlpa: {alpa} hari\n\n*Kehadiran: {persen}%*\n\n— {sekolah}", "SAKIT": "{Assalamu''''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\\n\\nAnanda *{siswa}* ({kelas}) tercatat *SAKIT* pada {tanggal}.\\nKeterangan: {catatan}.\\n\\n{Semoga ananda lekas sembuh.|Semoga lekas pulih. Terima kasih.|Hormat kami.}\\n— {sekolah}", "PULANG": "{Assalamu''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) {sudah PULANG|telah selesai KBM dan pulang|tercatat scan pulang} dari sekolah pada {tanggal} pukul *{jam}*.\n\n{Terima kasih.|Semoga selamat sampai di rumah.|Hormat kami.}\n— {sekolah}", "TERLAMBAT": "{Assalamu''alaikum|Selamat pagi|Yth.} Bpk/Ibu.\n\nAnanda *{siswa}* ({kelas}) hadir *TERLAMBAT {menit} menit* pada {tanggal} pukul *{jam}*.\n\n{Mohon perhatiannya. Terima kasih.|Mohon bantuannya untuk mengingatkan ananda.|Terima kasih.}\n— {sekolah}"}', '2026-10-02 13:59:44.731216+07');


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.students VALUES ('e1b4d07a-6842-4988-b670-9c1ca15f28d0', '2026073', 'Citra Dewi', '5817c864-e3d5-4bc8-9ca0-84bdc9ea3c37', '628561234567', false, NULL, true, '2026-10-02 13:59:44.724981+07', '2026-10-02 13:59:44.724981+07');
INSERT INTO public.students VALUES ('f81c79be-6f0e-455b-8a1b-085f4a146be2', '2026072', 'Bunga Lestari', '5817c864-e3d5-4bc8-9ca0-84bdc9ea3c37', '628134567890', false, NULL, true, '2026-10-02 13:59:44.724981+07', '2026-10-02 13:59:44.724981+07');
INSERT INTO public.students VALUES ('921de934-955b-4707-8490-f5ab97b52646', '2026071', 'Andi Pratama', '5817c864-e3d5-4bc8-9ca0-84bdc9ea3c37', '628123456789', false, NULL, true, '2026-10-02 13:59:44.724981+07', '2026-10-02 13:59:44.724981+07');
INSERT INTO public.students VALUES ('5bb72a9e-368f-4ec1-9c84-65fb393354f9', '123231313', 'makmur', '1c1e2eab-d186-48b4-bd80-269d0b6b2e61', '6281234567890', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('e3ec957f-4d8d-43bf-acc7-c8f83c881bdb', '123311231', 'Novan 1', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577577', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('6a2aad09-c89e-4c54-a3e3-14b7dcc8a755', '123311232', 'Novan 2', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577578', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('0d49faa3-4ec8-43cc-bc5e-39562f3bd492', '123311233', 'Novan 3', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577579', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('681ebf7a-2185-4cd5-b7a1-d7e8f77335c6', '123311234', 'Novan 4', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577580', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('90781eee-ca0a-4f5a-a94c-d4a4c6c9bf87', '123311235', 'Novan 5', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577581', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('0c0bf52c-929f-4cb7-893c-3c7830e3d757', '123311236', 'Novan 6', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577582', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('6e2c61a8-f531-4997-a404-2e978fb8fd57', '123311237', 'Novan 7', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577583', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('468ad6ce-edcb-4951-90cf-d9450fca549b', '123311238', 'Novan 8', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577584', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('0fa44835-4a0e-4709-ab1e-47c6139b838c', '123311239', 'Novan 9', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577585', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('d4dd61fe-0e6c-46bb-a9bf-740127702548', '123311240', 'Novan 10', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577586', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('68a0a3bd-853c-4027-9ecc-f233415b7946', '123311241', 'Novan 11', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577587', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('11c84df7-e484-4992-984b-39f02eb00b3f', '123311242', 'Novan 12', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577588', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('8f7ec461-c329-4f08-811b-67e7a0c6069c', '123311243', 'Novan 13', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577589', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('d141dc7d-955d-4d0e-b6cd-869d83fe1dff', '123311244', 'Novan 14', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577590', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('3d69570d-ae28-4ca9-89cb-78c672249857', '123311245', 'Novan 15', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577591', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('1cb6889a-7e0c-4731-bc75-1e7090979cb3', '123311246', 'Novan 16', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577592', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('61cee9d8-5914-49b4-9f7c-2c82b2a7eaaa', '123311247', 'Novan 17', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577593', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('70d72f71-5ce2-4c46-96d7-a54d4e688c13', '123311248', 'Novan 18', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577594', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('e101847c-54d3-4a8b-936f-625e6949b518', '123311249', 'Novan 19', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577595', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('c0b3773f-f824-4e99-9dca-747916a68f95', '123311250', 'Novan 20', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577596', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('2128db40-9058-49b8-af31-64f9e2be697d', '123311251', 'Novan 21', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577597', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('dd70d59d-7dcf-4344-9d31-ef6d7a796687', '123311252', 'Novan 22', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577598', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('a2b7563f-f34a-48f1-8f89-a71773479e89', '123311253', 'Novan 23', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577599', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('032b355a-9be8-4eba-a537-bda80ccf3097', '123311254', 'Novan 24', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577600', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('7469d9f1-e948-47b9-88ce-e364249ab32f', '123311255', 'Novan 25', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577601', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('6b203497-3ef8-45b2-9c36-13ef496be6d4', '123311256', 'Novan 26', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577602', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('c79fdd3c-27cf-48f3-a799-d25cc8f4bc61', '123311257', 'Novan 27', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577603', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('97acfc1a-91ce-4bdb-83fa-fac0e3d614c7', '123311258', 'Novan 28', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577604', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');
INSERT INTO public.students VALUES ('a6bdf41f-fac5-410c-960e-f95f705e2f36', '123311259', 'Novan 29', '5926e202-ebad-470b-9f74-50de3814dd8f', '628756577605', true, NULL, true, '2026-10-02 15:40:49.334+07', '2026-10-02 15:40:49.334+07');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES ('40666051-f872-4c6e-9c9c-8bd9f6c4ed1e', 'admin', '$argon2id$v=19$m=19456,t=2,p=1$2R4NV1jlcuAKxePN6vOkbA$KJySSe2AsL8HByH0ZuCuFeWQXqI7HZF7tEBt94NTcJE', 'Admin Tata Usaha', 'ADMIN', true, false, 2, '2026-10-26 11:46:45.31+07', '::1', '2026-10-02 13:59:44.71854+07', '2026-10-26 11:46:45.312328+07');
INSERT INTO public.users VALUES ('616f86bf-5ee3-4943-8862-20580ffc45e2', 'superadmin', '$argon2id$v=19$m=19456,t=2,p=1$2R4NV1jlcuAKxePN6vOkbA$KJySSe2AsL8HByH0ZuCuFeWQXqI7HZF7tEBt94NTcJE', 'Super Administrator', 'SUPER_ADMIN', true, false, 2, '2026-10-29 15:52:51.887+07', '::1', '2026-10-02 13:59:44.71854+07', '2026-10-29 15:52:51.893075+07');


--
-- Data for Name: wa_messages; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: academic_years_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.academic_years_id_seq', 1, true);


--
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attendance_id_seq', 5, true);


--
-- Name: wa_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wa_messages_id_seq', 1, false);


--
-- Name: academic_years academic_years_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_name_key UNIQUE (name);


--
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_student_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_student_id_attendance_date_key UNIQUE (student_id, attendance_date);


--
-- Name: classes classes_academic_year_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_academic_year_id_name_key UNIQUE (academic_year_id, name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (holiday_date);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: students students_nis_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_nis_key UNIQUE (nis);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: wa_messages wa_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT wa_messages_pkey PRIMARY KEY (id);


--
-- Name: idx_att_belum_pulang; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_att_belum_pulang ON public.attendance USING btree (attendance_date) WHERE (check_out_at IS NULL);


--
-- Name: idx_att_date_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_att_date_class ON public.attendance USING btree (attendance_date, class_id);


--
-- Name: idx_att_student_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_att_student_date ON public.attendance USING btree (student_id, attendance_date DESC);


--
-- Name: idx_students_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_class ON public.students USING btree (class_id) WHERE is_active;


--
-- Name: idx_students_guardian_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_guardian_phone ON public.students USING btree (guardian_phone);


--
-- Name: idx_students_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_name ON public.students USING gin (full_name public.gin_trgm_ops);


--
-- Name: idx_wa_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_queue ON public.wa_messages USING btree (created_at) WHERE (status = 'QUEUED'::public.message_status);


--
-- Name: idx_wa_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_recent ON public.wa_messages USING btree (created_at DESC);


--
-- Name: uq_academic_year_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_academic_year_active ON public.academic_years USING btree (is_active) WHERE is_active;


--
-- Name: attendance set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: classes set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: students set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: users set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: attendance attendance_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: attendance attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: classes classes_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE RESTRICT;


--
-- Name: students students_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: wa_messages wa_messages_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT wa_messages_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

-- \unrestrict wdynNNiInEzD0ZlJ3knMq7negeGhUlvUWUcNX2TP1uYTDLdoguGiYOnIsmfEJmB

