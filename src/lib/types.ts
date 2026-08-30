export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  sort_order: number;
};

export type Service = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  starting_price: number;
  estimated_duration: string;
  popular: boolean;
};

export type Professional = {
  id: string;
  name: string;
  category_slug: string;
  skills: string[];
  experience_years: number;
  rating: number;
  reviews_count: number;
  completed_jobs: number;
  starting_price: number;
  avatar_url: string;
  distance_km: number;
  status: 'available' | 'busy';
  bio: string;
  service_area: string;
  phone: string | null;
  email: string | null;
};

export type Profile = {
  phone: string;
  name: string;
  email: string | null;
  location: string | null;
  role: string;
  created_at: string;
};

export type Notification = {
  id: string;
  customer_phone: string;
  type: string;
  title: string;
  message: string;
  booking_id: string | null;
  read: boolean;
  created_at: string;
};

export type Favourite = {
  id: string;
  customer_phone: string;
  professional_id: string;
  created_at: string;
};

export type Payout = {
  id: string;
  professional_id: string;
  amount: number;
  status: 'requested' | 'completed' | 'failed';
  created_at: string;
};

export type SupportTicket = {
  id: string;
  customer_phone: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export type AddressRow = {
  id: string;
  customer_phone: string;
  label: string;
  full_address: string;
  is_default: boolean;
  created_at: string;
};

export type Review = {
  id: string;
  professional_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type BookingStatus =
  | 'confirmed'
  | 'assigned'
  | 'on_the_way'
  | 'started'
  | 'completed'
  | 'cancelled';

export type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  service_id: string | null;
  service_name: string;
  professional_id: string | null;
  professional_name: string;
  scheduled_date: string;
  scheduled_time: string;
  notes: string;
  base_price: number;
  visit_fee: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: BookingStatus;
  created_at: string;
};
