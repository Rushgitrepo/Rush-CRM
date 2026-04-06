-- Car Inventory Management System
-- Migration: Add Car Inventory Tables

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CAR WORKSPACES TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_workspaces CASCADE;
CREATE TABLE car_workspaces (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  workspace_type character varying(50) DEFAULT 'dealership', -- dealership, branch, showroom
  location character varying(255),
  address text,
  city character varying(100),
  state character varying(100),
  country character varying(100),
  postal_code character varying(20),
  phone character varying(50),
  email character varying(255),
  admin_id uuid, -- workspace admin user
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_workspaces_org ON car_workspaces(org_id);
CREATE INDEX idx_car_workspaces_admin ON car_workspaces(admin_id);

-- ============================================================================
-- 2. CAR INVENTORY TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_inventory CASCADE;
CREATE TABLE car_inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  
  -- Basic Info
  stock_number character varying(100) UNIQUE,
  vin character varying(17) UNIQUE, -- Vehicle Identification Number
  make character varying(100) NOT NULL, -- Toyota, Honda, BMW
  model character varying(100) NOT NULL, -- Corolla, Civic, X5
  year integer NOT NULL,
  trim_level character varying(100), -- EX, LX, Sport
  
  -- Specifications
  body_type character varying(50), -- Sedan, SUV, Truck, Coupe
  exterior_color character varying(50),
  interior_color character varying(50),
  transmission character varying(50), -- Automatic, Manual, CVT
  fuel_type character varying(50), -- Gasoline, Diesel, Electric, Hybrid
  engine_size character varying(50), -- 2.0L, 3.5L V6
  cylinders integer,
  drivetrain character varying(50), -- FWD, RWD, AWD, 4WD
  
  -- Condition & Mileage
  condition character varying(50) DEFAULT 'used', -- new, used, certified
  mileage integer DEFAULT 0, -- in KM or Miles
  mileage_unit character varying(10) DEFAULT 'km', -- km or miles
  
  -- Pricing
  purchase_price numeric(12,2), -- what we bought it for
  selling_price numeric(12,2) NOT NULL, -- listing price
  msrp numeric(12,2), -- Manufacturer's Suggested Retail Price
  currency character varying(10) DEFAULT 'USD',
  
  -- Status
  status character varying(50) DEFAULT 'available', -- available, sold, reserved, pending, service
  availability_date date,
  sold_date date,
  reserved_by uuid, -- customer/contact id
  reserved_until timestamp without time zone,
  
  -- Features & Options
  features jsonb DEFAULT '[]', -- ["Sunroof", "Leather Seats", "Navigation"]
  standard_features text,
  optional_features text,
  
  -- Technical Details
  doors integer,
  seats integer,
  mpg_city numeric(5,2), -- Miles per gallon city
  mpg_highway numeric(5,2), -- Miles per gallon highway
  horsepower integer,
  torque integer,
  
  -- History & Documentation
  previous_owners integer DEFAULT 0,
  accident_history boolean DEFAULT false,
  service_history text,
  warranty_info text,
  registration_number character varying(100),
  registration_expiry date,
  insurance_expiry date,
  
  -- Media
  primary_image character varying(500),
  images jsonb DEFAULT '[]', -- array of image URLs
  video_url character varying(500),
  
  -- Location
  location character varying(255), -- Lot A, Showroom Floor
  warehouse_id uuid, -- if using existing warehouses table
  
  -- Additional Info
  description text,
  internal_notes text, -- private notes for staff
  tags character varying[] DEFAULT '{}',
  
  -- Metadata
  created_by uuid,
  updated_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_inventory_org ON car_inventory(org_id);
CREATE INDEX idx_car_inventory_workspace ON car_inventory(workspace_id);
CREATE INDEX idx_car_inventory_status ON car_inventory(status);
CREATE INDEX idx_car_inventory_make_model ON car_inventory(make, model);
CREATE INDEX idx_car_inventory_year ON car_inventory(year);
CREATE INDEX idx_car_inventory_vin ON car_inventory(vin);
CREATE INDEX idx_car_inventory_stock ON car_inventory(stock_number);

-- ============================================================================
-- 3. CAR DOCUMENTS TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_documents CASCADE;
CREATE TABLE car_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  document_type character varying(100) NOT NULL, -- registration, insurance, inspection, title
  document_name character varying(255) NOT NULL,
  file_url character varying(500) NOT NULL,
  file_size integer,
  mime_type character varying(100),
  expiry_date date,
  notes text,
  uploaded_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_documents_car ON car_documents(car_id);
CREATE INDEX idx_car_documents_type ON car_documents(document_type);

-- ============================================================================
-- 4. CAR INQUIRIES TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_inquiries CASCADE;
CREATE TABLE car_inquiries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  
  -- Customer Info
  customer_name character varying(255) NOT NULL,
  customer_email character varying(255),
  customer_phone character varying(50),
  contact_id uuid, -- link to existing contact if available
  
  -- Inquiry Details
  inquiry_type character varying(50) DEFAULT 'general', -- general, test_drive, purchase, trade_in
  message text,
  preferred_contact_method character varying(50), -- email, phone, whatsapp
  preferred_contact_time character varying(100),
  
  -- Status
  status character varying(50) DEFAULT 'new', -- new, contacted, scheduled, completed, closed
  priority character varying(50) DEFAULT 'medium', -- low, medium, high
  assigned_to uuid, -- sales rep
  
  -- Follow-up
  follow_up_date date,
  follow_up_notes text,
  
  -- Metadata
  source character varying(100), -- website, phone, walk-in, referral
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_inquiries_workspace ON car_inquiries(workspace_id);
CREATE INDEX idx_car_inquiries_car ON car_inquiries(car_id);
CREATE INDEX idx_car_inquiries_status ON car_inquiries(status);
CREATE INDEX idx_car_inquiries_assigned ON car_inquiries(assigned_to);

-- ============================================================================
-- 5. CAR TEST DRIVES TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_test_drives CASCADE;
CREATE TABLE car_test_drives (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  inquiry_id uuid REFERENCES car_inquiries(id) ON DELETE SET NULL,
  
  -- Customer Info
  customer_name character varying(255) NOT NULL,
  customer_email character varying(255),
  customer_phone character varying(50) NOT NULL,
  customer_license character varying(100), -- driver's license number
  contact_id uuid,
  
  -- Schedule
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  duration_minutes integer DEFAULT 30,
  
  -- Status
  status character varying(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  
  -- Details
  start_mileage integer,
  end_mileage integer,
  route_taken text,
  sales_rep uuid, -- assigned sales representative
  notes text,
  customer_feedback text,
  interested_level character varying(50), -- low, medium, high
  
  -- Follow-up
  follow_up_required boolean DEFAULT true,
  follow_up_date date,
  
  -- Metadata
  created_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp without time zone
);

CREATE INDEX idx_car_test_drives_workspace ON car_test_drives(workspace_id);
CREATE INDEX idx_car_test_drives_car ON car_test_drives(car_id);
CREATE INDEX idx_car_test_drives_date ON car_test_drives(scheduled_date);
CREATE INDEX idx_car_test_drives_status ON car_test_drives(status);

-- ============================================================================
-- 6. CAR SALES TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_sales CASCADE;
CREATE TABLE car_sales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE RESTRICT,
  
  -- Sale Info
  sale_number character varying(100) UNIQUE,
  sale_date date NOT NULL,
  
  -- Customer
  customer_name character varying(255) NOT NULL,
  customer_email character varying(255),
  customer_phone character varying(50),
  customer_address text,
  contact_id uuid,
  
  -- Pricing
  sale_price numeric(12,2) NOT NULL,
  down_payment numeric(12,2) DEFAULT 0,
  trade_in_value numeric(12,2) DEFAULT 0,
  trade_in_vehicle character varying(255),
  financing_amount numeric(12,2) DEFAULT 0,
  financing_term integer, -- months
  interest_rate numeric(5,2),
  monthly_payment numeric(12,2),
  
  -- Fees & Taxes
  tax_amount numeric(12,2) DEFAULT 0,
  registration_fee numeric(12,2) DEFAULT 0,
  documentation_fee numeric(12,2) DEFAULT 0,
  other_fees numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  
  -- Payment
  payment_method character varying(50), -- cash, finance, lease, bank_transfer
  payment_status character varying(50) DEFAULT 'pending', -- pending, partial, paid
  amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2),
  
  -- Delivery
  delivery_date date,
  delivery_status character varying(50) DEFAULT 'pending', -- pending, ready, delivered
  
  -- Staff
  sales_rep uuid, -- who made the sale
  finance_manager uuid,
  
  -- Documents
  contract_signed boolean DEFAULT false,
  contract_url character varying(500),
  
  -- Notes
  notes text,
  
  -- Metadata
  created_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_sales_workspace ON car_sales(workspace_id);
CREATE INDEX idx_car_sales_car ON car_sales(car_id);
CREATE INDEX idx_car_sales_date ON car_sales(sale_date);
CREATE INDEX idx_car_sales_status ON car_sales(payment_status);

-- ============================================================================
-- 7. CAR SERVICE HISTORY TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_service_history CASCADE;
CREATE TABLE car_service_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  
  service_date date NOT NULL,
  service_type character varying(100) NOT NULL, -- maintenance, repair, inspection, detailing
  description text NOT NULL,
  mileage_at_service integer,
  cost numeric(10,2),
  service_provider character varying(255), -- internal or external shop
  invoice_number character varying(100),
  next_service_due date,
  next_service_mileage integer,
  
  performed_by uuid,
  notes text,
  
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_service_car ON car_service_history(car_id);
CREATE INDEX idx_car_service_date ON car_service_history(service_date);

-- ============================================================================
-- 8. CAR WORKSPACE MEMBERS TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_workspace_members CASCADE;
CREATE TABLE car_workspace_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role character varying(50) DEFAULT 'member', -- admin, manager, sales_rep, viewer
  permissions jsonb DEFAULT '{}',
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_car_workspace_members_workspace ON car_workspace_members(workspace_id);
CREATE INDEX idx_car_workspace_members_user ON car_workspace_members(user_id);

-- ============================================================================
-- 9. CAR ACTIVITY LOG TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_activity_log CASCADE;
CREATE TABLE car_activity_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid REFERENCES car_inventory(id) ON DELETE CASCADE,
  
  activity_type character varying(100) NOT NULL, -- created, updated, sold, reserved, inquiry, test_drive
  description text NOT NULL,
  changes jsonb, -- track what changed
  
  user_id uuid,
  user_name character varying(255),
  
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_activity_workspace ON car_activity_log(workspace_id);
CREATE INDEX idx_car_activity_car ON car_activity_log(car_id);
CREATE INDEX idx_car_activity_type ON car_activity_log(activity_type);
CREATE INDEX idx_car_activity_date ON car_activity_log(created_at);

-- ============================================================================
-- SEED DATA: Create Default Workspaces
-- ============================================================================

-- Note: Update org_id with your actual organization ID
-- You can get it by running: SELECT id FROM organizations LIMIT 1;

-- Uncomment and update these lines after getting your org_id:
-- INSERT INTO car_workspaces (org_id, name, description, workspace_type, is_active) VALUES
-- ('your-org-id-here', 'Biwords Auto', 'Main dealership for Biwords', 'dealership', true),
-- ('your-org-id-here', 'Motors 1', 'First motors branch', 'branch', true),
-- ('your-org-id-here', 'Motors 2', 'Second motors branch', 'branch', true),
-- ('your-org-id-here', 'Motors 3', 'Third motors branch', 'branch', true);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_car_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER car_inventory_updated_at BEFORE UPDATE ON car_inventory
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_workspaces_updated_at BEFORE UPDATE ON car_workspaces
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_inquiries_updated_at BEFORE UPDATE ON car_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_test_drives_updated_at BEFORE UPDATE ON car_test_drives
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_sales_updated_at BEFORE UPDATE ON car_sales
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE car_workspaces IS 'Separate workspaces for different dealerships/branches';
COMMENT ON TABLE car_inventory IS 'Main car inventory with all vehicle details';
COMMENT ON TABLE car_inquiries IS 'Customer inquiries about specific cars';
COMMENT ON TABLE car_test_drives IS 'Test drive bookings and history';
COMMENT ON TABLE car_sales IS 'Completed car sales transactions';
COMMENT ON TABLE car_service_history IS 'Service and maintenance history for each car';
COMMENT ON TABLE car_workspace_members IS 'Users assigned to specific workspaces';
COMMENT ON TABLE car_activity_log IS 'Activity tracking for audit trail';
