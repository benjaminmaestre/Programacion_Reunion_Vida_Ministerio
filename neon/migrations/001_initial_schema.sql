-- MIGRACIÓN INICIAL: ESQUEMA BASE DEL SISTEMA DE ASIGNACIONES S-140

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS Y TIPOS
CREATE TYPE gender_enum AS ENUM ('male', 'female');
CREATE TYPE appointment_enum AS ENUM ('none', 'ministerial_servant', 'elder');
CREATE TYPE section_enum AS ENUM ('treasures', 'ministers', 'living', 'auxiliary');
CREATE TYPE week_type_enum AS ENUM ('normal', 'circuit_overseer', 'assembly', 'memorial');

-- 2. DIRECTORIO DE MIEMBROS DE LA CONGREGACIÓN
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender gender_enum NOT NULL,
    appointment appointment_enum DEFAULT 'none',
    is_active BOOLEAN DEFAULT true,
    is_baptized BOOLEAN DEFAULT true,
    phone VARCHAR(20),
    email VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AUTORIZACIONES Y COMPETENCIAS CONFIRMADAS (Habilitaciones humanas)
CREATE TABLE member_eligibilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    can_do_treasures_talk BOOLEAN DEFAULT false,
    can_do_gems BOOLEAN DEFAULT false,
    can_do_bible_reading BOOLEAN DEFAULT false,
    can_do_student_talk BOOLEAN DEFAULT false,
    can_be_assistant BOOLEAN DEFAULT true,
    can_do_living_part BOOLEAN DEFAULT false,
    can_conduct_congregation_bible_study BOOLEAN DEFAULT false,
    can_read_congregation_bible_study BOOLEAN DEFAULT false,
    can_be_chairman BOOLEAN DEFAULT false,
    can_be_auxiliary_counselor BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RELACIONES FAMILIARES (Para validación de ayudantes del mismo sexo / familiar)
CREATE TABLE family_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    related_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- 'spouse', 'parent', 'child', 'sibling'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, related_member_id)
);

-- 5. CICLOS DE PLANIFICACIÓN BIMESTRAL
CREATE TABLE planning_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INT NOT NULL,
    bimonth_number INT NOT NULL CHECK (bimonth_number BETWEEN 1 AND 6),
    activity_guide_available_at DATE,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PERÍODOS DE MEMORIA SEMESTRAL (6 MESES)
CREATE TABLE history_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INT NOT NULL,
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 2),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REUNIONES SEMANALES Y EXCEPCIONES
CREATE TABLE meeting_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_date DATE NOT NULL UNIQUE,
    week_type week_type_enum DEFAULT 'normal',
    planning_cycle_id UUID REFERENCES planning_cycles(id),
    history_period_id UUID REFERENCES history_periods(id),
    chairman_id UUID REFERENCES members(id),
    auxiliary_counselor_id UUID REFERENCES members(id),
    circuit_overseer_talk_title VARCHAR(255),
    is_draft BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ASIGNACIONES CONCRETAS EN LA REUNIÓN
CREATE TABLE assignment_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_program_id UUID NOT NULL REFERENCES meeting_programs(id) ON DELETE CASCADE,
    section section_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL,
    order_index INT NOT NULL,
    is_student_part BOOLEAN DEFAULT false,
    primary_participant_id UUID REFERENCES members(id),
    assistant_participant_id UUID REFERENCES members(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES PARA MÁXIMA VELOCIDAD Y FILTRADO HISTÓRICO
CREATE INDEX idx_members_active ON members(is_active);
CREATE INDEX idx_assignment_slots_meeting ON assignment_slots(meeting_program_id);
CREATE INDEX idx_assignment_slots_primary ON assignment_slots(primary_participant_id);
CREATE INDEX idx_assignment_slots_assistant ON assignment_slots(assistant_participant_id);
