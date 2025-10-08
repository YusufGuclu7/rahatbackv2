--
-- PostgreSQL database dump
--

\restrict 45j8gVJiNiNVVRrj1R5jpI3VByiA15gUiAyWSW06kbgvsJublQOHUyBNtRe4Kqf

-- Dumped from database version 14.19
-- Dumped by pg_dump version 14.19

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

--
-- Name: BackupStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BackupStatus" AS ENUM (
    'running',
    'success',
    'failed',
    'cancelled'
);


ALTER TYPE public."BackupStatus" OWNER TO postgres;

--
-- Name: DatabaseType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DatabaseType" AS ENUM (
    'postgresql',
    'mysql',
    'mongodb',
    'mssql',
    'mariadb',
    'sqlite'
);


ALTER TYPE public."DatabaseType" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'user',
    'admin'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: ScheduleType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ScheduleType" AS ENUM (
    'manual',
    'hourly',
    'daily',
    'weekly',
    'monthly',
    'custom'
);


ALTER TYPE public."ScheduleType" OWNER TO postgres;

--
-- Name: StorageType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StorageType" AS ENUM (
    'local',
    's3',
    'ftp',
    'azure'
);


ALTER TYPE public."StorageType" OWNER TO postgres;

--
-- Name: TokenType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TokenType" AS ENUM (
    'access',
    'refresh',
    'resetPassword',
    'verifyEmail'
);


ALTER TYPE public."TokenType" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: BackupHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BackupHistory" (
    id integer NOT NULL,
    "backupJobId" integer,
    "databaseId" integer NOT NULL,
    status public."BackupStatus" NOT NULL,
    "fileName" text NOT NULL,
    "fileSize" bigint,
    "filePath" text NOT NULL,
    duration integer,
    "errorMessage" text,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public."BackupHistory" OWNER TO postgres;

--
-- Name: BackupHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."BackupHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."BackupHistory_id_seq" OWNER TO postgres;

--
-- Name: BackupHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."BackupHistory_id_seq" OWNED BY public."BackupHistory".id;


--
-- Name: BackupJob; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BackupJob" (
    id integer NOT NULL,
    "databaseId" integer NOT NULL,
    name text NOT NULL,
    "scheduleType" public."ScheduleType" NOT NULL,
    "cronExpression" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "storageType" public."StorageType" NOT NULL,
    "storagePath" text NOT NULL,
    "retentionDays" integer DEFAULT 30 NOT NULL,
    compression boolean DEFAULT true NOT NULL,
    "lastRunAt" timestamp(3) without time zone,
    "nextRunAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."BackupJob" OWNER TO postgres;

--
-- Name: BackupJob_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."BackupJob_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."BackupJob_id_seq" OWNER TO postgres;

--
-- Name: BackupJob_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."BackupJob_id_seq" OWNED BY public."BackupJob".id;


--
-- Name: Database; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Database" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    name text NOT NULL,
    type public."DatabaseType" NOT NULL,
    host text NOT NULL,
    port integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    database text NOT NULL,
    "connectionString" text,
    "sslEnabled" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastTestedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Database" OWNER TO postgres;

--
-- Name: Database_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Database_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Database_id_seq" OWNER TO postgres;

--
-- Name: Database_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Database_id_seq" OWNED BY public."Database".id;


--
-- Name: Token; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Token" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    token text NOT NULL,
    type public."TokenType" NOT NULL,
    "userId" integer NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    blacklisted boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Token" OWNER TO postgres;

--
-- Name: Token_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Token_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Token_id_seq" OWNER TO postgres;

--
-- Name: Token_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Token_id_seq" OWNED BY public."Token".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    status boolean DEFAULT true NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."Role" DEFAULT 'user'::public."Role" NOT NULL,
    "isEmailVerified" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: BackupHistory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackupHistory" ALTER COLUMN id SET DEFAULT nextval('public."BackupHistory_id_seq"'::regclass);


--
-- Name: BackupJob id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackupJob" ALTER COLUMN id SET DEFAULT nextval('public."BackupJob_id_seq"'::regclass);


--
-- Name: Database id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Database" ALTER COLUMN id SET DEFAULT nextval('public."Database_id_seq"'::regclass);


--
-- Name: Token id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Token" ALTER COLUMN id SET DEFAULT nextval('public."Token_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: BackupHistory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BackupHistory" (id, "backupJobId", "databaseId", status, "fileName", "fileSize", "filePath", duration, "errorMessage", "startedAt", "completedAt") FROM stdin;
1	1	1	failed		\N		\N	Command failed: pg_dump -h localhost -p 5432 -U postgres -d rahat_fatura_db -F p -f "C:\\Users\\USER\\rahatback\\backend\\backups\\job_1\\rahat_fatura_db_2025-10-08T11-29-36-071Z.sql"\n'pg_dump' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n	2025-10-08 11:29:36.049	2025-10-08 11:29:36.099
2	1	1	failed		\N		\N	Command failed: pg_dump -h localhost -p 5432 -U postgres -d rahat_fatura_db -F p -f "C:\\Users\\USER\\rahatback\\backend\\backups\\job_1\\rahat_fatura_db_2025-10-08T11-29-46-102Z.sql"\n'pg_dump' is not recognized as an internal or external command,\r\noperable program or batch file.\r\n	2025-10-08 11:29:46.1	2025-10-08 11:29:46.124
3	1	1	running		\N		\N	\N	2025-10-08 11:37:45.29	\N
\.


--
-- Data for Name: BackupJob; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BackupJob" (id, "databaseId", name, "scheduleType", "cronExpression", "isActive", "storageType", "storagePath", "retentionDays", compression, "lastRunAt", "nextRunAt", "createdAt", "updatedAt") FROM stdin;
1	1	Test PostgreSQL DB - Backup	daily		t	local	/backups/test_postgresql_db	30	t	\N	2025-10-08 23:00:00	2025-10-08 11:23:21.955	2025-10-08 11:37:03.119
\.


--
-- Data for Name: Database; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Database" (id, "userId", name, type, host, port, username, password, database, "connectionString", "sslEnabled", "isActive", "lastTestedAt", "createdAt", "updatedAt") FROM stdin;
1	3	Test PostgreSQL DB	postgresql	localhost	5432	postgres	84535c7bac2f598023731f3ee52de04e:738fcd67ca4566e3a7829b836141e6fa	rahat_fatura_db		f	t	2025-10-08 09:45:05.324	2025-10-08 09:33:54.496	2025-10-08 09:45:05.325
\.


--
-- Data for Name: Token; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Token" (id, "createdAt", "updatedAt", token, type, "userId", "expiresAt", blacklisted) FROM stdin;
1	2025-10-08 08:18:38.599	2025-10-08 08:18:38.599	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImlhdCI6MTc1OTkxMTUxOCwiZXhwIjoxNzYyNTAzNTE4LCJ0eXBlIjoicmVmcmVzaCJ9.RjD7rsUXSPfJxd8j_JWa6dp0wQJxFm4fQ_T9SPte9ns	refresh	2	2025-11-07 08:18:38.594	f
2	2025-10-08 08:18:47.279	2025-10-08 08:18:47.279	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImlhdCI6MTc1OTkxMTUyNywiZXhwIjoxNzYyNTAzNTI3LCJ0eXBlIjoicmVmcmVzaCJ9.9sJZFXS3pcBro823R-g_k9PX0-VzBRoQXLTHi8hNxTY	refresh	2	2025-11-07 08:18:47.278	f
3	2025-10-08 08:22:23.465	2025-10-08 08:22:23.465	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImlhdCI6MTc1OTkxMTc0MywiZXhwIjoxNzYyNTAzNzQzLCJ0eXBlIjoicmVmcmVzaCJ9.i_E8sc9uKC0O2Aa2kZQRUFxLb7Hsi5TnSOs4ny7YaKM	refresh	2	2025-11-07 08:22:23.463	f
4	2025-10-08 08:22:24.714	2025-10-08 08:22:24.714	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImlhdCI6MTc1OTkxMTc0NCwiZXhwIjoxNzYyNTAzNzQ0LCJ0eXBlIjoicmVmcmVzaCJ9.44h4GVwiUyf-ycJnUNLHy_C57fqX5whovXH4ltYpDJA	refresh	2	2025-11-07 08:22:24.712	f
5	2025-10-08 08:28:39.223	2025-10-08 08:28:39.223	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImlhdCI6MTc1OTkxMjExOSwiZXhwIjoxNzYyNTA0MTE5LCJ0eXBlIjoicmVmcmVzaCJ9.Y_UqTPvfutrHIhFzjvFSU5aNRYT-xh3x3etw2oatPiY	refresh	3	2025-11-07 08:28:39.221	f
6	2025-10-08 08:28:47.769	2025-10-08 08:28:47.769	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImlhdCI6MTc1OTkxMjEyNywiZXhwIjoxNzYyNTA0MTI3LCJ0eXBlIjoicmVmcmVzaCJ9.lrvW2qv9-Ib2lPdx3mhOwLMY4BNi2TEKfmuyeN95Kyg	refresh	3	2025-11-07 08:28:47.769	f
7	2025-10-08 08:33:23.579	2025-10-08 08:33:23.579	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImlhdCI6MTc1OTkxMjQwMywiZXhwIjoxNzYyNTA0NDAzLCJ0eXBlIjoicmVmcmVzaCJ9.S_yInt6cIAgq5QRsrONPnTOQZHBWpChrkahYJZWPhg4	refresh	3	2025-11-07 08:33:23.575	f
8	2025-10-08 08:33:25.272	2025-10-08 08:33:25.272	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImlhdCI6MTc1OTkxMjQwNSwiZXhwIjoxNzYyNTA0NDA1LCJ0eXBlIjoicmVmcmVzaCJ9.O3xMldlkV1LFfYeqk--ZKmx0K4-YKiuTEh4TNLTKrs8	refresh	3	2025-11-07 08:33:25.27	f
9	2025-10-08 08:38:35.753	2025-10-08 08:38:35.753	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImlhdCI6MTc1OTkxMjcxNSwiZXhwIjoxNzYyNTA0NzE1LCJ0eXBlIjoicmVmcmVzaCJ9.a5SWd0ghZL0elSzljZFuIXktd6ojO3D9ECz_Bh9Oycs	refresh	3	2025-11-07 08:38:35.753	f
10	2025-10-08 08:38:37.509	2025-10-08 08:38:37.509	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImlhdCI6MTc1OTkxMjcxNywiZXhwIjoxNzYyNTA0NzE3LCJ0eXBlIjoicmVmcmVzaCJ9.odo0_GV4IiiKRZW92-OfNCiidwFTFIlONYFYNf851iI	refresh	3	2025-11-07 08:38:37.508	f
11	2025-10-08 08:38:37.695	2025-10-08 08:38:37.695	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImlhdCI6MTc1OTkxMjcxNywiZXhwIjoxNzYyNTA0NzE3LCJ0eXBlIjoicmVmcmVzaCJ9.odo0_GV4IiiKRZW92-OfNCiidwFTFIlONYFYNf851iI	refresh	3	2025-11-07 08:38:37.695	f
12	2025-10-08 08:39:52.384	2025-10-08 08:39:52.384	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTEyNzkyLCJleHAiOjE3NjI1MDQ3OTIsInR5cGUiOiJyZWZyZXNoIn0.1Nficc1lng-AFsrxdS8v0zoFD8N8PMxfDBGze8-R-yg	refresh	3	2025-11-07 08:39:52.376	f
13	2025-10-08 08:41:46.641	2025-10-08 08:41:46.641	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTEyOTA2LCJleHAiOjE3NjI1MDQ5MDYsInR5cGUiOiJyZWZyZXNoIn0.KyaPZ5LiKzP6Lbq9cVq5tDRX-SA0AEkIpAt9IOnRcXQ	refresh	3	2025-11-07 08:41:46.636	f
14	2025-10-08 08:42:15.288	2025-10-08 08:42:15.288	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTEyOTM1LCJleHAiOjE3NjI1MDQ5MzUsInR5cGUiOiJyZWZyZXNoIn0.ZmLGuRCT2oYI_TuN9ucImByGAtaoaqiZ3Qd_klUp5dU	refresh	3	2025-11-07 08:42:15.286	f
15	2025-10-08 08:43:16.138	2025-10-08 08:43:16.138	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTEyOTk2LCJleHAiOjE3NjI1MDQ5OTYsInR5cGUiOiJyZWZyZXNoIn0.RgcWc48FBs8-nXg4YFMcEw8id3yd8xit4ODg2mV59i8	refresh	3	2025-11-07 08:43:16.135	f
16	2025-10-08 08:46:58.706	2025-10-08 08:46:58.706	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTEzMjE4LCJleHAiOjE3NjI1MDUyMTgsInR5cGUiOiJyZWZyZXNoIn0.H3h6e4o09V799VfSnLTW0rnUfLAy8yXGw2zdb0Ix3Do	refresh	3	2025-11-07 08:46:58.701	f
17	2025-10-08 09:20:30.28	2025-10-08 09:20:30.28	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTE1MjMwLCJleHAiOjE3NjI1MDcyMzAsInR5cGUiOiJyZWZyZXNoIn0.Rti0ZnazywsJGxozbpg4GEMwbFLiQTnDN3xxvwmq2ZE	refresh	3	2025-11-07 09:20:30.276	f
18	2025-10-08 09:28:58.248	2025-10-08 09:28:58.248	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTE1NzM4LCJleHAiOjE3NjI1MDc3MzgsInR5cGUiOiJyZWZyZXNoIn0.XAoS-bP9UL5tBTTEFFcPGEJQdHMdKyh1bNJcVNdR_Xc	refresh	3	2025-11-07 09:28:58.243	f
19	2025-10-08 09:30:46.926	2025-10-08 09:30:46.926	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTE1ODQ2LCJleHAiOjE3NjI1MDc4NDYsInR5cGUiOiJyZWZyZXNoIn0.ea1vHC0zq03Bob9RiLFFMsJKRwzMBhkycRWmL1OfDPk	refresh	3	2025-11-07 09:30:46.924	f
20	2025-10-08 11:20:25.73	2025-10-08 11:20:25.73	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTIyNDI1LCJleHAiOjE3NjI1MTQ0MjUsInR5cGUiOiJyZWZyZXNoIn0.Wkblj3betZkLvF2bUEW0EkK6SZnBPwcA1yWXwjpxjak	refresh	3	2025-11-07 11:20:25.725	f
21	2025-10-08 11:29:12.671	2025-10-08 11:29:12.671	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTIyOTUyLCJleHAiOjE3NjI1MTQ5NTIsInR5cGUiOiJyZWZyZXNoIn0.WI-wMFVI3Za9FN6j1pegqJwpn9uem56vMu2D4WJePFw	refresh	3	2025-11-07 11:29:12.669	f
22	2025-10-08 11:37:36.82	2025-10-08 11:37:36.82	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzU5OTIzNDU2LCJleHAiOjE3NjI1MTU0NTYsInR5cGUiOiJyZWZyZXNoIn0.YsgIU2Jktr_k2kxr9Oqa-5Olrc-W7VvGpqw_Jlassj0	refresh	3	2025-11-07 11:37:36.814	f
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, "createdAt", "updatedAt", "deletedAt", status, name, email, password, role, "isEmailVerified") FROM stdin;
2	2025-10-08 08:18:38.577	2025-10-08 08:18:38.577	\N	t	Admin User	admin@test.com	$2a$08$cMcEgMv9zNuxcH5HKtkm/OnfK6SzFp0PVNq9GCc.Nzwj/T.cXm4v6	user	f
3	2025-10-08 08:28:39.213	2025-10-08 08:28:39.213	\N	t	Test User	test@test.com	$2a$08$CGP25qTrLehLLH8TNRGUdexOxaYG3h8yd4kR58mhA9teVh8dG.DIq	user	f
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
10cca9e0-159e-4e7d-b48f-1f0a723563cf	a144f3bdf027e922a17559e95b1258cc5df19dd0301a05f29a78e9764be41adc	2025-10-07 17:21:01.37436+03	20251007142101_init	\N	\N	2025-10-07 17:21:01.343792+03	1
9b37a9c8-e69d-4bdf-80fd-60bf92159b20	62eb0be2ab7ccb42c8ed21609d79bb3a9ee7adb197d2ec39c8988a521bcadefc	2025-10-08 10:19:05.970127+03	20251008071905_add_backup_models	\N	\N	2025-10-08 10:19:05.938449+03	1
\.


--
-- Name: BackupHistory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."BackupHistory_id_seq"', 3, true);


--
-- Name: BackupJob_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."BackupJob_id_seq"', 1, true);


--
-- Name: Database_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Database_id_seq"', 1, true);


--
-- Name: Token_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Token_id_seq"', 22, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 3, true);


--
-- Name: BackupHistory BackupHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackupHistory"
    ADD CONSTRAINT "BackupHistory_pkey" PRIMARY KEY (id);


--
-- Name: BackupJob BackupJob_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackupJob"
    ADD CONSTRAINT "BackupJob_pkey" PRIMARY KEY (id);


--
-- Name: Database Database_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Database"
    ADD CONSTRAINT "Database_pkey" PRIMARY KEY (id);


--
-- Name: Token Token_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Token"
    ADD CONSTRAINT "Token_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: BackupHistory BackupHistory_backupJobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackupHistory"
    ADD CONSTRAINT "BackupHistory_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES public."BackupJob"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BackupHistory BackupHistory_databaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackupHistory"
    ADD CONSTRAINT "BackupHistory_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES public."Database"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BackupJob BackupJob_databaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BackupJob"
    ADD CONSTRAINT "BackupJob_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES public."Database"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Database Database_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Database"
    ADD CONSTRAINT "Database_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Token Token_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Token"
    ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 45j8gVJiNiNVVRrj1R5jpI3VByiA15gUiAyWSW06kbgvsJublQOHUyBNtRe4Kqf

